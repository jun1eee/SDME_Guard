"""geo-refactoring 변경사항 검증 테스트"""
import math
import sys
import os
from dataclasses import dataclass
from unittest.mock import MagicMock, patch

import pytest

# ai/ 디렉토리를 sys.path에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ============================================================
# 1. _haversine 단위 테스트
# ============================================================

from sdm.tools import _haversine


class TestHaversine:
    def test_same_point_returns_zero(self):
        assert _haversine(37.5665, 126.9780, 37.5665, 126.9780) == 0.0

    def test_seoul_to_busan(self):
        """서울(37.5665, 126.9780) <-> 부산(35.1796, 129.0756) ~ 325km"""
        dist = _haversine(37.5665, 126.9780, 35.1796, 129.0756)
        assert 320 < dist < 330, f"Expected ~325km, got {dist:.1f}km"

    def test_symmetry(self):
        """A->B == B->A"""
        d1 = _haversine(37.5665, 126.9780, 35.1796, 129.0756)
        d2 = _haversine(35.1796, 129.0756, 37.5665, 126.9780)
        assert abs(d1 - d2) < 0.001

    def test_short_distance(self):
        """강남역(37.4979, 127.0276) <-> 선릉역(37.5046, 127.0486) ~ 1.9km"""
        dist = _haversine(37.4979, 127.0276, 37.5046, 127.0486)
        assert 1.5 < dist < 2.5, f"Expected ~1.9km, got {dist:.1f}km"

    def test_returns_float(self):
        result = _haversine(37.0, 127.0, 38.0, 128.0)
        assert isinstance(result, float)


# ============================================================
# 2. _extract_location 테스트
# ============================================================

from sdm.tools import _extract_location


class TestExtractLocation:
    def test_station_suffix(self):
        assert _extract_location("강남역 근처 스튜디오") == "강남역"

    def test_dong_suffix(self):
        assert _extract_location("삼성동 스튜디오 추천해줘") == "삼성동"

    def test_gu_suffix(self):
        assert _extract_location("강남구 드레스 추천") == "강남구"

    def test_nearby_pattern(self):
        result = _extract_location("홍대 근처 메이크업")
        assert result is not None
        assert "홍대" in result

    def test_no_location(self):
        assert _extract_location("자연스러운 스튜디오 추천해줘") is None

    def test_complex_pattern(self):
        result = _extract_location("잠실역에서 가까운 드레스")
        assert result is not None
        assert "잠실역" in result


# ============================================================
# 3. _rerank_by_distance 테스트 (mock geocode + query_vendors_by_names)
# ============================================================

class TestRerankByDistance:
    def _make_registry(self):
        """ToolRegistry 인스턴스를 mock engine으로 생성"""
        from sdm.tools import ToolRegistry
        engine = MagicMock()
        registry = ToolRegistry(engine=engine, hall_engine=None)
        return registry

    @patch("sdm.tools.geocode_query")
    def test_rerank_orders_by_distance(self, mock_geocode):
        """거리순으로 재정렬되는지 확인"""
        # 사용자 위치: 강남역 (37.4979, 127.0276)
        mock_geocode.return_value = (37.4979, 127.0276, "강남역")

        registry = self._make_registry()
        # vendor A는 멀리 (부산), B는 가까이 (선릉)
        registry.engine.query_vendors_by_names.return_value = [
            {"name": "A업체", "lat": 35.1796, "lng": 129.0756},  # 부산
            {"name": "B업체", "lat": 37.5046, "lng": 127.0486},  # 선릉
        ]

        reranked, user_coord = registry._rerank_by_distance(
            "강남역 근처", ["A업체", "B업체"]
        )
        assert reranked[0] == "B업체", "가까운 B가 먼저 와야 함"
        assert reranked[1] == "A업체"
        assert user_coord == (37.4979, 127.0276)

    @patch("sdm.tools.geocode_query")
    def test_rerank_no_location(self, mock_geocode):
        """위치 추출 실패 시 원래 순서 유지"""
        mock_geocode.return_value = (None, None, None)

        registry = self._make_registry()
        reranked, user_coord = registry._rerank_by_distance(
            "자연스러운 스튜디오", ["A업체", "B업체"]
        )
        assert reranked == ["A업체", "B업체"]
        assert user_coord is None

    @patch("sdm.tools.geocode_query")
    def test_rerank_vendor_without_coords(self, mock_geocode):
        """좌표 없는 업체는 뒤로"""
        mock_geocode.return_value = (37.4979, 127.0276, "강남역")

        registry = self._make_registry()
        registry.engine.query_vendors_by_names.return_value = [
            {"name": "A업체", "lat": None, "lng": None},  # 좌표 없음
            {"name": "B업체", "lat": 37.5046, "lng": 127.0486},  # 선릉
        ]

        reranked, _ = registry._rerank_by_distance("강남역 근처", ["A업체", "B업체"])
        assert reranked[0] == "B업체"
        assert reranked[1] == "A업체"


# ============================================================
# 4. HallRecord lat/lng 필드 테스트
# ============================================================

class TestHallRecord:
    def test_lat_lng_default_none(self):
        """HallRecord에 lat/lng 필드가 있고 기본값 None"""
        # 동적 import 방지를 위해 여기서 import
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
        from hall.graphrag import HallRecord

        hall = HallRecord(
            partner_id=1, name="테스트홀", region="서울", sub_region="강남구",
            address="서울시 강남구", address_hint="", tel="02-1234-5678",
            rating=4.5, review_count=100, cover_url="", profile_url="",
            profile_text="", min_meal_price=80000, max_meal_price=100000,
            min_rental_price=500000, max_rental_price=800000,
            min_total_price=1000000, max_total_price=2000000,
            tags=["호텔"], style_filters=["밝은"], benefits=["주차"],
            subway_lines=["2호선"], stations=["강남역"],
            walk_minutes=5, memo="테스트", images=[],
        )
        assert hall.lat is None
        assert hall.lng is None

    def test_lat_lng_set(self):
        from hall.graphrag import HallRecord

        hall = HallRecord(
            partner_id=1, name="테스트홀", region="서울", sub_region="강남구",
            address="서울시 강남구", address_hint="", tel="02-1234-5678",
            rating=4.5, review_count=100, cover_url="", profile_url="",
            profile_text="", min_meal_price=80000, max_meal_price=100000,
            min_rental_price=500000, max_rental_price=800000,
            min_total_price=1000000, max_total_price=2000000,
            tags=[], style_filters=[], benefits=[],
            subway_lines=[], stations=[],
            walk_minutes=None, memo="", images=[],
            lat=37.5665, lng=126.9780,
        )
        assert hall.lat == 37.5665
        assert hall.lng == 126.9780

    def test_to_dict_includes_lat_lng(self):
        from hall.graphrag import HallRecord

        hall = HallRecord(
            partner_id=1, name="테스트홀", region="서울", sub_region="",
            address="", address_hint="", tel="", rating=0, review_count=0,
            cover_url="", profile_url="", profile_text="",
            min_meal_price=None, max_meal_price=None,
            min_rental_price=None, max_rental_price=None,
            min_total_price=None, max_total_price=None,
            tags=[], style_filters=[], benefits=[],
            subway_lines=[], stations=[],
            walk_minutes=None, memo="", images=[],
            lat=37.0, lng=127.0,
        )
        d = hall.to_dict()
        assert d["lat"] == 37.0
        assert d["lng"] == 127.0


# ============================================================
# 5. _resolve_hall_coordinate lat/lng 우선 사용 테스트
# ============================================================

class TestResolveHallCoordinate:
    def test_uses_hall_lat_lng_when_present(self):
        """hall.lat/lng가 있으면 geocode 호출 없이 바로 반환"""
        from hall.graphrag import HallGraphRagEngine, HallRecord

        engine = HallGraphRagEngine.__new__(HallGraphRagEngine)
        engine._geo_cache = {}

        hall = HallRecord(
            partner_id=1, name="테스트홀", region="서울", sub_region="강남구",
            address="서울시 강남구", address_hint="", tel="",
            rating=4.5, review_count=100, cover_url="", profile_url="",
            profile_text="", min_meal_price=None, max_meal_price=None,
            min_rental_price=None, max_rental_price=None,
            min_total_price=None, max_total_price=None,
            tags=[], style_filters=[], benefits=[],
            subway_lines=[], stations=[],
            walk_minutes=None, memo="", images=[],
            lat=37.5665, lng=126.9780,
        )

        result = engine._resolve_hall_coordinate(hall)
        assert result == (37.5665, 126.9780)

    def test_falls_back_to_geocode_when_no_lat_lng(self):
        """hall.lat/lng가 None이면 _geocode_place fallback"""
        from hall.graphrag import HallGraphRagEngine, HallRecord

        engine = HallGraphRagEngine.__new__(HallGraphRagEngine)
        engine._geo_cache = {}

        hall = HallRecord(
            partner_id=1, name="테스트홀", region="서울", sub_region="강남구",
            address="서울시 강남구", address_hint="", tel="",
            rating=4.5, review_count=100, cover_url="", profile_url="",
            profile_text="", min_meal_price=None, max_meal_price=None,
            min_rental_price=None, max_rental_price=None,
            min_total_price=None, max_total_price=None,
            tags=[], style_filters=[], benefits=[],
            subway_lines=[], stations=[],
            walk_minutes=None, memo="", images=[],
            lat=None, lng=None,
        )

        with patch.object(engine, "_geocode_place", return_value=(37.5, 127.0)) as mock_geo:
            result = engine._resolve_hall_coordinate(hall)
            assert result == (37.5, 127.0)
            assert mock_geo.called

    def test_returns_none_when_all_fail(self):
        """lat/lng 없고 geocode도 실패하면 None"""
        from hall.graphrag import HallGraphRagEngine, HallRecord

        engine = HallGraphRagEngine.__new__(HallGraphRagEngine)
        engine._geo_cache = {}

        hall = HallRecord(
            partner_id=1, name="테스트홀", region="", sub_region="",
            address="", address_hint="", tel="",
            rating=0, review_count=0, cover_url="", profile_url="",
            profile_text="", min_meal_price=None, max_meal_price=None,
            min_rental_price=None, max_rental_price=None,
            min_total_price=None, max_total_price=None,
            tags=[], style_filters=[], benefits=[],
            subway_lines=[], stations=[],
            walk_minutes=None, memo="", images=[],
            lat=None, lng=None,
        )

        with patch.object(engine, "_geocode_place", return_value=None):
            result = engine._resolve_hall_coordinate(hall)
            assert result is None


# ============================================================
# 6. _build_vendor_list user_coord 호환성 테스트
# ============================================================

class TestBuildVendorList:
    def _make_registry(self):
        from sdm.tools import ToolRegistry
        engine = MagicMock()
        registry = ToolRegistry(engine=engine, hall_engine=None)
        return registry

    def test_without_user_coord(self):
        """user_coord 없이 호출 (기존 호환성)"""
        registry = self._make_registry()
        registry.engine.query_vendors_by_names.return_value = [
            {"name": "A업체", "price": 500000, "tags": ["자연광"], "region": "서울",
             "lat": None, "lng": None},
        ]
        result = registry._build_vendor_list(["A업체"], "studio")
        assert "A업체" in result.data
        assert result.vendors == ["A업체"]
        assert result.result_type == "direct"

    def test_with_user_coord(self):
        """user_coord 전달 시 거리 표시"""
        registry = self._make_registry()
        registry.engine.query_vendors_by_names.return_value = [
            {"name": "A업체", "price": 500000, "tags": ["자연광"], "region": "서울",
             "lat": 37.5046, "lng": 127.0486},
        ]
        result = registry._build_vendor_list(
            ["A업체"], "studio", user_coord=(37.4979, 127.0276)
        )
        assert "km" in result.data, "거리가 표시되어야 함"
        assert "A업체" in result.data

    def test_with_source_name_and_tags(self):
        """연관 추천 모드 (source_name + source_tags)"""
        registry = self._make_registry()
        registry.engine.query_vendors_by_names.return_value = [
            {"name": "B드레스", "price": 600000, "tags": ["클래식", "우아한"], "region": "서울",
             "lat": None, "lng": None},
        ]
        result = registry._build_vendor_list(
            ["B드레스"], "dress",
            source_name="A스튜디오", source_tags=["클래식", "모던"],
        )
        assert "B드레스" in result.data
        assert "A스튜디오" in result.data


# ============================================================
# 7. _VENDOR_QUERY RETURN 절 lat/lng 확인
# ============================================================

class TestVendorQueryLatLng:
    def test_vendor_query_contains_lat_lng(self):
        from sdm.graphrag import SdmGraphRagEngine
        query = SdmGraphRagEngine._VENDOR_QUERY
        assert "v.lat AS lat" in query
        assert "v.lng AS lng" in query


# ============================================================
# 8. build_vector_retrieval_query lat/lng 확인
# ============================================================

class TestBuildVectorRetrievalQuery:
    def test_no_conditions_branch(self):
        """조건 없을 때 RETURN에 lat/lng 포함"""
        from sdm.graphrag import SdmGraphRagEngine
        engine = SdmGraphRagEngine.__new__(SdmGraphRagEngine)
        q = engine.build_vector_retrieval_query()
        assert "v.lat AS lat" in q
        assert "v.lng AS lng" in q

    def test_with_region_condition(self):
        """region 조건 있을 때도 RETURN에 lat/lng 포함"""
        from sdm.graphrag import SdmGraphRagEngine
        engine = SdmGraphRagEngine.__new__(SdmGraphRagEngine)
        q = engine.build_vector_retrieval_query(region="강남")
        assert "v.lat AS lat" in q
        assert "v.lng AS lng" in q

    def test_with_max_price_condition(self):
        """max_price 조건 있을 때도 RETURN에 lat/lng 포함"""
        from sdm.graphrag import SdmGraphRagEngine
        engine = SdmGraphRagEngine.__new__(SdmGraphRagEngine)
        q = engine.build_vector_retrieval_query(max_price=1000000)
        assert "v.lat AS lat" in q
        assert "v.lng AS lng" in q


# ============================================================
# 9. Hall 쿼리 RETURN에 lat/lng 확인
# ============================================================

class TestHallQueryLatLng:
    def test_vector_search_query_has_lat_lng(self):
        from hall.graphrag import HallGraphRagEngine
        q = HallGraphRagEngine._vector_search_query()
        assert "h.lat AS lat" in q
        assert "h.lng AS lng" in q

    def test_search_query_has_lat_lng(self):
        from hall.graphrag import HallGraphRagEngine
        q = HallGraphRagEngine._search_query()
        assert "h.lat AS lat" in q
        assert "h.lng AS lng" in q

    def test_search_query_with_extra_has_lat_lng(self):
        from hall.graphrag import HallGraphRagEngine
        q = HallGraphRagEngine._search_query(where_extra="h.partnerId = 1")
        assert "h.lat AS lat" in q
        assert "h.lng AS lng" in q


# ============================================================
# 10. _row_to_hall lat/lng 매핑 테스트
# ============================================================

class TestRowToHall:
    def test_maps_lat_lng(self):
        from hall.graphrag import HallGraphRagEngine
        row = {
            "partnerId": 1, "name": "테스트홀", "region": "서울",
            "subRegion": "강남구", "address": "서울시 강남구",
            "addressHint": "", "tel": "", "rating": 4.5, "reviewCnt": 100,
            "coverUrl": "", "profileUrl": "", "profileText": "",
            "minMealPrice": 80000, "maxMealPrice": 100000,
            "minRentalPrice": None, "maxRentalPrice": None,
            "minHallPrice": None, "maxHallPrice": None,
            "tags": [], "styleFilters": [], "benefits": [],
            "subwayLines": [], "stations": [],
            "walkMinutes": None, "memo": "", "images": [],
            "lat": 37.5665, "lng": 126.9780,
        }
        hall = HallGraphRagEngine._row_to_hall(row)
        assert hall.lat == 37.5665
        assert hall.lng == 126.9780

    def test_maps_null_lat_lng(self):
        from hall.graphrag import HallGraphRagEngine
        row = {
            "partnerId": 2, "name": "테스트홀2", "region": "서울",
            "subRegion": "", "address": "", "addressHint": "",
            "tel": "", "rating": 0, "reviewCnt": 0,
            "coverUrl": "", "profileUrl": "", "profileText": "",
            "minMealPrice": None, "maxMealPrice": None,
            "minRentalPrice": None, "maxRentalPrice": None,
            "minHallPrice": None, "maxHallPrice": None,
            "tags": [], "styleFilters": [], "benefits": [],
            "subwayLines": [], "stations": [],
            "walkMinutes": None, "memo": "", "images": [],
            "lat": None, "lng": None,
        }
        hall = HallGraphRagEngine._row_to_hall(row)
        assert hall.lat is None
        assert hall.lng is None
