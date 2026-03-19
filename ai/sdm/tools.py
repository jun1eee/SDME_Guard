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


def geocode_query(query: str) -> tuple:
    """사용자 입력에서 위치 추출 → 카카오맵 지오코딩. (lat, lng, place_name)"""
    if not settings.kakao_api_key:
        return None, None, None
    location = _extract_location(query)
    if not location:
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
                return float(docs[0]["y"]), float(docs[0]["x"]), docs[0].get("place_name", location)
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
