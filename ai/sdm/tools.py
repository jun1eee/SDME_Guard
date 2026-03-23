"""통합 웨딩 챗봇 Tool — 8개 tool, 명확한 역할 분리"""
import json
import re
import requests as http_requests
from dataclasses import dataclass
from typing import Any

from config import settings
from sdm.graphrag import SdmGraphRagEngine, NO_RESULT_PHRASES


@dataclass
class ToolResult:
    result_type: str  # "graphrag" | "raw" | "direct"
    data: str
    vendors: list[str]


# ── 지오코딩 유틸 ──

def _extract_location(query: str) -> str | None:
    # 1순위: 역/동/구 등 접미사
    m = re.search(r"(\S+(?:역|동|구|시|읍|면|리|타워|호텔|건물|집|정류장|빌딩|아파트))", query)
    if m:
        return m.group(1)
    # 2순위: "~와/과/이랑/에서 가까운/근처" 패턴 (조사 제거)
    m = re.search(r"(\S+?)(?:와|과|이랑|에서|의|은|는|을|를)?\s*(?:근처|가까운|주변|쪽|부근|인근)", query)
    if m:
        return m.group(1)
    return None


# 런타임 캐시 (API 성공 결과 저장 — 하드코딩 아님)
_geocode_cache: dict[str, tuple[float, float]] = {}


def _get_kakao_keys() -> list[str]:
    """사용 가능한 카카오 API 키 목록"""
    import os
    keys = []
    for name in ["KAKAO_API_KEY", "KAKAO_REST_API_KEY2", "KAKAO_REST_API_KEY3",
                  "KAKAO_REST_API_KEY4", "KAKAO_REST_API_KEY5",
                  "KAKAO_REST_API_KEY6", "KAKAO_REST_API_KEY7"]:
        k = os.environ.get(name, "").strip()
        if k:
            keys.append(k)
    return keys


def geocode_query(query: str) -> tuple:
    """위치 추출 → 카카오 API 지오코딩 (키 로테이션, 런타임 캐시)"""
    location = _extract_location(query)
    if not location:
        return None, None, None

    # 1순위: 런타임 캐시
    if location in _geocode_cache:
        lat, lng = _geocode_cache[location]
        return lat, lng, location

    # 2순위: 카카오 API (키 로테이션)
    keys = _get_kakao_keys()
    if not keys:
        return None, None, None

    for key in keys:
        try:
            resp = http_requests.get(
                "https://dapi.kakao.com/v2/local/search/keyword.json",
                params={"query": location, "size": 1},
                headers={"Authorization": f"KakaoAK {key}"},
                timeout=3,
            )
            if resp.status_code == 429:
                continue  # 다음 키 시도
            if resp.status_code in (401, 403):
                continue  # 권한 없는 키 건너뜀
            if resp.status_code == 200:
                docs = resp.json().get("documents", [])
                if docs:
                    lat, lng = float(docs[0]["y"]), float(docs[0]["x"])
                    _geocode_cache[location] = (lat, lng)
                    return lat, lng, docs[0].get("place_name", location)
                return None, None, None
        except Exception:
            continue
    return None, None, None


def _dedup_vendors(records: list[dict]) -> list[dict]:
    """같은 이름 업체를 하나로 합침. 가격은 범위로 표시."""
    seen: dict[str, dict] = {}
    for r in records:
        name = r.get("name", "")
        if not name:
            continue
        if name in seen:
            existing = seen[name]
            # 가격 범위 합침
            ep = existing.get("price") or 0
            rp = r.get("price") or 0
            if ep and rp and ep != rp:
                existing["priceMin"] = min(existing.get("priceMin", ep), rp)
                existing["priceMax"] = max(existing.get("priceMax", ep), rp)
            # 태그 합침
            existing_tags = set(existing.get("tags") or [])
            new_tags = set(r.get("tags") or [])
            existing["tags"] = list(existing_tags | new_tags)[:8]
        else:
            price = r.get("price") or 0
            r["priceMin"] = price
            r["priceMax"] = price
            seen[name] = r
    return list(seen.values())


def _extract_count(query: str, default: int = 5, maximum: int = 20) -> int:
    m = re.search(r"(\d{1,2})\s*(?:개|곳|군데)", query)
    return min(int(m.group(1)), maximum) if m else default


def _search_nearest(driver, node_label: str, category: str | None, lat: float, lng: float, limit: int = 5) -> list[dict]:
    """좌표 기반 가까운 업체/홀 검색 (Vendor/Hall 통합)"""
    if node_label == "Hall":
        cypher = """
            MATCH (h:Hall) WHERE h.location IS NOT NULL
            WITH h, point.distance(h.location, point({latitude: $lat, longitude: $lng})) AS dist
            ORDER BY dist ASC LIMIT $limit
            RETURN h.name AS name, 'hall' AS category, h.region AS region,
                   h.address AS address, h.tel AS tel, h.rating AS rating,
                   h.profileUrl AS url, round(dist) AS distanceMeters
        """
        with driver.session() as session:
            return session.run(cypher, lat=lat, lng=lng, limit=limit).data()
    else:
        cypher = """
            MATCH (v:Vendor {category: $cat}) WHERE v.location IS NOT NULL
            WITH v, point.distance(v.location, point({latitude: $lat, longitude: $lng})) AS dist
            ORDER BY dist ASC LIMIT $limit
            OPTIONAL MATCH (v)-[:HAS_TAG]->(t:Tag)
            WITH v, dist, collect(DISTINCT t.name) AS tags
            RETURN v.name AS name, v.category AS category,
                   v.salePrice AS price, v.rating AS rating,
                   v.address AS address, v.profileUrl AS url, v.tel AS tel,
                   round(dist) AS distanceMeters, tags
        """
        with driver.session() as session:
            return session.run(cypher, cat=category, lat=lat, lng=lng, limit=limit).data()


# ── Tool Schema (8개) ──

TOOLS_SCHEMA = [
    # 1. 통합 검색 (스드메 + 웨딩홀)
    {"type": "function", "function": {
        "name": "search",
        "description": "웨딩 업체/웨딩홀 검색. 가격, 지역, 태그, 스타일 등 모든 조건 검색. category에 'hall'을 넣으면 웨딩홀 검색.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "사용자 원문 그대로"},
            "category": {"type": "string", "enum": ["studio", "dress", "makeup", "hall"],
                         "description": "studio=스튜디오, dress=드레스, makeup=메이크업, hall=웨딩홀/예식장"},
        }, "required": ["query", "category"]},
    }},
    # 2. 스타일/분위기 검색
    {"type": "function", "function": {
        "name": "search_style",
        "description": "스타일, 분위기, 느낌 등 추상적 표현으로 업체 검색. '자연스러운', '모던한', '화려한' 등.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "스타일/분위기 설명"},
            "category": {"type": "string", "enum": ["studio", "dress", "makeup"]},
            "region": {"type": "string", "description": "지역 (선택)"},
            "max_price": {"type": "integer", "description": "최대 가격 (선택)"},
        }, "required": ["query", "category"]},
    }},
    # 3. 위치 기반 검색
    {"type": "function", "function": {
        "name": "search_nearby",
        "description": "특정 위치(역, 동, 지역) 근처의 가까운 업체/홀 검색. '~역 근처', '~동 주변' 등.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "사용자 원문 그대로"},
            "category": {"type": "string", "enum": ["studio", "dress", "makeup", "hall"]},
            "count": {"type": "integer", "description": "결과 수 (기본 5)"},
        }, "required": ["query", "category"]},
    }},
    # 4. 연관 추천 (cross-category)
    {"type": "function", "function": {
        "name": "search_related",
        "description": "특정 업체/홀과 어울리는 다른 카테고리 추천. '~와 어울리는', '~에 맞는', '~과 비슷한 느낌의' 등.",
        "parameters": {"type": "object", "properties": {
            "source_name": {"type": "string", "description": "기준 업체/홀 이름"},
            "target_category": {"type": "string", "enum": ["studio", "dress", "makeup", "hall"],
                                "description": "추천받을 카테고리"},
        }, "required": ["source_name", "target_category"]},
    }},
    # 5. 상세 조회
    {"type": "function", "function": {
        "name": "get_detail",
        "description": "특정 업체/웨딩홀의 상세 정보 조회. 패키지, 리뷰, 태그, 연락처 등.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string", "description": "업체/홀 이름"},
        }, "required": ["name"]},
    }},
    # 6. 비교
    {"type": "function", "function": {
        "name": "compare",
        "description": "2개 이상 업체/홀을 비교. 가격, 평점, 특징 등을 비교.",
        "parameters": {"type": "object", "properties": {
            "names": {"type": "array", "items": {"type": "string"}, "description": "비교할 업체/홀 이름들"},
            "criteria": {"type": "string", "description": "비교 기준 (선택)"},
        }, "required": ["names"]},
    }},
    # 7. 필터/정렬
    {"type": "function", "function": {
        "name": "filter_sort",
        "description": "이전 추천 결과에서 필터링, 정렬, 개수 제한. '이중에서', '가격순', '평점순' 등.",
        "parameters": {"type": "object", "properties": {
            "names": {"type": "array", "items": {"type": "string"}, "description": "대상 업체/홀 이름들"},
            "condition": {"type": "string", "description": "필터/정렬 조건"},
            "count": {"type": "integer", "description": "결과 수 제한 (선택)"},
        }, "required": ["names", "condition"]},
    }},
    # 8. 사용자 정보
    {"type": "function", "function": {
        "name": "get_user_info",
        "description": "사용자의 취향, 선호도, 찜 목록을 조회.",
        "parameters": {"type": "object", "properties": {
            "info_type": {"type": "string", "enum": ["preference", "likes", "all"],
                          "description": "preference=취향, likes=찜목록, all=전체"},
        }, "required": ["info_type"]},
    }},
]


# ── Tool Registry ──

class ToolRegistry:
    def __init__(self, engine: SdmGraphRagEngine, hall_engine=None) -> None:
        self.engine = engine
        self.hall_engine = hall_engine
        self.tool_map = {
            "search": self.search,
            "search_style": self.search_style,
            "search_nearby": self.search_nearby,
            "search_related": self.search_related,
            "get_detail": self.get_detail,
            "compare": self.compare,
            "filter_sort": self.filter_sort,
            "get_user_info": self.get_user_info,
        }

    def execute(self, tool_name: str, couple_id: int, **kwargs: Any) -> ToolResult:
        fn = self.tool_map.get(tool_name)
        if not fn:
            return ToolResult(result_type="direct", data=f"알 수 없는 tool: {tool_name}", vendors=[])
        return fn(couple_id=couple_id, **kwargs)

    # ── 1. search: 통합 검색 ──

    def search(self, query: str, category: str, couple_id: int, **_) -> ToolResult:
        if category == "hall":
            return self._search_hall(query)
        # 스드메: Text2Cypher 검색
        answer, vendors = self.engine.search_structured(query=query, category=category)
        # 결과 없으면 거리 기반 fallback
        if answer and any(p in answer for p in NO_RESULT_PHRASES):
            lat, lng, _ = geocode_query(query)
            count = _extract_count(query)
            if lat and lng and self.engine.driver:
                records = _search_nearest(self.engine.driver, "Vendor", category, lat, lng, limit=count * 2)
                if records:
                    self._add_distance_text(records)
                    records = _dedup_vendors(records)[:count]
                    return ToolResult(result_type="raw",
                                     data=json.dumps(records, ensure_ascii=False, default=str),
                                     vendors=[r["name"] for r in records])
        return ToolResult(result_type="graphrag", data=answer, vendors=vendors)

    def _search_hall(self, query: str) -> ToolResult:
        if not self.hall_engine or not self.hall_engine.driver:
            return ToolResult(result_type="direct", data="웨딩홀 서비스가 준비되지 않았습니다.", vendors=[])
        from hall.graphrag import HallCriteria
        criteria = HallCriteria()
        count = _extract_count(query)
        halls = self.hall_engine.search(query=query, criteria=criteria, limit=count)
        if not halls:
            return ToolResult(result_type="direct", data="해당 조건의 웨딩홀을 찾지 못했습니다.", vendors=[])
        records = [self._hall_to_dict(h) for h in halls]
        return ToolResult(result_type="raw",
                          data=json.dumps(records, ensure_ascii=False, default=str),
                          vendors=[h.name for h in halls])

    # ── 2. search_style: 스타일 검색 ──

    def search_style(self, query: str, category: str, couple_id: int,
                     region: str = None, max_price: int = None, **_) -> ToolResult:
        answer, vendors = self.engine.search_semantic(
            query=query, category=category, region=region, max_price=max_price,
        )
        return ToolResult(result_type="graphrag", data=answer, vendors=vendors)

    # ── 3. search_nearby: 위치 기반 검색 ──

    def search_nearby(self, query: str, category: str, couple_id: int, count: int = 5, **_) -> ToolResult:
        lat, lng, place = geocode_query(query)
        if not lat or not lng:
            return ToolResult(result_type="direct",
                              data="위치를 찾을 수 없습니다. 역 이름이나 동 이름을 포함해서 다시 질문해주세요.", vendors=[])
        count = min(count, 20)
        node_label = "Hall" if category == "hall" else "Vendor"
        driver = self.hall_engine.driver if category == "hall" and self.hall_engine else self.engine.driver
        if not driver:
            return ToolResult(result_type="direct", data="DB 연결이 없습니다.", vendors=[])
        records = _search_nearest(driver, node_label, category, lat, lng, limit=count * 2)  # 중복 대비 여유
        if not records:
            return ToolResult(result_type="direct", data=f"{place} 근처에서 업체를 찾지 못했습니다.", vendors=[])
        self._add_distance_text(records)
        records = _dedup_vendors(records)[:count]
        return ToolResult(result_type="raw",
                          data=json.dumps(records, ensure_ascii=False, default=str),
                          vendors=[r["name"] for r in records])

    # ── 4. search_related: 연관 추천 ──

    def search_related(self, source_name: str, target_category: str, couple_id: int, **_) -> ToolResult:
        query_text = ""
        region_hint = ""
        # Vendor에서 태그 조회
        records = self.engine.query_vendors_by_names([source_name])
        if records:
            tags = records[0].get("tags", [])
            region_hint = records[0].get("region", "")
            query_text = f"{source_name} {' '.join(tags[:8])}"
        # Hall에서 태그/지역 조회
        elif self.hall_engine:
            hall = self.hall_engine.get_hall_details(source_name)
            if hall:
                region_hint = hall.region
                # Hall 태그는 스드메 검색에 부적합할 수 있으므로, 스타일 필터 + 지역 위주
                style_info = ' '.join(hall.style_filters[:5])
                query_text = f"{hall.region} {style_info} 웨딩" if style_info else f"{hall.region} 웨딩"
        if not query_text:
            query_text = source_name

        if target_category == "hall":
            return self._search_hall(query_text)
        answer, vendors = self.engine.search_semantic(
            query=query_text, category=target_category, region=region_hint or None,
        )
        if not vendors:
            vendors = self.engine._extract_vendors_from_bold(answer)
        return ToolResult(result_type="graphrag", data=answer, vendors=vendors)

    # ── 5. get_detail: 상세 조회 ──

    def get_detail(self, name: str, couple_id: int, **_) -> ToolResult:
        # Vendor 먼저
        records = self.engine.query_vendors_by_names([name])
        if records:
            return ToolResult(result_type="raw",
                              data=json.dumps(records, ensure_ascii=False, default=str),
                              vendors=[name])
        # Hall
        if self.hall_engine:
            hall = self.hall_engine.get_hall_details(name)
            if hall:
                record = self._hall_to_dict(hall)
                return ToolResult(result_type="raw",
                                  data=json.dumps(record, ensure_ascii=False, default=str),
                                  vendors=[name])
        return ToolResult(result_type="direct", data=f"'{name}'에 대한 정보를 찾지 못했습니다.", vendors=[])

    # ── 6. compare: 비교 ──

    def compare(self, names: list[str], couple_id: int, criteria: str = None, **_) -> ToolResult:
        records = self.engine.query_vendors_by_names(names)
        # Hall도 검색
        if self.hall_engine:
            for n in names:
                if not any(r.get("name") == n for r in records):
                    hall = self.hall_engine.get_hall_details(n)
                    if hall:
                        records.append(self._hall_to_dict(hall))
        return ToolResult(result_type="raw",
                          data=json.dumps(records, ensure_ascii=False, default=str),
                          vendors=list(dict.fromkeys(r.get("name", "") for r in records)))

    # ── 7. filter_sort: 필터/정렬 ──

    def filter_sort(self, names: list[str], condition: str, couple_id: int, count: int = None, **_) -> ToolResult:
        records = self.engine.query_vendors_by_names(names)
        if self.hall_engine:
            for n in names:
                if not any(r.get("name") == n for r in records):
                    hall = self.hall_engine.get_hall_details(n)
                    if hall:
                        records.append(self._hall_to_dict(hall))
        return ToolResult(result_type="raw",
                          data=json.dumps(records, ensure_ascii=False, default=str),
                          vendors=list(dict.fromkeys(r.get("name", "") for r in records)))

    # ── 8. get_user_info: 사용자 정보 ──

    def get_user_info(self, info_type: str, couple_id: int, **_) -> ToolResult:
        parts = []
        if info_type in ("preference", "all"):
            pref = self.engine.get_user_preference(couple_id)
            lines = [f"- {k}: {v}" for k, v in pref.items() if k != "couple_id" and v]
            parts.append("취향 정보:\n" + "\n".join(lines))
        if info_type in ("likes", "all"):
            likes = self.engine.get_user_likes(couple_id)
            if likes:
                lines = [f"- {l.get('name', '알수없음')} ({l.get('category', '')})" for l in likes]
                parts.append(f"찜 목록 ({len(likes)}건):\n" + "\n".join(lines))
            else:
                parts.append("찜 목록: 없음")
        return ToolResult(result_type="direct", data="\n\n".join(parts), vendors=[])

    # ── 유틸 ──

    @staticmethod
    def _add_distance_text(records):
        for r in records:
            d = r.get("distanceMeters", 0)
            r["distanceText"] = f"{d / 1000:.1f}km" if d >= 1000 else f"{int(d)}m"

    @staticmethod
    def _hall_to_dict(h) -> dict:
        return {
            "name": h.name, "category": "hall", "region": h.region,
            "subRegion": h.sub_region, "address": h.address,
            "addressHint": h.address_hint, "tel": h.tel,
            "rating": h.rating, "reviewCnt": h.review_count,
            "minMealPrice": h.min_meal_price, "maxMealPrice": h.max_meal_price,
            "minTotalPrice": h.min_total_price, "maxTotalPrice": h.max_total_price,
            "tags": h.tags, "styles": h.style_filters, "benefits": h.benefits[:3],
            "stations": h.stations, "walkMinutes": h.walk_minutes,
            "profileUrl": h.profile_url, "coverUrl": h.cover_url,
        }
