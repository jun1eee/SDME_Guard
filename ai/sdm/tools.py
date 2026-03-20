import json
import re
import requests as http_requests
from dataclasses import dataclass
from typing import Any

from config import settings
from sdm.graphrag import SdmGraphRagEngine, NO_RESULT_PHRASES


@dataclass
class ToolResult:
    result_type: str
    data: str
    vendors: list[str]


# ── 지오코딩 (ai-dc) ──

def _extract_location(query: str) -> str | None:
    """쿼리에서 위치 키워드 추출"""
    m = re.search(r"(\S+(?:역|동|구|시|읍|면|리|타워|빌딩|아파트))", query)
    if m:
        return m.group(1)
    m = re.search(r"(\S+)\s*(?:근처|가까운|주변|쪽|부근|인근)", query)
    if m:
        return m.group(1)
    return None


# 주요 지역 좌표 캐시 (API 장애/한도 초과 시 fallback)
_LOCATION_CACHE = {
    "강남역": (37.4979, 127.0276), "역삼역": (37.5007, 127.0365),
    "선릉역": (37.5045, 127.0491), "삼성역": (37.5089, 127.0637),
    "잠실역": (37.5133, 127.1001), "송파역": (37.5048, 127.1127),
    "가좌역": (37.5687, 126.9148), "홍대입구역": (37.5571, 126.9244),
    "신촌역": (37.5551, 126.9366), "합정역": (37.5496, 126.9138),
    "건대입구역": (37.5404, 127.0694), "왕십리역": (37.5614, 127.0380),
    "청담역": (37.5178, 127.0530), "압구정역": (37.5270, 127.0284),
    "논현역": (37.5118, 127.0215), "신사역": (37.5163, 127.0199),
    "강남": (37.4979, 127.0276), "역삼": (37.5007, 127.0365),
    "잠실": (37.5133, 127.1001), "송파": (37.5048, 127.1127),
    "청담": (37.5178, 127.0530), "논현": (37.5118, 127.0215),
    "신사": (37.5163, 127.0199), "홍대": (37.5571, 126.9244),
    "성수": (37.5445, 127.0564), "가좌": (37.5687, 126.9148),
    "경복궁역": (37.5759, 126.9738), "기흥역": (37.2755, 127.1170),
    "수원역": (37.2658, 127.0002), "판교역": (37.3948, 127.1112),
}


def geocode_query(query: str) -> tuple:
    """사용자 입력에서 위치 추출 → 캐시 or 카카오맵 지오코딩. (lat, lng, place_name)"""
    location = _extract_location(query)
    if not location:
        return None, None, None

    # 1순위: 로컬 캐시
    if location in _LOCATION_CACHE:
        lat, lng = _LOCATION_CACHE[location]
        return lat, lng, location

    # 2순위: 카카오맵 API
    if not settings.kakao_api_key:
        return None, None, None
    try:
        resp = http_requests.get(
            "https://dapi.kakao.com/v2/local/search/keyword.json",
            params={"query": location, "size": 1},
            headers={"Authorization": f"KakaoAK {settings.kakao_api_key}"},
            timeout=3,
        )
        if resp.status_code == 200:
            docs = resp.json().get("documents", [])
            if docs:
                lat, lng = float(docs[0]["y"]), float(docs[0]["x"])
                _LOCATION_CACHE[location] = (lat, lng)  # 캐시 추가
                return lat, lng, docs[0].get("place_name", location)
    except Exception:
        pass
    return None, None, None


def search_nearest_vendors(driver, category: str, lat: float, lng: float, limit: int = 5) -> list[dict]:
    """좌표 기반 가장 가까운 업체 검색"""
    with driver.session() as session:
        return session.run("""
            MATCH (v:Vendor {category: $cat})
            WHERE v.location IS NOT NULL
            WITH v, point.distance(v.location, point({latitude: $lat, longitude: $lng})) AS dist
            ORDER BY dist ASC LIMIT $limit
            OPTIONAL MATCH (v)-[:HAS_TAG]->(t:Tag)
            WITH v, dist, collect(DISTINCT t.name) AS tags
            RETURN v.name AS name, v.category AS category,
                   v.salePrice AS price, v.rating AS rating,
                   v.address AS address, v.profileUrl AS url,
                   round(dist) AS distanceMeters, tags
        """, cat=category, lat=lat, lng=lng, limit=limit).data()


# ── Tool Schema ──

TOOLS_SCHEMA = [
    {"type": "function", "function": {
        "name": "search_structured",
        "description": "가격, 지역, 태그 같은 구조적 조건으로 스드메 업체를 검색합니다.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string"},
            "category": {"type": "string", "enum": ["studio", "dress", "makeup"]},
        }, "required": ["query", "category"]},
    }},
    {"type": "function", "function": {
        "name": "search_semantic",
        "description": "스타일, 분위기, 느낌 같은 추상 조건으로 스드메 업체를 검색합니다.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string"},
            "category": {"type": "string", "enum": ["studio", "dress", "makeup"]},
            "region": {"type": "string"},
            "max_price": {"type": "integer"},
            "min_price": {"type": "integer"},
        }, "required": ["query", "category"]},
    }},
    {"type": "function", "function": {
        "name": "compare_vendors",
        "description": "이전에 언급된 업체들을 비교합니다.",
        "parameters": {"type": "object", "properties": {
            "vendor_names": {"type": "array", "items": {"type": "string"}},
            "criteria": {"type": "string"},
        }, "required": ["vendor_names"]},
    }},
    {"type": "function", "function": {
        "name": "filter_previous",
        "description": "이전 추천 결과에서 재정렬하거나 필터링합니다.",
        "parameters": {"type": "object", "properties": {
            "vendor_names": {"type": "array", "items": {"type": "string"}},
            "condition": {"type": "string"},
            "count": {"type": "integer"},
        }, "required": ["vendor_names", "condition"]},
    }},
    {"type": "function", "function": {
        "name": "get_vendor_detail",
        "description": "특정 업체의 상세 정보를 조회합니다.",
        "parameters": {"type": "object", "properties": {
            "vendor_name": {"type": "string"},
        }, "required": ["vendor_name"]},
    }},
    {"type": "function", "function": {
        "name": "search_related",
        "description": "업체와 어울리는 다른 카테고리 추천. '~와 어울리는', '~에 맞는', '~와 잘맞는' 표현이 있고 target이 현재 카테고리와 다를 때 반드시 사용. 예: 스튜디오→드레스, 드레스→메이크업",
        "parameters": {"type": "object", "properties": {
            "source_vendor": {"type": "string", "description": "기준 업체명 (없으면 빈 문자열)"},
            "source_style": {"type": "string", "description": "기준 스타일/조건 (업체명 없을 때)"},
            "target_category": {"type": "string", "enum": ["studio", "dress", "makeup"], "description": "추천받을 카테고리"},
        }, "required": ["target_category"]},
    }},
    {"type": "function", "function": {
        "name": "get_user_preference",
        "description": "사용자 선호도를 조회합니다.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_user_likes",
        "description": "사용자 찜 목록을 조회합니다.",
        "parameters": {"type": "object", "properties": {}},
    }},
]


# ── Tool Registry ──

class SdmToolRegistry:
    def __init__(self, engine: SdmGraphRagEngine) -> None:
        self.engine = engine
        self.tool_map = {
            "search_structured": self.search_structured,
            "search_semantic": self.search_semantic,
            "search_related": self.search_related,
            "compare_vendors": self.compare_vendors,
            "filter_previous": self.filter_previous,
            "get_vendor_detail": self.get_vendor_detail,
            "get_user_preference": self.get_user_preference,
            "get_user_likes": self.get_user_likes,
        }

    def execute(self, tool_name: str, couple_id: int, **kwargs: Any) -> ToolResult:
        return self.tool_map[tool_name](couple_id=couple_id, **kwargs)

    def search_structured(self, query: str, category: str, couple_id: int, **_) -> ToolResult:
        answer, vendors = self.engine.search_structured(query=query, category=category)
        # 결과 없으면 거리 기반 fallback (ai-dc)
        if answer and any(p in answer for p in NO_RESULT_PHRASES):
            lat, lng, place = geocode_query(query)
            if lat and lng and self.engine.driver:
                records = search_nearest_vendors(self.engine.driver, category, lat, lng)
                if records:
                    for r in records:
                        d = r.get("distanceMeters", 0)
                        r["distanceText"] = f"{d/1000:.1f}km" if d >= 1000 else f"{int(d)}m"
                    return ToolResult(
                        result_type="raw",
                        data=json.dumps(records, ensure_ascii=False, default=str),
                        vendors=[r["name"] for r in records],
                    )
        return ToolResult(result_type="graphrag", data=answer, vendors=vendors)

    def search_semantic(self, query: str, category: str, couple_id: int,
                        region=None, max_price=None, min_price=None, **_) -> ToolResult:
        answer, vendors = self.engine.search_semantic(
            query=query, category=category, region=region, max_price=max_price, min_price=min_price,
        )
        return ToolResult(result_type="graphrag", data=answer, vendors=vendors)

    def search_related(self, target_category: str, couple_id: int,
                       source_vendor: str = "", source_style: str = "", **_) -> ToolResult:
        """업체명 또는 스타일 기준으로 다른 카테고리 업체 추천"""
        query_text = ""
        if source_vendor:
            records = self.engine.query_vendors_by_names([source_vendor])
            if records:
                tags = records[0].get("tags", [])
                query_text = f"{source_vendor} {' '.join(tags[:8])}"
            else:
                query_text = source_vendor
        elif source_style:
            query_text = source_style
        if not query_text:
            return ToolResult(result_type="direct", data="기준 업체 또는 스타일을 알려주세요.", vendors=[])
        answer, vendors = self.engine.search_semantic(query=query_text, category=target_category)
        if not vendors:
            vendors = self.engine._extract_vendors_from_bold(answer)
        return ToolResult(result_type="graphrag", data=answer, vendors=vendors)

    def compare_vendors(self, vendor_names: list[str], couple_id: int, criteria=None, **_) -> ToolResult:
        records = self.engine.query_vendors_by_names(vendor_names)
        return ToolResult(
            result_type="raw",
            data=json.dumps(records, ensure_ascii=False, default=str),
            vendors=list(dict.fromkeys(r["name"] for r in records)),
        )

    def filter_previous(self, vendor_names: list[str], condition: str, couple_id: int, count=None, **_) -> ToolResult:
        records = self.engine.query_vendors_by_names(vendor_names)
        return ToolResult(
            result_type="raw",
            data=json.dumps(records, ensure_ascii=False, default=str),
            vendors=list(dict.fromkeys(r["name"] for r in records)),
        )

    def get_vendor_detail(self, vendor_name: str, couple_id: int, **_) -> ToolResult:
        records = self.engine.query_vendors_by_names([vendor_name])
        return ToolResult(
            result_type="raw",
            data=json.dumps(records, ensure_ascii=False, default=str),
            vendors=[vendor_name],
        )

    def get_user_preference(self, couple_id: int, **_) -> ToolResult:
        pref = self.engine.get_user_preference(couple_id)
        lines = [f"- {k}: {v}" for k, v in pref.items() if k != "couple_id" and v]
        return ToolResult(result_type="direct", data="현재 저장된 취향 정보입니다.\n" + "\n".join(lines), vendors=[])

    def get_user_likes(self, couple_id: int, **_) -> ToolResult:
        likes = self.engine.get_user_likes(couple_id)
        if likes:
            lines = [f"- {l.get('name', '알수없음')} ({l.get('category', '')})" for l in likes]
            return ToolResult(result_type="direct", data=f"좋아요한 업체가 {len(likes)}건 있습니다.\n" + "\n".join(lines), vendors=[])
        return ToolResult(result_type="direct", data="좋아요한 업체가 없습니다.", vendors=[])
