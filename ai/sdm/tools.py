"""통합 웨딩 챗봇 Tool — 16개 tool, 명확한 역할 분리"""
import json
import re
import requests as http_requests
from dataclasses import dataclass
from typing import Any

from config import settings
from sdm.graphrag import SdmGraphRagEngine, NO_RESULT_PHRASES
from sdm.knowledge import (
    WEDDING_KB, _get_venue_size_guide, _get_meal_cost_guide, _get_guest_estimate_guide,
)
from sdm.budget import allocate_budget, get_hidden_costs, HIDDEN_COSTS


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


# 카테고리별 방문 소요시간 (분)
VISIT_DURATION = {
    "hall":    {"tour": 60, "fitting": 60},
    "studio":  {"tour": 60, "fitting": 150},
    "dress":   {"tour": 60, "fitting": 90},
    "makeup":  {"tour": 60, "fitting": 60},
    "unknown": {"tour": 60, "fitting": 60},
}

# 프로모션/무의미 태그 필터
_PROMO_PATTERN = re.compile(
    r"할인|특가|이벤트|인★|인기.*%|최대\d+%|스드메특가|"
    r"^\d+만원|^\d+~\d+만원|^\d+개월|^\d+~\d+시간|"
    r"^서울$|^경기$|^인천$|^부산$"
)

def _filter_tags(tags: list[str]) -> list[str]:
    """프로모션, 가격대, 지역명 등 무의미 태그 제거"""
    return [t for t in tags if not _PROMO_PATTERN.search(t)]


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


# ── Tool Schema (16개) ──

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
    # 4. 상세 조회 + 연관 추천 (통합)
    {"type": "function", "function": {
        "name": "get_detail",
        "description": "특정 업체/웨딩홀의 상세 정보 조회 또는 연관 추천. 상세 조회, 어울리는 업체, 비슷한 업체 모두 이 tool 사용.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string", "description": "업체/홀 이름"},
            "related_category": {
                "type": "string",
                "enum": ["studio", "dress", "makeup", "hall"],
                "description": "연관 추천할 카테고리 (선택). '어울리는 드레스' -> dress, '비슷한 스튜디오' -> studio. 상세 조회만 할 때는 비워두세요.",
            },
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
    # 9. 웨딩홀/업체 투어 계획 (홀+스드메 통합)
    {"type": "function", "function": {
        "name": "plan_tour",
        "description": "웨딩홀/스튜디오/드레스/메이크업 업체 투어 동선 계획. 모든 카테고리 가능. 출발지, 교통수단, 방문 목적을 사용자에게 확인 후 호출.",
        "parameters": {"type": "object", "properties": {
            "venue_names": {"type": "array", "items": {"type": "string"},
                            "description": "투어할 업체/웨딩홀 이름 목록 (카테고리 무관)"},
            "start_location": {"type": "string", "description": "출발 위치 (예: 강남역). 필수."},
            "transport": {"type": "string", "enum": ["car", "transit", "walk"],
                          "description": "이동 수단. 필수."},
            "visit_type": {"type": "string", "enum": ["tour", "fitting"],
                           "description": "tour=단순 견학(1시간), fitting=피팅/테스트(카테고리별 상이). 필수."},
            "end_location": {"type": "string", "description": "귀가 위치 (미지정 시 출발지, 선택)"},
        }, "required": ["venue_names", "start_location", "transport", "visit_type"]},
    }},
    # 10. 투어 수정
    {"type": "function", "function": {
        "name": "modify_tour",
        "description": "이전 투어 동선 수정. 순서 변경, 업체 추가/제거. '순서 바꿔', '빼줘', '추가해줘' 등.",
        "parameters": {"type": "object", "properties": {
            "action": {"type": "string", "enum": ["swap", "remove", "add"],
                       "description": "swap=순서 교체, remove=업체 제거, add=업체 추가"},
            "index_a": {"type": "integer", "description": "swap: 첫번째 인덱스 (0부터)"},
            "index_b": {"type": "integer", "description": "swap: 두번째 인덱스 (0부터)"},
            "index": {"type": "integer", "description": "remove: 제거할 인덱스 (0부터)"},
            "venue_name": {"type": "string", "description": "add: 추가할 업체명"},
        }, "required": ["action"]},
    }},
    # 10. 웨딩 상식/지식 Q&A
    {"type": "function", "function": {
        "name": "knowledge_qa",
        "description": "웨딩 상식/예절/관습 Q&A. 축의금, 폐백, 결혼식 순서, 예물/예단, 혼인신고, 신혼여행, 웨딩카, 식사(뷔페/코스) 등. 업체 검색이 아닌 지식/정보 질문에 사용.",
        "parameters": {"type": "object", "properties": {
            "topic": {"type": "string",
                      "enum": ["gift_money", "paebaek", "ceremony_order", "wedding_gifts",
                               "honeymoon", "registration", "wedding_car", "catering", "general"],
                      "description": "질문 주제"},
            "query": {"type": "string", "description": "사용자 질문 원문"},
        }, "required": ["topic", "query"]},
    }},
    # 11. 하객 수 기반 계산
    {"type": "function", "function": {
        "name": "guest_calc",
        "description": "하객 수 기반 계산. 홀 규모 추천, 식대 총액 계산, 하객수 추정 가이드. 숫자 계산이 필요한 하객 관련 질문.",
        "parameters": {"type": "object", "properties": {
            "calc_type": {"type": "string", "enum": ["venue_size", "meal_cost", "guest_estimate"],
                          "description": "venue_size=홀 규모 추천, meal_cost=식대 총액 계산, guest_estimate=하객수 추정 가이드"},
            "guest_count": {"type": "integer", "description": "하객 수 (venue_size, meal_cost에 필요)"},
            "meal_price": {"type": "integer", "description": "인당 식대 (meal_cost에 필요, 기본 80000원)"},
        }, "required": ["calc_type"]},
    }},
    # 12. 결혼 준비 타임라인
    {"type": "function", "function": {
        "name": "get_timeline",
        "description": "결혼 준비 타임라인/일정 조회. 전체 일정, 현재 해야 할 일, 카테고리별 예약 마감일. '일정', '언제까지', '뭐 해야 돼' 등.",
        "parameters": {"type": "object", "properties": {
            "scope": {"type": "string", "enum": ["full", "current", "monthly", "category_deadline"],
                      "description": "full=전체 일정, current=지금 할 일, monthly=이번달, category_deadline=카테고리 마감일"},
            "category": {"type": "string", "enum": ["studio", "dress", "makeup", "hall"],
                         "description": "카테고리 마감일 조회 시 (선택)"},
            "wedding_date": {"type": "string", "description": "결혼식 날짜 YYYY-MM-DD. 모르면 사용자에게 확인."},
        }, "required": ["scope", "wedding_date"]},
    }},
    # 13. 체크리스트
    {"type": "function", "function": {
        "name": "get_checklist",
        "description": "결혼 준비 체크리스트 생성/조회/완료 처리. '체크리스트', '할 일 목록', '~예약했어(완료 보고)' 등.",
        "parameters": {"type": "object", "properties": {
            "action": {"type": "string", "enum": ["generate", "status", "complete"],
                       "description": "generate=체크리스트 생성, status=진행현황, complete=항목 완료"},
            "wedding_date": {"type": "string", "description": "결혼식 날짜 YYYY-MM-DD"},
            "completed_item": {"type": "string", "description": "완료한 항목명 (complete 시)"},
        }, "required": ["action"]},
    }},
    # 14. 예산 현황 조회
    {"type": "function", "function": {
        "name": "get_budget_summary",
        "description": "현재 내 웨딩 예산 현황 조회. 총예산, 카테고리별 배분, 지출 현황, 잔여 금액.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    }},
    # 15. 예산 배분 추천
    {"type": "function", "function": {
        "name": "suggest_budget",
        "description": "총 예산을 카테고리별로 배분 추천. 숨은 비용 안내 포함. '예산 배분', '얼마씩', '숨은 비용' 등.",
        "parameters": {"type": "object", "properties": {
            "total_budget": {"type": "integer", "description": "총 예산 (원)"},
            "priorities": {"type": "array", "items": {"type": "string"}, "description": "우선 투자할 카테고리 (선택)"},
        }, "required": ["total_budget"]},
    }},
    # 16. 예산 항목 추가
    {"type": "function", "function": {
        "name": "add_budget_item",
        "description": "예산에 항목/업체 비용 추가 기록. '예산에 넣어줘', '비용 추가' 등.",
        "parameters": {"type": "object", "properties": {
            "category": {"type": "string", "description": "카테고리 (웨딩홀/스튜디오/드레스/메이크업/기타)"},
            "name": {"type": "string", "description": "항목명/업체명"},
            "amount": {"type": "integer", "description": "금액 (원)"},
        }, "required": ["category", "name", "amount"]},
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
            "get_detail": self.get_detail,
            "compare": self.compare,
            "filter_sort": self.filter_sort,
            "get_user_info": self.get_user_info,
            "plan_tour": self.plan_tour,
            "modify_tour": self.modify_tour,
            "knowledge_qa": self.knowledge_qa,
            "guest_calc": self.guest_calc,
            "get_timeline": self.get_timeline,
            "get_checklist": self.get_checklist,
            "get_budget_summary": self.get_budget_summary,
            "suggest_budget": self.suggest_budget,
            "add_budget_item": self.add_budget_item,
        }
        self._checklist_completed: dict[int, list[str]] = {}  # couple_id → 완료 항목
        self._last_tour: dict | None = None  # 마지막 투어 정보 (modify_tour용)

    def execute(self, tool_name: str, couple_id: int, **kwargs: Any) -> ToolResult:
        fn = self.tool_map.get(tool_name)
        if not fn:
            return ToolResult(result_type="direct", data=f"알 수 없는 tool: {tool_name}", vendors=[])
        return fn(couple_id=couple_id, **kwargs)

    # ── 1. search: 통합 검색 ──

    def search(self, query: str, category: str, couple_id: int, **_) -> ToolResult:
        if category == "hall":
            return self._search_hall(query)
        # 스드메: Text2Cypher 검색 (정형)
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
                    vendors = [r["name"] for r in records]
        # vendor 있으면 통일된 번호목록 생성 (direct)
        if vendors:
            return self._build_vendor_list(vendors, category)
        return ToolResult(result_type="graphrag", data=answer, vendors=vendors)

    def _search_hall(self, query: str) -> ToolResult:
        if not self.hall_engine or not self.hall_engine.driver:
            return ToolResult(result_type="direct", data="웨딩홀 서비스가 준비되지 않았습니다.", vendors=[])
        criteria = self.hall_engine.extract_criteria(query)
        count = _extract_count(query)
        # 쿼리에서 예산/개수 등 숫자 조건 제거 → tokenizer가 의미없는 토큰 생성 방지
        clean_query = self._clean_hall_query(query)
        halls = self.hall_engine.search(query=clean_query, criteria=criteria, limit=count * 2)
        # 예산 "이하" 명시 시 엄격 필터링
        if criteria.budget and "이하" in query:
            halls = [h for h in halls if not h.min_total_price or h.min_total_price <= criteria.budget]
        halls = halls[:count]
        if not halls:
            return ToolResult(result_type="direct", data="해당 조건의 웨딩홀을 찾지 못했습니다.", vendors=[])
        records = [self._hall_to_dict(h) for h in halls]
        # 코드에서 직접 번호 목록 생성: 업체명, 지역, 가격 (룰베이스)
        promo_words = {"할인", "특가", "인기", "인★", "최대", "선점"}
        lines = []
        for i, h in enumerate(halls):
            features = []
            if h.sub_region:
                features.append(h.sub_region)
            elif h.region:
                features.append(h.region)
            if h.min_total_price:
                features.append(f"{h.min_total_price // 10000}만원")
            reason = ", ".join(features) if features else ""
            lines.append(f"{i+1}) **{h.name}** — {reason}" if reason else f"{i+1}) **{h.name}**")
        text = "\n".join(lines) + "\n\n궁금한 곳이 있으면 말씀해주세요!"
        return ToolResult(result_type="direct", data=text,
                          vendors=[h.name for h in halls])

    @staticmethod
    def _clean_hall_query(query: str) -> str:
        """Hall 검색용 쿼리 정리: 예산/개수/동사 등 제거, 지역/스타일만 남김.
        tokenizer가 의미없는 토큰을 생성하지 않도록 함."""
        cleaned = query
        # 예산 표현 제거 (예산 3000만원대, 2000만원 이하 등)
        cleaned = re.sub(r"예산\s*", "", cleaned)
        cleaned = re.sub(r"\d+\s*(천|백)?\s*만원(대|이하|이상|정도|쯤)?", "", cleaned)
        # 개수 표현 제거
        cleaned = re.sub(r"\d+\s*(?:개|곳|군데)", "", cleaned)
        # 식대 표현 제거
        cleaned = re.sub(r"식대\s*\d+\s*만원?", "", cleaned)
        cleaned = re.sub(r"인당\s*\d+\s*만원?", "", cleaned)
        # 하객수 제거
        cleaned = re.sub(r"\d+\s*명", "", cleaned)
        # 의미없는 동사/조사/필러 제거 (tokenizer 오염 방지)
        filler = r"\b(있어|있나|있나요|있을까|있을까요|알려줘|알려주세요|찾아줘|보여줘|추천해줘|추천해주세요|어때|어떄|어떤|좋은|괜찮은|이하|이상|정도|대|해줘)\b"
        cleaned = re.sub(filler, "", cleaned)
        cleaned = re.sub(r"[?\s]+", " ", cleaned).strip()
        # 정리 후 의미있는 한글이 없으면 빈 쿼리 (tokenizer가 빈 토큰 리스트 → 필터 없음)
        remaining_words = re.findall(r"[가-힣]{2,}", cleaned)
        if not remaining_words:
            return ""
        return cleaned

    # ── 2. search_style: 스타일 검색 ──

    def search_style(self, query: str, category: str, couple_id: int,
                     region: str = None, max_price: int = None, **_) -> ToolResult:
        # 비정형 검색 (VectorCypher)
        answer, vendors = self.engine.search_semantic(
            query=query, category=category, region=region, max_price=max_price,
        )
        # vendor 있으면 통일된 번호목록 (direct)
        if vendors:
            return self._build_vendor_list(vendors, category)
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
        # 코드에서 직접 번호 목록 + 거리/특징 생성 (룰베이스)
        lines = []
        for i, r in enumerate(records):
            parts = []
            dist = r.get("distanceText", "")
            if dist:
                parts.append(dist)
            addr = r.get("address") or r.get("region", "")
            if addr:
                parts.append(addr)
            price = r.get("price")
            if price and price > 0:
                parts.append(f"{price // 10000}만원")
            lines.append(f"{i+1}) **{r['name']}** — {', '.join(parts)}" if parts else f"{i+1}) **{r['name']}**")
        text = "\n".join(lines) + "\n\n가까운 순서로 추천드립니다!"
        return ToolResult(result_type="direct", data=text,
                          vendors=[r["name"] for r in records])

    # ── 4. search_related: 연관 추천 ──

    # Hall 스타일 → 카테고리별 스드메 검색 키워드
    _HALL_STYLE_MAP_BY_CAT = {
        "studio": {
            "밝은": "밝은 화사한 자연광 촬영",
            "어두운": "어두운 시크한 무드 촬영",
            "야외": "야외 가든 로드씬 촬영",
            "하우스": "프라이빗 감성 웨딩촬영",
            "채플": "클래식 우아한 웨딩촬영",
            "호텔": "고급 럭셔리 웨딩촬영",
            "일반 컨벤션": "웨딩촬영",
        },
        "dress": {
            "밝은": "화이트 로맨틱 드레스",
            "어두운": "시크 모던 드레스",
            "야외": "야외 가든 드레스",
            "하우스": "감성 드레스",
            "채플": "클래식 우아한 드레스",
            "호텔": "고급 럭셔리 드레스",
            "일반 컨벤션": "웨딩 드레스",
        },
        "makeup": {
            "밝은": "화사한 내추럴 메이크업",
            "어두운": "시크 스모키 메이크업",
            "야외": "자연스러운 메이크업",
            "하우스": "감성 메이크업",
            "채플": "클래식 우아한 메이크업",
            "호텔": "고급 글래머러스 메이크업",
            "일반 컨벤션": "웨딩 메이크업",
        },
    }

    def _search_related(self, source_name: str, target_category: str, couple_id: int) -> ToolResult:
        query_text = ""
        region_hint = ""
        source_tags: list[str] = []

        # Vendor에서 태그 조회 → 태그(특징) 우선, 지역은 보조
        records = self.engine.query_vendors_by_names([source_name])
        if records:
            tags = records[0].get("tags", [])
            source_tags = _filter_tags(tags)
            region_hint = records[0].get("region", "")
            query_text = f"{' '.join(tags[:6])} {target_category}"
        # Hall에서 조회 → Hall 태그 + 카테고리
        elif self.hall_engine:
            hall = self.hall_engine.get_hall_details(source_name)
            if hall:
                region_hint = hall.sub_region or hall.region or ""
                source_tags = _filter_tags(hall.tags or [])
                hall_tags = " ".join(hall.tags[:4]) if hall.tags else ""
                cat_default = {
                    "studio": "웨딩 스튜디오 촬영",
                    "dress": "웨딩 드레스",
                    "makeup": "웨딩 메이크업 헤어",
                }
                query_text = f"{hall_tags} {cat_default.get(target_category, '웨딩')}"

        if not query_text:
            query_text = source_name

        if target_category == "hall":
            # Vendor→Hall 연관 검색: 지역 기반으로 홀 검색 (태그는 Hall tokenizer에 안 맞음)
            hall_query = f"{region_hint} 웨딩홀" if region_hint else "웨딩홀 추천"
            return self._search_hall(hall_query)

        # 1순위: VectorCypher (카테고리 필터 보장, 의미 유사도)
        answer, vendors = self.engine.search_semantic(
            query=query_text, category=target_category, region=region_hint or None,
        )
        if not vendors:
            vendors = self.engine._extract_vendors_from_bold(answer)
        if not vendors:
            vendors = self.engine._extract_vendors_from_list(answer)
        if not vendors:
            # 2순위: Text2Cypher fallback
            answer, vendors = self.engine.search_structured(query=query_text, category=target_category)
            # Text2Cypher는 카테고리 필터가 없으므로 결과 검증
            if vendors:
                verified = self.engine.query_vendors_by_names(vendors)
                vendors = [v["name"] for v in verified if v.get("category") == target_category]
        # vendor 있으면 통일된 번호목록 + 추천 이유 (direct)
        if vendors:
            return self._build_vendor_list(vendors, target_category,
                                           source_name=source_name, source_tags=source_tags)
        return ToolResult(result_type="graphrag", data=answer, vendors=vendors)

    # ── 5. get_detail: 상세 조회 ──

    def get_detail(self, name: str, couple_id: int, related_category: str = None, **_) -> ToolResult:
        # Case 1: 연관 추천 (related_category가 있으면)
        if related_category:
            return self._search_related(name, related_category, couple_id)

        # Case 2: 상세 조회 (기존 로직)
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
        _PREF_LABELS = {
            "region": "지역", "sub_region": "세부 지역",
            "studio_style": "스튜디오 스타일", "dress_style": "드레스 스타일",
            "makeup_style": "메이크업 스타일",
        }
        parts = []
        if info_type in ("preference", "all"):
            pref = self.engine.get_user_preference(couple_id)
            if pref:
                lines = [f"- {_PREF_LABELS.get(k, k)}: {v}" for k, v in pref.items()
                         if k in _PREF_LABELS and v]
                parts.append("취향 정보:\n" + "\n".join(lines))
            else:
                parts.append("저장된 취향 정보가 없습니다.")
        if info_type in ("likes", "all"):
            likes = self.engine.get_user_likes(couple_id)
            if likes:
                lines = [f"- {l.get('name', '알수없음')} ({l.get('category', '')})" for l in likes]
                parts.append(f"찜 목록 ({len(likes)}건):\n" + "\n".join(lines))
            else:
                parts.append("찜 목록: 없음")
        return ToolResult(result_type="direct", data="\n\n".join(parts), vendors=[])

    # ── 9. plan_tour: 통합 투어 (홀+스드메) ──

    def _get_vendor_coord(self, name: str) -> tuple[float, float] | None:
        """Vendor 노드에서 좌표 직접 조회"""
        if not self.engine.driver:
            return None
        with self.engine.driver.session() as session:
            result = session.run(
                "MATCH (v:Vendor) WHERE v.name = $name AND v.location IS NOT NULL "
                "RETURN v.lat AS lat, v.lng AS lng, v.category AS cat LIMIT 1",
                name=name,
            ).single()
        if result and result["lat"] and result["lng"]:
            return (float(result["lat"]), float(result["lng"]))
        return None

    def _get_hall_coord(self, name: str) -> tuple[float, float] | None:
        """Hall 노드에서 좌표 직접 조회 (Kakao API 의존 제거)"""
        if not self.hall_engine or not self.hall_engine.driver:
            return None
        with self.hall_engine.driver.session() as session:
            result = session.run(
                "MATCH (h:Hall) WHERE h.name = $name AND h.lat IS NOT NULL "
                "RETURN h.lat AS lat, h.lng AS lng LIMIT 1",
                name=name,
            ).single()
        if result and result["lat"] and result["lng"]:
            return (float(result["lat"]), float(result["lng"]))
        return None

    def _get_vendor_category(self, name: str) -> str | None:
        if not self.engine.driver:
            return None
        with self.engine.driver.session() as session:
            result = session.run(
                "MATCH (v:Vendor) WHERE v.name = $name RETURN v.category AS cat LIMIT 1",
                name=name,
            ).single()
        return result["cat"] if result else None

    def _resolve_venue_coordinates(self, venue_names: list[str]) -> list[dict]:
        """Hall/Vendor 통합 좌표 조회"""
        points = []
        for name in venue_names:
            # 1순위: Vendor (스드메)
            coord = self._get_vendor_coord(name)
            if coord:
                cat = self._get_vendor_category(name) or "studio"
                points.append({"name": name, "coord": coord, "category": cat})
                continue
            # 2순위: Hall — Neo4j 좌표 직접 조회 (Kakao API 의존 제거)
            coord = self._get_hall_coord(name)
            if coord:
                points.append({"name": name, "coord": coord, "category": "hall"})
                continue
            # 3순위: geocode fallback
            lat, lng, _ = geocode_query(name)
            if lat and lng:
                points.append({"name": name, "coord": (lat, lng), "category": "unknown"})
        return points

    def plan_tour(self, couple_id: int, hall_names: list[str] = None,
                  venue_names: list[str] = None, start_location: str = None,
                  transport: str = "car", visit_type: str = "tour",
                  end_location: str = None, **_) -> ToolResult:
        names = venue_names or hall_names or []
        if not names:
            return ToolResult(result_type="direct", data="투어할 업체/웨딩홀 이름을 알려주세요.", vendors=[])

        points = self._resolve_venue_coordinates(names)
        if not points:
            return ToolResult(result_type="direct", data="업체 위치를 찾지 못했습니다.", vendors=[])

        if not self.hall_engine:
            return ToolResult(result_type="direct", data="투어 서비스가 준비되지 않았습니다.", vendors=[])

        # 출발지 좌표
        start_coord = self.hall_engine._geocode_place(start_location) if start_location else None

        # 경로 최적화 (greedy nearest-neighbor)
        remaining = [p for p in points if p["coord"]]
        if not remaining:
            return ToolResult(result_type="direct", data="업체 좌표를 확인할 수 없습니다.", vendors=[])
        ordered = []
        current_coord = start_coord
        if current_coord is None:
            first = remaining.pop(0)
            ordered.append(first)
            current_coord = first["coord"]
        while remaining:
            nearest = min(remaining, key=lambda p: self.hall_engine._haversine_distance(
                current_coord[0], current_coord[1], p["coord"][0], p["coord"][1]))
            ordered.append(nearest)
            remaining.remove(nearest)
            current_coord = nearest["coord"]

        # 구간별 이동 계산 (transit은 driving 기준 1.3배 보정)
        total_dist, total_time = 0.0, 0.0
        legs = []
        prev_label = "출발지" if start_coord else ordered[0]["name"]
        prev_coord = start_coord or ordered[0]["coord"]
        start_idx = 0 if start_coord else 1
        for p in ordered[start_idx:]:
            # transit/walk도 카카오 driving API 결과 기반으로 보정
            dist, dur = self.hall_engine._get_travel_metrics(prev_coord, p["coord"], "car")
            if transport == "transit":
                dur = round(dur * 1.3, 1)  # 대중교통 = 자동차 × 1.3
            elif transport == "walk":
                dur = round(dist / 4 * 60, 1)  # 도보 = 4km/h
            legs.append({"from": prev_label, "to": p["name"], "distance_km": dist, "duration_min": dur})
            total_dist += dist
            total_time += dur
            prev_label, prev_coord = p["name"], p["coord"]

        # 귀가 경로
        end_loc = end_location or start_location
        if end_loc and prev_coord:
            end_coord = self.hall_engine._geocode_place(end_loc)
            if end_coord:
                dist, dur = self.hall_engine._get_travel_metrics(prev_coord, end_coord, "car")
                if transport == "transit":
                    dur = round(dur * 1.3, 1)
                elif transport == "walk":
                    dur = round(dist / 4 * 60, 1)
                legs.append({"from": prev_label, "to": f"귀가({end_loc})", "distance_km": dist, "duration_min": dur})
                total_dist += dist
                total_time += dur

        # 스케줄 빌드 (카테고리별 소요시간)
        schedule = self._build_tour_schedule(ordered, legs, visit_type, start_location=start_location)

        # 상세 타임라인 텍스트 생성
        transport_label = {"car": "자동차", "transit": "지하철/대중교통", "walk": "도보"}.get(transport, transport)
        visit_label = "견학" if visit_type == "tour" else "피팅/체험"
        timeline_lines = []
        step = 1
        for item in schedule:
            timeline_lines.append(f"{step}) **{item['time']}** {item['activity']}")
            step += 1
        timeline_text = (
            f"**{start_location or '출발지'}**에서 {transport_label}로 {visit_label} 투어:\n\n"
            + "\n\n".join(timeline_lines)
            + f"\n\n---\n**총 이동거리:** {total_dist:.1f}km | **총 이동시간:** {total_time:.0f}분"
        )

        summary = f"추천 동선: {' -> '.join(p['name'] for p in ordered)}. 총 이동 약 {total_dist:.1f}km, {total_time:.0f}분."
        result = {
            "ordered_venues": [{"name": p["name"], "category": p["category"]} for p in ordered],
            "summary": summary, "transport": transport,
            "total_distance_km": round(total_dist, 2), "total_travel_min": round(total_time, 1),
            "legs": legs, "schedule": schedule,
            "timeline_text": timeline_text,
        }

        self._last_tour = {"venue_names": [p["name"] for p in ordered],
                           "start_location": start_location, "transport": transport, "visit_type": visit_type}
        # timeline_text is already built with markdown formatting — return directly
        return ToolResult(result_type="direct", data=timeline_text,
                          vendors=[p["name"] for p in ordered])

    def _build_tour_schedule(self, ordered, legs, visit_type, start_location=None):
        schedule = []
        current_min = 10 * 60  # 10:00
        leg_map = {}
        for leg in legs:
            leg_map[leg["to"]] = leg
        fmt = lambda m: f"{m // 60:02d}:{m % 60:02d}"

        lunch_inserted = False
        visit_label = "견학" if visit_type == "tour" else "피팅/체험"

        for i, p in enumerate(ordered):
            leg = leg_map.get(p["name"])

            # Travel segment
            if leg:
                travel_min = int(leg["duration_min"])
                dist = leg["distance_km"]
                from_name = leg["from"]
                arrive = current_min + travel_min
                schedule.append({
                    "time": f"{fmt(current_min)}~{fmt(arrive)}",
                    "activity": f"{from_name} → {p['name']} 이동 ({travel_min}분, {dist}km)",
                })
                current_min = arrive
                # 역→업체 도보 이동 여유시간 (+10분)
                current_min += 10

            # Lunch break (if between 11:30-13:30 and not yet inserted)
            if not lunch_inserted and 11 * 60 + 30 <= current_min <= 13 * 60 + 30:
                lunch_end = current_min + 80  # 식당 이동 포함 1시간 20분
                schedule.append({
                    "time": f"{fmt(current_min)}~{fmt(lunch_end)}",
                    "activity": "점심 식사 (1시간 20분, 이동 포함)",
                })
                current_min = lunch_end
                lunch_inserted = True

            # Visit
            cat = p.get("category", "unknown")
            duration = VISIT_DURATION.get(cat, VISIT_DURATION["unknown"]).get(visit_type, 60)
            end = current_min + duration
            schedule.append({
                "time": f"{fmt(current_min)}~{fmt(end)}",
                "activity": f"{p['name']} {visit_label} ({duration}분)",
            })
            current_min = end

        # Return trip
        for leg in legs:
            if "귀가" in str(leg.get("to", "")):
                travel_min = int(leg["duration_min"])
                dist = leg["distance_km"]
                arrive = current_min + travel_min
                schedule.append({
                    "time": f"{fmt(current_min)}~{fmt(arrive)}",
                    "activity": f"귀가 이동 ({travel_min}분, {dist}km)",
                })

        return schedule

    # ── 10. modify_tour ──

    def modify_tour(self, action: str, couple_id: int,
                    index_a: int = None, index_b: int = None,
                    index: int = None, venue_name: str = None, **_) -> ToolResult:
        if not self._last_tour:
            return ToolResult(result_type="direct", data="이전 투어 계획이 없습니다. 먼저 투어를 계획해주세요.", vendors=[])
        names = list(self._last_tour["venue_names"])
        if action == "swap" and index_a is not None and index_b is not None:
            if 0 <= index_a < len(names) and 0 <= index_b < len(names):
                names[index_a], names[index_b] = names[index_b], names[index_a]
        elif action == "remove" and index is not None:
            if 0 <= index < len(names):
                names.pop(index)
        elif action == "add" and venue_name:
            names.append(venue_name)
        else:
            return ToolResult(result_type="direct", data="수정 정보가 부족합니다.", vendors=[])
        if not names:
            return ToolResult(result_type="direct", data="수정 후 투어할 업체가 없습니다.", vendors=[])
        return self.plan_tour(couple_id=couple_id, venue_names=names,
                              start_location=self._last_tour.get("start_location"),
                              transport=self._last_tour.get("transport", "car"),
                              visit_type=self._last_tour.get("visit_type", "tour"))

    # ── 11. knowledge_qa: 웨딩 상식 Q&A ──

    def knowledge_qa(self, topic: str, query: str, couple_id: int, **_) -> ToolResult:
        if topic == "general":
            # 전체 주제 목록 요약
            topics_summary = "\n".join(
                f"- {k}: {v['title']}" for k, v in WEDDING_KB.items()
            )
            context = f"아래 주제 중 궁금한 것을 골라 질문해주세요:\n{topics_summary}"
            return ToolResult(result_type="raw", data=context, vendors=[])

        kb_entry = WEDDING_KB.get(topic)
        if not kb_entry:
            return ToolResult(result_type="direct",
                              data="해당 주제의 정보를 찾지 못했습니다.", vendors=[])

        tips_text = "\n".join(f"- {t}" for t in kb_entry["tips"])
        context = f"# {kb_entry['title']}\n\n{kb_entry['content']}\n\n## 꿀팁\n{tips_text}"
        return ToolResult(result_type="raw", data=context, vendors=[])

    # ── 11. guest_calc: 하객 수 기반 계산 ──

    def guest_calc(self, calc_type: str, couple_id: int,
                   guest_count: int = None, meal_price: int = None, **_) -> ToolResult:
        if calc_type == "venue_size":
            if not guest_count:
                return ToolResult(result_type="direct",
                                  data="홀 규모 추천을 위해 예상 하객 수를 알려주세요.", vendors=[])
            context = _get_venue_size_guide(guest_count)
            return ToolResult(result_type="raw", data=context, vendors=[])

        if calc_type == "meal_cost":
            if not guest_count:
                return ToolResult(result_type="direct",
                                  data="식대 계산을 위해 예상 하객 수를 알려주세요.", vendors=[])
            price = meal_price or 80000
            total = guest_count * price
            dining_count = int(guest_count * 0.93)  # 실제 식사 인원 약 93%
            actual_total = dining_count * price
            context = (
                f"## 식대 계산 결과\n\n"
                f"- 하객 수: {guest_count}명\n"
                f"- 인당 식대: {price:,}원\n"
                f"- 전체 기준 식대: {total:,}원\n"
                f"- 실제 식사 인원(약 93%): {dining_count}명\n"
                f"- 실제 예상 식대: {actual_total:,}원\n\n"
                f"{_get_meal_cost_guide()}"
            )
            return ToolResult(result_type="raw", data=context, vendors=[])

        if calc_type == "guest_estimate":
            context = _get_guest_estimate_guide()
            return ToolResult(result_type="raw", data=context, vendors=[])

        return ToolResult(result_type="direct",
                          data="지원하지 않는 계산 유형입니다.", vendors=[])

    # ── 12. get_timeline: 결혼 준비 타임라인 ──

    def get_timeline(self, scope: str, wedding_date: str, couple_id: int,
                     category: str | None = None, **_) -> ToolResult:
        from datetime import datetime, timedelta
        try:
            w_date = datetime.strptime(wedding_date, "%Y-%m-%d")
        except (ValueError, TypeError):
            return ToolResult(result_type="direct",
                              data="결혼식 날짜를 YYYY-MM-DD 형식으로 알려주세요.", vendors=[])

        today = datetime.now()
        days_left = (w_date - today).days

        timeline = [
            {"period": "12~10개월 전", "items": ["예산 설정", "웨딩홀 투어 및 예약", "스드메 업체 리서치"]},
            {"period": "10~8개월 전", "items": ["스튜디오 예약", "드레스 피팅 시작", "메이크업 상담"]},
            {"period": "8~6개월 전", "items": ["드레스 결정 및 계약", "메이크업 리허설", "청첩장 준비"]},
            {"period": "6~4개월 전", "items": ["본식 스냅/영상 예약", "허니문 예약", "예물/예단 준비"]},
            {"period": "4~2개월 전", "items": ["청첩장 발송", "혼수 준비", "최종 피팅"]},
            {"period": "2개월~당일", "items": ["최종 리허설", "하객 확정", "세부 일정 확인"]},
        ]

        if scope == "current":
            months_left = days_left / 30
            current = [t for t in timeline if self._in_period(months_left, t["period"])]
            data = {"days_left": days_left, "current_tasks": current or timeline[-1:]}
        elif scope == "category_deadline" and category:
            deadlines = {"hall": "10개월 전", "studio": "8개월 전", "dress": "6개월 전", "makeup": "6개월 전"}
            data = {"category": category, "recommended_deadline": deadlines.get(category, "6개월 전")}
        else:
            data = {"days_left": days_left, "wedding_date": wedding_date, "timeline": timeline}

        return ToolResult(result_type="raw",
                          data=json.dumps(data, ensure_ascii=False, default=str), vendors=[])

    @staticmethod
    def _in_period(months_left: float, period: str) -> bool:
        ranges = {"12~10": (10, 12), "10~8": (8, 10), "8~6": (6, 8),
                  "6~4": (4, 6), "4~2": (2, 4), "2개월": (0, 2)}
        for key, (lo, hi) in ranges.items():
            if key in period and lo <= months_left <= hi:
                return True
        return False

    # ── 13. get_checklist: 결혼 준비 체크리스트 ──

    def get_checklist(self, action: str, couple_id: int,
                      wedding_date: str | None = None,
                      completed_item: str | None = None, **_) -> ToolResult:
        checklist = [
            {"category": "웨딩홀", "items": ["웨딩홀 투어", "웨딩홀 계약", "식사 메뉴 결정"]},
            {"category": "스튜디오", "items": ["스튜디오 상담", "촬영 컨셉 결정", "스튜디오 계약"]},
            {"category": "드레스", "items": ["드레스 피팅", "드레스 결정", "악세서리 준비"]},
            {"category": "메이크업", "items": ["메이크업 상담", "리허설 메이크업", "메이크업 계약"]},
            {"category": "기타", "items": ["청첩장 제작", "예물 준비", "허니문 예약", "혼수 준비"]},
        ]

        completed = self._checklist_completed.get(couple_id, [])

        if action == "complete" and completed_item:
            if completed_item not in completed:
                completed.append(completed_item)
                self._checklist_completed[couple_id] = completed
            return ToolResult(result_type="direct",
                              data=f"'{completed_item}' 항목이 완료 처리되었습니다!", vendors=[])

        if action == "status":
            all_items = [item for cat in checklist for item in cat["items"]]
            done = [i for i in all_items if i in completed]
            remaining = [i for i in all_items if i not in completed]
            data = {"total": len(all_items), "done": len(done), "done_items": done, "remaining": remaining}
        else:
            for cat in checklist:
                cat["items"] = [{"name": i, "done": i in completed} for i in cat["items"]]
            data = {"checklist": checklist}

        return ToolResult(result_type="raw",
                          data=json.dumps(data, ensure_ascii=False, default=str), vendors=[])

    # ── 14. get_budget_summary: 예산 현황 조회 ──

    def get_budget_summary(self, couple_id: int, **_) -> ToolResult:
        try:
            resp = http_requests.get(
                f"{settings.spring_url}/api/budgets",
                params={"coupleId": couple_id},
                timeout=5,
            )
            if resp.status_code == 200:
                data = resp.json()
                return ToolResult(result_type="raw",
                                  data=json.dumps(data, ensure_ascii=False, default=str),
                                  vendors=[])
        except Exception:
            pass
        return ToolResult(
            result_type="raw",
            data="예산 정보를 불러올 수 없습니다. 웨딩 예산 페이지에서 예산을 먼저 설정해주세요.",
            vendors=[],
        )

    # ── 15. suggest_budget: 예산 배분 추천 ──

    def suggest_budget(self, total_budget: int, couple_id: int,
                       priorities: list[str] | None = None, **_) -> ToolResult:
        allocation = allocate_budget(total_budget, priorities)

        # 숨은 비용 안내 추가
        hidden_info = {}
        for cat_ko in ["스튜디오", "드레스", "메이크업", "웨딩홀"]:
            costs = get_hidden_costs(cat_ko)
            if costs:
                hidden_info[cat_ko] = costs

        result = {
            "allocation": allocation,
            "hidden_costs": hidden_info,
            "tip": "숨은 비용까지 고려하면 카테고리별 예산에 10~20% 여유를 두는 것이 좋습니다.",
        }
        return ToolResult(
            result_type="raw",
            data=json.dumps(result, ensure_ascii=False, default=str),
            vendors=[],
        )

    # ── 16. add_budget_item: 예산 항목 추가 ──

    def add_budget_item(self, category: str, name: str, amount: int,
                        couple_id: int, **_) -> ToolResult:
        try:
            resp = http_requests.post(
                f"{settings.spring_url}/api/budgets/items",
                json={
                    "coupleId": couple_id,
                    "category": category,
                    "name": name,
                    "amount": amount,
                },
                timeout=5,
            )
            if resp.status_code in (200, 201):
                return ToolResult(
                    result_type="direct",
                    data=f"'{name}' ({category}) {amount:,}원이 예산에 추가되었습니다.",
                    vendors=[],
                )
        except Exception:
            pass
        return ToolResult(
            result_type="direct",
            data=f"예산 항목 추가에 실패했습니다. 웨딩 예산 페이지에서 직접 '{name}' ({category}) {amount:,}원을 추가해주세요.",
            vendors=[],
        )

    # ── 유틸 ──

    def _build_vendor_list(self, vendor_names: list[str], category: str,
                           source_name: str = None, source_tags: list[str] = None) -> ToolResult:
        """vendor 이름 목록 → 번호목록 텍스트 생성 (direct)
        source_name/source_tags 있으면: 공유 태그 기반 추천 이유 생성"""
        records = self.engine.query_vendors_by_names(vendor_names)
        source_tag_set = set(source_tags) if source_tags else set()
        lines = []
        cat_label = {"studio": "스튜디오", "dress": "드레스", "makeup": "메이크업"}.get(category, "")
        if cat_label:
            lines.append(f"**[{cat_label}]**")
        for i, name in enumerate(vendor_names):
            rec = next((r for r in records if r.get("name") == name), None)
            if rec:
                price = rec.get("price")
                price_str = f"{price // 10000}만원" if price and price > 0 else ""
                region = rec.get("region") or ""

                if source_name and source_tag_set:
                    # 연관 추천: 공유 태그로 이유 생성
                    vendor_tags = _filter_tags(rec.get("tags") or [])
                    shared = [t for t in vendor_tags if t in source_tag_set][:3]
                    if shared:
                        reason = f"{', '.join(shared)} 스타일 매칭"
                    elif vendor_tags:
                        reason = ", ".join(vendor_tags[:2])
                    else:
                        reason = region
                    extras = [p for p in [price_str] if p]
                    if extras:
                        reason += f" ({', '.join(extras)})"
                else:
                    # 일반 추천: 지역 + 가격
                    parts = [p for p in [region, price_str] if p]
                    reason = ", ".join(parts)

                lines.append(f"{i+1}) **{name}** — {reason}" if reason else f"{i+1}) **{name}**")
            else:
                lines.append(f"{i+1}) **{name}**")
        text = "\n".join(lines)
        if source_name and cat_label:
            text += f"\n\n{source_name}과(와) 어울리는 {cat_label} 추천입니다!"
        elif cat_label:
            text += f"\n\n{cat_label} 추천 결과입니다. 궁금한 곳이 있으면 말씀해주세요!"
        else:
            text += "\n\n궁금한 곳이 있으면 말씀해주세요!"
        return ToolResult(result_type="direct", data=text, vendors=vendor_names)

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
