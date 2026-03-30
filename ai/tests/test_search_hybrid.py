"""search_hybrid 하이브리드 파이프라인 검증 테스트"""
import sys
import os
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sdm.graphrag import SdmGraphRagEngine


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture
def engine():
    """ready() True인 mock engine"""
    settings = MagicMock()
    settings.openai_api_key = "test"
    settings.openai_chat_model = "gpt-4o"
    settings.openai_embedding_model = "text-embedding-3-small"
    settings.neo4j_uri = "bolt://localhost:7687"
    settings.neo4j_user = "neo4j"
    settings.neo4j_password = "password123"
    settings.mysql_host = None
    settings.mysql_user = None
    settings.mysql_password = None
    settings.mysql_db = None
    settings.mysql_port = 3306

    with patch.object(SdmGraphRagEngine, '__init__', lambda self, s: None):
        eng = SdmGraphRagEngine.__new__(SdmGraphRagEngine)
        eng.settings = settings
        eng.driver = MagicMock()
        eng.mysql_conn = None
        eng.startup_error = None
        eng.openai_client = MagicMock()
        eng.llm = MagicMock()
        eng.embedder = MagicMock()
        eng.rag_cypher = MagicMock()
        eng._vector_retriever_cls = MagicMock()
        eng._graph_rag_cls = MagicMock()
        eng._rag_template_cls = MagicMock()
        eng._retriever_item_cls = MagicMock()
    return eng


def _mock_session(records):
    """driver.session() context manager가 records를 반환하도록 mock"""
    session = MagicMock()
    run_result = MagicMock()
    run_result.__iter__ = lambda self: iter(records)
    session.run.return_value = run_result
    session.__enter__ = lambda self: self
    session.__exit__ = MagicMock(return_value=False)
    return session


# ============================================================
# 1. _cosine_similarity 단위 테스트
# ============================================================

class TestCosineSimilarity:
    def test_identical_vectors_return_1(self):
        v = [1.0, 2.0, 3.0]
        assert abs(SdmGraphRagEngine._cosine_similarity(v, v) - 1.0) < 1e-9

    def test_orthogonal_vectors_return_0(self):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert abs(SdmGraphRagEngine._cosine_similarity(a, b)) < 1e-9

    def test_opposite_vectors_return_neg1(self):
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert abs(SdmGraphRagEngine._cosine_similarity(a, b) - (-1.0)) < 1e-9

    def test_zero_vector_returns_0(self):
        a = [0.0, 0.0]
        b = [1.0, 2.0]
        assert SdmGraphRagEngine._cosine_similarity(a, b) == 0.0

    def test_different_magnitude_same_direction(self):
        a = [1.0, 0.0]
        b = [100.0, 0.0]
        assert abs(SdmGraphRagEngine._cosine_similarity(a, b) - 1.0) < 1e-9


# ============================================================
# 2. _expand_tags 테스트 (mock Neo4j driver)
# ============================================================

class TestExpandTags:
    def test_returns_original_plus_related(self, engine):
        session = MagicMock()
        # Forward direction: t1->t2
        forward_result = MagicMock()
        forward_result.__iter__ = lambda self: iter([{"related_tag": "romantic"}])
        # Backward direction: t1<-t2
        backward_result = MagicMock()
        backward_result.__iter__ = lambda self: iter([{"related_tag": "luxury"}])

        session.run.side_effect = [forward_result, backward_result]
        session.__enter__ = lambda self: self
        session.__exit__ = MagicMock(return_value=False)
        engine.driver.session.return_value = session

        result = engine._expand_tags(["natural"], "studio")
        assert result[0] == "natural"  # original first
        assert "romantic" in result
        assert "luxury" in result

    def test_empty_tags_returns_empty(self, engine):
        result = engine._expand_tags([], "studio")
        assert result == []

    def test_none_tags_returns_empty(self, engine):
        result = engine._expand_tags(None, "studio")
        assert result == []

    def test_deduplication(self, engine):
        session = MagicMock()
        forward_result = MagicMock()
        forward_result.__iter__ = lambda self: iter([{"related_tag": "warm"}])
        backward_result = MagicMock()
        backward_result.__iter__ = lambda self: iter([{"related_tag": "warm"}])  # duplicate

        session.run.side_effect = [forward_result, backward_result]
        session.__enter__ = lambda self: self
        session.__exit__ = MagicMock(return_value=False)
        engine.driver.session.return_value = session

        result = engine._expand_tags(["natural"], "studio")
        assert result.count("warm") == 1


# ============================================================
# 3. _hybrid_step1_filter 테스트 (Cypher 파라미터 바인딩)
# ============================================================

class TestHybridStep1Filter:
    def test_params_are_bound_not_interpolated(self, engine):
        session = _mock_session([])
        engine.driver.session.return_value = session

        engine._hybrid_step1_filter(
            category="studio", region="gangnam",
            max_price=500000, min_price=100000, tags=None,
        )

        call_args = session.run.call_args
        cypher = call_args[0][0]
        kwargs = call_args[1]

        # Cypher uses $param binding
        assert "$category" in cypher
        assert "$max_price" in cypher
        assert "$min_price" in cypher
        assert "$region" in cypher
        # Params are passed
        assert kwargs["category"] == "studio"
        assert kwargs["max_price"] == 500000
        assert kwargs["min_price"] == 100000
        assert kwargs["region"] == "gangnam"

    def test_no_string_concatenation_for_values(self, engine):
        session = _mock_session([])
        engine.driver.session.return_value = session

        engine._hybrid_step1_filter(
            category="studio", region="gangnam",
            max_price=500000, min_price=None, tags=None,
        )

        cypher = session.run.call_args[0][0]
        # No literal value interpolation
        assert "gangnam" not in cypher
        assert "500000" not in cypher

    def test_category_only_query(self, engine):
        records = [{"name": "TestStudio", "category": "studio", "rating": 4.5}]
        session = _mock_session(records)
        engine.driver.session.return_value = session

        result = engine._hybrid_step1_filter(category="studio")
        assert len(result) == 1
        assert result[0]["name"] == "TestStudio"


# ============================================================
# 4. search_hybrid 단계적 완화 테스트
# ============================================================

class TestSearchHybridRelaxation:
    def test_relaxes_tags_first(self, engine):
        """0건 -> tags 제거로 완화 -> 결과 반환"""
        call_count = {"n": 0}
        original_filter = engine._hybrid_step1_filter

        def mock_filter(**kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                return []  # first call: 0 results
            return [{"name": "Studio1", "embedding": [0.1, 0.2], "rating": 4.0}]

        engine._hybrid_step1_filter = mock_filter
        engine.embedder.embed_query.return_value = [0.1, 0.2]

        records, answer = engine.search_hybrid(
            category="studio", query="test",
            tags=["natural"], region=None, max_price=None,
        )
        assert len(records) == 1
        assert call_count["n"] == 2  # called twice: original + relaxed

    def test_relaxes_price_after_tags(self, engine):
        """tags 완화 후에도 0건이면 price 완화"""
        call_count = {"n": 0}

        def mock_filter(**kwargs):
            call_count["n"] += 1
            if call_count["n"] <= 2:
                return []
            return [{"name": "Studio1", "embedding": [0.1, 0.2], "rating": 4.0}]

        engine._hybrid_step1_filter = mock_filter
        engine.embedder.embed_query.return_value = [0.1, 0.2]

        records, _ = engine.search_hybrid(
            category="studio", query="test",
            tags=["natural"], max_price=500000,
        )
        assert len(records) == 1
        assert call_count["n"] == 3

    def test_empty_result_message(self, engine):
        """모든 완화 후에도 0건이면 메시지 반환"""
        engine._hybrid_step1_filter = lambda **kw: []

        records, answer = engine.search_hybrid(
            category="studio", query="test",
        )
        assert records == []
        assert "찾지 못했습니다" in answer


# ============================================================
# 5. search_hybrid Step 2 벡터 재정렬 테스트
# ============================================================

class TestSearchHybridVectorRerank:
    def test_style_query_used_for_embedding(self, engine):
        """style_query가 있으면 그걸로 임베딩"""
        engine._hybrid_step1_filter = lambda **kw: [
            {"name": "A", "embedding": [1.0, 0.0], "rating": 3.0},
            {"name": "B", "embedding": [0.0, 1.0], "rating": 5.0},
        ]
        engine.embedder.embed_query.return_value = [1.0, 0.0]

        records, _ = engine.search_hybrid(
            category="studio", query="test query",
            style_query="warm natural",
        )
        # embed_query called with style_query, not query
        engine.embedder.embed_query.assert_called_once_with("warm natural")
        # A should rank first (cosine sim = 1.0 vs 0.0)
        assert records[0]["name"] == "A"

    def test_query_fallback_when_no_style_query(self, engine):
        """style_query 없으면 query로 임베딩"""
        engine._hybrid_step1_filter = lambda **kw: [
            {"name": "A", "embedding": [1.0, 0.0], "rating": 3.0},
        ]
        engine.embedder.embed_query.return_value = [1.0, 0.0]

        engine.search_hybrid(
            category="studio", query="my query",
            style_query=None,
        )
        engine.embedder.embed_query.assert_called_once_with("my query")

    def test_no_embedding_no_rerank(self, engine):
        """query와 style_query 모두 없으면 재정렬 안 함"""
        engine._hybrid_step1_filter = lambda **kw: [
            {"name": "B", "embedding": [0.0, 1.0], "rating": 5.0},
            {"name": "A", "embedding": [1.0, 0.0], "rating": 3.0},
        ]

        records, _ = engine.search_hybrid(
            category="studio", query="",
            style_query=None,
        )
        # embedding removed but order preserved (rating desc from step1)
        assert "embedding" not in records[0]
        assert records[0]["name"] == "B"

    def test_embedding_removed_from_output(self, engine):
        """최종 결과에 embedding 필드가 없어야 함"""
        engine._hybrid_step1_filter = lambda **kw: [
            {"name": "A", "embedding": [1.0, 0.0], "rating": 3.0},
        ]
        engine.embedder.embed_query.return_value = [1.0, 0.0]

        records, _ = engine.search_hybrid(
            category="studio", query="test",
        )
        for rec in records:
            assert "embedding" not in rec
            assert "_similarity" not in rec


# ============================================================
# 6. tools.py search() 라우팅 테스트
# ============================================================

class TestToolsSearchRouting:
    @pytest.fixture
    def registry(self):
        from sdm.tools import ToolRegistry, ToolResult
        engine = MagicMock()
        engine.search_hybrid.return_value = (
            [{"name": "Studio1", "category": "studio"}],
            "1개 업체를 찾았습니다.",
        )
        engine.search_structured.return_value = ("답변", ["Studio2"])
        engine.query_vendors_by_names.return_value = [
            {"name": "Studio1", "category": "studio", "sourceId": "1",
             "price": 100000, "rating": 4.5, "address": "서울",
             "region": "강남", "url": "http://test", "imageUrl": None,
             "holiday": None, "reviewCnt": 10, "lat": 37.5, "lng": 127.0,
             "tags": [], "packages": [], "avgReviewScore": 4.0,
             "reviewCount": 10, "recentReviews": []},
        ]
        reg = ToolRegistry.__new__(ToolRegistry)
        reg.engine = engine
        reg.hall_engine = None
        return reg

    def test_structured_params_calls_hybrid(self, registry):
        """region이 있으면 search_hybrid 호출"""
        result = registry.search(
            query="강남 스튜디오", category="studio", couple_id=1,
            region="강남",
        )
        registry.engine.search_hybrid.assert_called_once()
        registry.engine.search_structured.assert_not_called()

    def test_no_structured_params_calls_text2cypher(self, registry):
        """구조화 파라미터 없으면 search_structured 호출"""
        result = registry.search(
            query="스튜디오 추천", category="studio", couple_id=1,
        )
        registry.engine.search_structured.assert_called_once()
        registry.engine.search_hybrid.assert_not_called()

    def test_tags_triggers_hybrid(self, registry):
        """tags만 있어도 search_hybrid 호출"""
        result = registry.search(
            query="내추럴 스튜디오", category="studio", couple_id=1,
            tags=["natural"],
        )
        registry.engine.search_hybrid.assert_called_once()

    def test_style_query_triggers_hybrid(self, registry):
        """style_query만 있어도 search_hybrid 호출"""
        result = registry.search(
            query="분위기 좋은 곳", category="studio", couple_id=1,
            style_query="warm natural",
        )
        registry.engine.search_hybrid.assert_called_once()
