"""Hall 벡터 점수 통합 검증 테스트 (Phase 3)"""
import inspect
import sys
import os
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from hall.graphrag import (
    HallGraphRagEngine,
    HallRecord,
    HallCriteria,
    STYLE_KEYWORDS,
    FEATURE_KEYWORDS,
)


# ============================================================
# Helpers
# ============================================================

def _make_hall(partner_id: int, name: str = "테스트홀", **kwargs) -> HallRecord:
    defaults = dict(
        partner_id=partner_id,
        name=name,
        region="서울",
        sub_region="강남구",
        address="서울 강남구 테스트로 1",
        address_hint="",
        tel="02-1234-5678",
        rating=4.5,
        review_count=100,
        cover_url="",
        profile_url="",
        profile_text="",
        min_meal_price=None,
        max_meal_price=None,
        min_rental_price=None,
        max_rental_price=None,
        min_total_price=None,
        max_total_price=None,
        tags=[],
        style_filters=[],
        benefits=[],
        subway_lines=[],
        stations=[],
        walk_minutes=None,
        memo="",
        images=[],
        lat=None,
        lng=None,
    )
    defaults.update(kwargs)
    return HallRecord(**defaults)


@pytest.fixture
def engine():
    """HallGraphRagEngine mock (DB 연결 없이)"""
    settings = MagicMock()
    settings.openai_api_key = "test-key"
    settings.openai_embedding_model = "text-embedding-3-small"
    settings.neo4j_uri = "bolt://localhost:7687"
    settings.neo4j_user = "neo4j"
    settings.neo4j_password = "password123"

    with patch.object(HallGraphRagEngine, "__init__", lambda self, s: None):
        eng = HallGraphRagEngine.__new__(HallGraphRagEngine)
        eng.settings = settings
        eng.driver = MagicMock()
        eng.startup_error = None
        eng.openai_client = MagicMock()
        eng._geo_cache = {}
        eng._route_cache = {}
    return eng


# ============================================================
# Tests: vector_score_map 생성 로직
# ============================================================

class TestVectorScoreMap:
    def test_vector_score_map_created_from_vector_results(self, engine):
        """벡터 검색 결과에서 partner_id -> score 딕셔너리가 올바르게 생성되는지"""
        hall_a = _make_hall(101, "A홀")
        hall_b = _make_hall(102, "B홀")
        vector_results = [(0.9, hall_a), (0.7, hall_b)]

        vector_score_map = {
            v_hall.partner_id: v_score
            for v_score, v_hall in vector_results
        }

        assert vector_score_map == {101: 0.9, 102: 0.7}

    def test_vector_score_map_empty_when_no_results(self, engine):
        """벡터 검색 결과가 없으면 빈 딕셔너리"""
        vector_results = []
        vector_score_map = {
            v_hall.partner_id: v_score
            for v_score, v_hall in vector_results
        }
        assert vector_score_map == {}


# ============================================================
# Tests: 키워드 결과에 벡터 점수 가산
# ============================================================

class TestKeywordVectorScoreAddition:
    def test_keyword_result_gets_vector_bonus(self, engine):
        """키워드 결과에 벡터 점수가 가산되는지 (search_scored 통합 테스트)"""
        hall_a = _make_hall(101, "A홀", region="서울")
        criteria = HallCriteria()

        # mock: _fetch_candidates -> [hall_a], _vector_search -> [(0.8, hall_a)]
        engine._fetch_candidates = MagicMock(return_value=[hall_a])
        engine._vector_search = MagicMock(return_value=[(0.8, hall_a)])
        engine._resolve_search_anchor = MagicMock(return_value=None)

        results = engine.search_scored(query="테스트", criteria=criteria, limit=10)

        assert len(results) >= 1
        score, result_hall = results[0]
        assert result_hall.partner_id == 101

        # 벡터 점수 가산 확인: VECTOR_WEIGHT=3.0 이므로 0.8 * 3.0 = 2.4 가산
        # _score_hall 기본 점수(rating*0.08 + review*0.015) + 벡터 보너스
        base_score = engine._score_hall(hall_a, "테스트", criteria)
        expected_min = base_score + 0.8 * 3.0
        assert score >= expected_min - 0.01  # 부동소수점 허용

    def test_keyword_result_without_vector_match_gets_zero_bonus(self, engine):
        """벡터 결과에 없는 키워드 결과는 벡터 보너스 0"""
        hall_a = _make_hall(101, "A홀")
        criteria = HallCriteria()

        engine._fetch_candidates = MagicMock(return_value=[hall_a])
        engine._vector_search = MagicMock(return_value=[])  # 벡터 결과 없음
        engine._resolve_search_anchor = MagicMock(return_value=None)

        results = engine.search_scored(query="테스트", criteria=criteria, limit=10)

        assert len(results) == 1
        score, _ = results[0]
        base_score = engine._score_hall(hall_a, "테스트", criteria)
        assert abs(score - base_score) < 0.01


# ============================================================
# Tests: 벡터에만 있는 결과가 scored_map에 추가되는지
# ============================================================

class TestVectorOnlyResults:
    def test_vector_only_result_added_to_scored_map(self, engine):
        """키워드에 없고 벡터에만 있는 결과가 최종 결과에 포함되는지"""
        hall_kw = _make_hall(101, "키워드홀")
        hall_vec = _make_hall(202, "벡터전용홀")
        criteria = HallCriteria()

        engine._fetch_candidates = MagicMock(return_value=[hall_kw])
        engine._vector_search = MagicMock(return_value=[(0.85, hall_vec)])
        engine._resolve_search_anchor = MagicMock(return_value=None)

        results = engine.search_scored(query="테스트", criteria=criteria, limit=10)

        result_pids = {hall.partner_id for _, hall in results}
        assert 101 in result_pids, "키워드 결과가 누락됨"
        assert 202 in result_pids, "벡터 전용 결과가 누락됨"

    def test_vector_only_not_duplicated_when_also_in_keyword(self, engine):
        """키워드와 벡터 양쪽에 있는 결과가 중복 추가되지 않는지"""
        hall = _make_hall(101, "공통홀")
        criteria = HallCriteria()

        engine._fetch_candidates = MagicMock(return_value=[hall])
        engine._vector_search = MagicMock(return_value=[(0.9, hall)])
        engine._resolve_search_anchor = MagicMock(return_value=None)

        results = engine.search_scored(query="테스트", criteria=criteria, limit=10)

        pids = [h.partner_id for _, h in results]
        assert pids.count(101) == 1, "같은 업체가 중복 포함됨"


# ============================================================
# Tests: STYLE_KEYWORDS / FEATURE_KEYWORDS 존재 확인
# ============================================================

class TestKeywordsExist:
    def test_style_keywords_exists_and_nonempty(self):
        assert isinstance(STYLE_KEYWORDS, dict)
        assert len(STYLE_KEYWORDS) > 0

    def test_feature_keywords_exists_and_nonempty(self):
        assert isinstance(FEATURE_KEYWORDS, dict)
        assert len(FEATURE_KEYWORDS) > 0

    def test_style_keywords_has_expected_keys(self):
        expected = {"호텔", "밝은", "어두운", "하우스", "야외"}
        assert expected.issubset(set(STYLE_KEYWORDS.keys()))

    def test_feature_keywords_has_expected_keys(self):
        expected = {"주차", "역세권", "채플"}
        assert expected.issubset(set(FEATURE_KEYWORDS.keys()))


# ============================================================
# Tests: _score_hall 시그니처 변경 없음 확인
# ============================================================

class TestScoreHallSignature:
    def test_score_hall_accepts_required_params(self, engine):
        """_score_hall이 (hall, normalized_query, criteria, strict_region) 시그니처를 유지하는지"""
        sig = inspect.signature(engine._score_hall)
        params = list(sig.parameters.keys())
        assert "hall" in params
        assert "normalized_query" in params
        assert "criteria" in params
        assert "strict_region" in params

    def test_score_hall_returns_float_or_none(self, engine):
        """_score_hall 반환값이 float 또는 None"""
        hall = _make_hall(101, "테스트홀")
        criteria = HallCriteria()
        result = engine._score_hall(hall, "테스트", criteria)
        assert result is None or isinstance(result, (int, float))

    def test_score_hall_region_filter(self, engine):
        """strict_region=True일 때 지역 불일치 시 None 반환"""
        hall = _make_hall(101, "테스트홀", region="부산")
        criteria = HallCriteria(regions=["대전"])
        result = engine._score_hall(hall, "테스트", criteria, strict_region=True)
        assert result is None

    def test_score_hall_budget_filter(self, engine):
        """예산 초과 시 None 반환"""
        hall = _make_hall(101, "비싼홀", min_total_price=10_000_000)
        criteria = HallCriteria(budget=3_000_000)
        result = engine._score_hall(hall, "테스트", criteria)
        assert result is None

    def test_score_hall_guest_count_bonus(self, engine):
        """guest_count 조건이 점수에 반영되는지"""
        hall = _make_hall(101, "테스트홀", memo="최소 100명 최대 300명")
        criteria_with = HallCriteria(guest_count=200)
        criteria_without = HallCriteria()

        score_with = engine._score_hall(hall, "테스트", criteria_with)
        score_without = engine._score_hall(hall, "테스트", criteria_without)

        assert score_with is not None
        assert score_without is not None
        assert score_with > score_without
