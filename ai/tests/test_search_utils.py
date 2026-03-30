"""common/search_utils.py 공통 유틸리티 검증 테스트"""
import sys
import os
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.search_utils import cosine_similarity, haversine, expand_tags, rerank_by_similarity


# ============================================================
# 1. cosine_similarity
# ============================================================

class TestCosineSimilarity:
    def test_identical_vectors_return_1(self):
        v = [1.0, 2.0, 3.0]
        assert abs(cosine_similarity(v, v) - 1.0) < 1e-9

    def test_orthogonal_vectors_return_0(self):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert abs(cosine_similarity(a, b)) < 1e-9

    def test_zero_vector_returns_0(self):
        a = [0.0, 0.0]
        b = [1.0, 2.0]
        assert cosine_similarity(a, b) == 0.0

    def test_length_mismatch_returns_0(self):
        a = [1.0, 2.0]
        b = [1.0, 2.0, 3.0]
        assert cosine_similarity(a, b) == 0.0

    def test_empty_vectors_return_0(self):
        assert cosine_similarity([], []) == 0.0
        assert cosine_similarity([], [1.0]) == 0.0
        assert cosine_similarity([1.0], []) == 0.0


# ============================================================
# 2. haversine
# ============================================================

class TestHaversine:
    def test_same_point_returns_zero(self):
        assert haversine(37.5665, 126.9780, 37.5665, 126.9780) == 0.0

    def test_seoul_to_busan(self):
        """서울(37.5665, 126.9780) <-> 부산(35.1796, 129.0756) ~ 325km"""
        dist = haversine(37.5665, 126.9780, 35.1796, 129.0756)
        assert 320 < dist < 330, f"Expected ~325km, got {dist:.1f}km"

    def test_symmetry(self):
        d1 = haversine(37.5665, 126.9780, 35.1796, 129.0756)
        d2 = haversine(35.1796, 129.0756, 37.5665, 126.9780)
        assert abs(d1 - d2) < 0.001

    def test_returns_float(self):
        result = haversine(37.0, 127.0, 38.0, 128.0)
        assert isinstance(result, float)


# ============================================================
# 3. expand_tags (mock driver)
# ============================================================

class TestExpandTags:
    def _mock_driver(self, related_tags):
        """CO_OCCURS 결과를 반환하는 mock driver 생성"""
        driver = MagicMock()
        session = MagicMock()
        result_mock = MagicMock()
        result_mock.__iter__ = lambda self: iter(
            [{"related_tag": t} for t in related_tags]
        )
        session.run.return_value = result_mock
        session.__enter__ = lambda self: self
        session.__exit__ = MagicMock(return_value=False)
        driver.session.return_value = session
        return driver

    def test_returns_original_plus_related(self):
        driver = self._mock_driver(["romantic", "luxury"])
        result = expand_tags(driver, ["natural"], "studio")
        assert result[0] == "natural"
        assert "romantic" in result
        assert "luxury" in result

    def test_empty_tags_returns_empty(self):
        driver = self._mock_driver([])
        result = expand_tags(driver, [], "studio")
        assert result == []

    def test_none_tags_returns_empty(self):
        driver = self._mock_driver([])
        result = expand_tags(driver, None, "studio")
        assert result == []

    def test_none_driver_returns_original(self):
        result = expand_tags(None, ["natural"], "studio")
        assert result == ["natural"]

    def test_deduplication(self):
        driver = self._mock_driver(["warm", "warm"])
        result = expand_tags(driver, ["natural"], "studio")
        assert result.count("warm") == 1


# ============================================================
# 4. rerank_by_similarity
# ============================================================

class TestRerankBySimilarity:
    def test_reranks_by_embedding_similarity(self):
        records = [
            {"name": "A", "embedding": [0.0, 1.0]},
            {"name": "B", "embedding": [1.0, 0.0]},
        ]
        query_emb = [1.0, 0.0]
        result = rerank_by_similarity(records, query_emb)
        assert result[0]["name"] == "B"
        assert result[1]["name"] == "A"

    def test_no_query_embedding_returns_first_n(self):
        records = [{"name": "A"}, {"name": "B"}, {"name": "C"}]
        result = rerank_by_similarity(records, [], limit=2)
        assert len(result) == 2
        assert result[0]["name"] == "A"

    def test_records_without_embedding_get_zero_score(self):
        records = [
            {"name": "A"},  # no embedding
            {"name": "B", "embedding": [1.0, 0.0]},
        ]
        query_emb = [1.0, 0.0]
        result = rerank_by_similarity(records, query_emb)
        assert result[0]["name"] == "B"

    def test_respects_limit(self):
        records = [
            {"name": f"V{i}", "embedding": [float(i), 0.0]}
            for i in range(20)
        ]
        query_emb = [19.0, 0.0]
        result = rerank_by_similarity(records, query_emb, limit=5)
        assert len(result) == 5

    def test_custom_embedding_key(self):
        records = [
            {"name": "A", "vec": [0.0, 1.0]},
            {"name": "B", "vec": [1.0, 0.0]},
        ]
        query_emb = [1.0, 0.0]
        result = rerank_by_similarity(records, query_emb, embedding_key="vec")
        assert result[0]["name"] == "B"
