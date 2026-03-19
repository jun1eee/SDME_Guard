import json
import re
from dataclasses import asdict, dataclass, field
from math import asin, cos, radians, sin, sqrt
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from typing import Any

from neo4j import GraphDatabase, basic_auth

from config import Settings

STYLE_KEYWORDS = {
    "호텔": ["호텔", "hotel"],
    "밝은": ["밝은", "화이트", "자연채광", "환한"],
    "어두운": ["어두운", "다크", "채플"],
    "하우스": ["하우스", "단독홀"],
    "야외": ["야외", "정원", "가든"],
    "동시예식": ["동시", "동시예식"],
    "분리예식": ["분리", "분리예식"],
    "뷔페": ["뷔페"],
    "코스": ["코스"],
}

FEATURE_KEYWORDS = {
    "주차": ["주차", "발렛"],
    "역세권": ["역세권", "역근처", "지하철역도보"],
    "채플": ["채플"],
    "층고": ["층고", "버진로드"],
    "단독홀": ["단독홀", "프라이빗", "단독웨딩"],
}

REGION_ALIASES = {
    "서울": ["서울", "서울시"],
    "경기": ["경기", "경기도"],
    "인천": ["인천", "인천시"],
    "부산": ["부산", "부산시"],
    "대전": ["대전", "대전시"],
    "대구": ["대구", "대구시"],
    "광주": ["광주", "광주시"],
    "울산": ["울산", "울산시"],
    "세종": ["세종", "세종시"],
    "강남구": ["강남", "강남구"],
    "서초구": ["서초", "서초구"],
    "송파구": ["송파", "송파구", "잠실"],
    "영등포구": ["영등포", "영등포구", "여의도"],
    "마포구": ["마포", "마포구", "홍대", "합정"],
    "중구": ["중구"],
    "성동구": ["성동", "성동구"],
    "강동구": ["강동", "강동구"],
    "종로구": ["종로", "종로구"],
    "용산구": ["용산", "용산구"],
    "구로구": ["구로", "구로구"],
    "광진구": ["광진", "광진구"],
}

QUERY_STOPWORDS = {
    "웨딩홀",
    "웨딩",
    "홀",
    "추천",
    "추천해줘",
    "알아보려고",
    "비교",
    "찾아줘",
    "보여줘",
    "근처",
    "여기",
    "거기",
    "이거",
    "저거",
    "아까",
}


@dataclass
class HallCriteria:
    regions: list[str] = field(default_factory=list)
    subway_lines: list[str] = field(default_factory=list)
    stations: list[str] = field(default_factory=list)
    styles: list[str] = field(default_factory=list)
    features: list[str] = field(default_factory=list)
    budget: int | None = None
    meal_budget: int | None = None
    guest_count: int | None = None
    count: int | None = None


@dataclass
class HallRecord:
    partner_id: int
    name: str
    region: str
    sub_region: str
    address: str
    address_hint: str
    tel: str
    rating: float
    review_count: int
    cover_url: str
    profile_url: str
    profile_text: str
    min_meal_price: int | None
    max_meal_price: int | None
    min_rental_price: int | None
    max_rental_price: int | None
    min_total_price: int | None
    max_total_price: int | None
    tags: list[str]
    style_filters: list[str]
    benefits: list[str]
    subway_lines: list[str]
    stations: list[str]
    walk_minutes: int | None
    memo: str
    images: list[str]

    @property
    def searchable_text(self) -> str:
        parts = [
            self.name,
            self.region,
            self.sub_region,
            self.address,
            self.address_hint,
            self.tel,
            self.memo,
            self.profile_text,
            *self.subway_lines,
            *self.stations,
            *self.tags,
            *self.style_filters,
            *self.benefits,
        ]
        return " ".join(part for part in parts if part).lower()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class HallGraphRagEngine:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.driver = None
        self.startup_error: str | None = None
        self._geo_cache: dict[str, tuple[float, float] | None] = {}
        self._route_cache: dict[tuple[str, str, str], tuple[float, float] | None] = {}

    def startup(self) -> None:
        self.startup_error = None
        if not self.settings.neo4j_password:
            self.startup_error = "NEO4J_PW is not configured."
            return

        try:
            self.driver = GraphDatabase.driver(
                self.settings.neo4j_uri,
                auth=basic_auth(self.settings.neo4j_user, self.settings.neo4j_password),
            )
            self.driver.verify_connectivity()
        except Exception as exc:
            self.startup_error = str(exc)
            self.shutdown()

    def shutdown(self) -> None:
        if self.driver:
            self.driver.close()
            self.driver = None

    def extract_criteria(self, query: str, previous: HallCriteria | None = None) -> HallCriteria:
        criteria = HallCriteria(
            regions=list(previous.regions) if previous else [],
            subway_lines=list(previous.subway_lines) if previous else [],
            stations=list(previous.stations) if previous else [],
            styles=list(previous.styles) if previous else [],
            features=list(previous.features) if previous else [],
            budget=previous.budget if previous else None,
            meal_budget=previous.meal_budget if previous else None,
            guest_count=previous.guest_count if previous else None,
            count=previous.count if previous else None,
        )

        normalized = query.lower()

        regions = self._extract_regions(normalized)
        if regions:
            criteria.regions = regions

        subway_lines = self._extract_subway_lines(normalized)
        if subway_lines:
            criteria.subway_lines = subway_lines

        stations = self._extract_stations(normalized)
        if stations:
            criteria.stations = stations

        styles = self._extract_keywords(normalized, STYLE_KEYWORDS)
        if styles:
            criteria.styles = styles

        features = self._extract_keywords(normalized, FEATURE_KEYWORDS)
        if features:
            criteria.features = features

        meal_budget = self._extract_budget(normalized, meal_only=True)
        if meal_budget:
            criteria.meal_budget = meal_budget

        total_budget = self._extract_budget(normalized, meal_only=False)
        if total_budget:
            if any(token in normalized for token in ("식대", "1인", "인당", "1 명")):
                criteria.meal_budget = total_budget
            else:
                criteria.budget = total_budget

        guest_count = self._extract_guest_count(normalized)
        if guest_count:
            criteria.guest_count = guest_count

        count = self._extract_count(normalized)
        if count:
            criteria.count = count

        return criteria

    def search(self, query: str, criteria: HallCriteria, limit: int = 5) -> list[HallRecord]:
        scored = self.search_scored(query=query, criteria=criteria, limit=limit)
        return [hall for _, hall in scored]

    def search_scored(
        self,
        query: str,
        criteria: HallCriteria,
        limit: int = 10,
        strict_region: bool = False,
    ) -> list[tuple[float, HallRecord]]:
        halls = self._fetch_candidates(query=query, criteria=criteria, limit=max(limit * 6, 30))
        normalized = query.lower()
        anchor_coord = self._resolve_search_anchor(criteria, query)
        matches: list[tuple[float, HallRecord]] = []

        for hall in halls:
            score = self._score_hall(hall, normalized, criteria, strict_region=strict_region)
            if score is None:
                continue
            if anchor_coord:
                hall_coord = self._resolve_hall_coordinate(hall)
                if hall_coord:
                    distance_km = self._haversine_distance(
                        anchor_coord[0],
                        anchor_coord[1],
                        hall_coord[0],
                        hall_coord[1],
                    )
                    # 거리 보너스: 1km 이내 +5, 3km +3, 5km +1, 7km 0
                    score += max(0.0, 7.0 - distance_km)
            matches.append((score, hall))

        matches.sort(key=lambda item: item[0], reverse=True)
        return matches[:limit]

    def resolve_hall_names(self, keywords: list[str], limit_per_keyword: int = 1) -> list[HallRecord]:
        self._ensure_driver()
        resolved: list[HallRecord] = []
        seen: set[int] = set()

        for keyword in keywords:
            normalized = keyword.strip()
            if not normalized:
                continue

            rows = self._run_query(
                """
                MATCH (h:Hall)
                WHERE toLower(coalesce(h.name, "")) CONTAINS toLower($keyword)
                RETURN h.partnerId AS partnerId
                ORDER BY coalesce(h.reviewCnt, 0) DESC, coalesce(h.rating, 0) DESC
                LIMIT $limit
                """,
                keyword=normalized,
                limit=max(limit_per_keyword, 5),
            )
            partner_ids = [int(row["partnerId"]) for row in rows if row.get("partnerId") is not None]
            if not partner_ids:
                continue

            halls = self._fetch_halls_by_partner_ids(partner_ids)
            exact_first = sorted(
                halls,
                key=lambda hall: (
                    0 if hall.name.lower() == normalized.lower() else 1,
                    0 if normalized.lower() in hall.name.lower() else 1,
                    -(hall.review_count or 0),
                    -(hall.rating or 0),
                ),
            )
            for hall in exact_first:
                if hall.partner_id in seen:
                    continue
                resolved.append(hall)
                seen.add(hall.partner_id)
                if len(resolved) >= len(keywords) * limit_per_keyword:
                    return resolved
        return resolved

    def get_hall_details(self, hall_name: str) -> HallRecord | None:
        resolved = self.resolve_hall_names([hall_name], limit_per_keyword=1)
        return resolved[0] if resolved else None

    def compare_halls(self, hall_names: list[str]) -> list[HallRecord]:
        return self.resolve_hall_names(hall_names, limit_per_keyword=1)

    def recommend_from_profile(self, profile: dict[str, Any], count: int = 5) -> list[HallRecord]:
        query_parts: list[str] = []
        criteria = HallCriteria()

        preferred_regions = [
            str(region).strip()
            for region in profile.get("preferred_regions") or []
            if str(region).strip()
        ]
        if preferred_regions:
            criteria.regions = preferred_regions
            query_parts.extend(preferred_regions[:2])

        hall_budget = self._safe_int(profile.get("hall_budget"))
        if hall_budget:
            criteria.budget = hall_budget
            query_parts.append(f"{hall_budget // 10000}만원")

        guest_count = self._safe_int(profile.get("guest_count"))
        if guest_count:
            criteria.guest_count = guest_count
            query_parts.append(f"{guest_count}명")

        style_inputs = []
        for key in ("hall_style", "preferred_mood", "style", "mood"):
            value = profile.get(key)
            if isinstance(value, str) and value.strip():
                style_inputs.append(value.strip())
        for key in ("styles", "moods", "colors", "foods"):
            value = profile.get(key)
            if isinstance(value, list):
                style_inputs.extend(str(item).strip() for item in value if str(item).strip())

        style_hits = self._extract_keywords(" ".join(style_inputs).lower(), STYLE_KEYWORDS)
        if style_hits:
            criteria.styles = style_hits
            query_parts.extend(style_hits[:2])

        halls = self.search(query=" ".join(query_parts).strip() or "웨딩홀 추천", criteria=criteria, limit=max(count * 3, 12))

        liked_halls = self.resolve_hall_names(
            [str(name) for name in profile.get("liked_halls") or [] if str(name).strip()],
            limit_per_keyword=1,
        )
        if liked_halls:
            liked_tokens = {token for hall in liked_halls for token in hall.tags + hall.style_filters}
            halls = sorted(
                halls,
                key=lambda hall: (
                    -sum(1 for token in hall.tags + hall.style_filters if token in liked_tokens),
                    -(hall.rating or 0),
                    -(hall.review_count or 0),
                ),
            )

        return halls[:count]

    def plan_tour(
        self,
        hall_names: list[str],
        start_location: str | None = None,
        transport: str = "car",
    ) -> dict[str, Any]:
        halls = self.resolve_hall_names(hall_names, limit_per_keyword=1)
        if not halls:
            return {"ordered_halls": [], "summary": "투어 대상 웨딩홀을 찾지 못했습니다."}

        routed = self._plan_tour_with_kakao(halls=halls, start_location=start_location, transport=transport)
        if routed:
            return routed

        ordered = self._plan_tour_fallback(halls=halls, start_location=start_location)
        summary_names = " -> ".join(hall.name for hall in ordered)
        return {
            "ordered_halls": [self.serialize_hall(hall) for hall in ordered],
            "summary": f"추천 동선은 {summary_names} 순서입니다. 카카오 경로 정보를 가져오지 못해 거리 기반 휴리스틱으로 정렬했습니다.",
            "transport": transport,
            "route_source": "heuristic",
        }

    def serialize_hall(self, hall: HallRecord) -> dict[str, Any]:
        return {
            "hallId": hall.partner_id,
            "name": hall.name,
            "region": hall.region,
            "subRegion": hall.sub_region,
            "address": hall.address,
            "addressHint": hall.address_hint,
            "tel": hall.tel,
            "rating": hall.rating,
            "reviewCnt": hall.review_count,
            "minMealPrice": hall.min_meal_price,
            "maxMealPrice": hall.max_meal_price,
            "minRentalPrice": hall.min_rental_price,
            "maxRentalPrice": hall.max_rental_price,
            "minHallPrice": hall.min_total_price,
            "maxHallPrice": hall.max_total_price,
            "tags": hall.tags,
            "styleFilters": hall.style_filters,
            "benefits": hall.benefits,
            "subwayLines": hall.subway_lines,
            "stations": hall.stations,
            "walkMinutes": hall.walk_minutes,
            "memo": hall.memo,
            "coverUrl": hall.cover_url,
            "profileUrl": hall.profile_url,
        }

    def _fetch_candidates(self, query: str, criteria: HallCriteria, limit: int) -> list[HallRecord]:
        self._ensure_driver()

        if criteria.stations or criteria.subway_lines:
            # 역/호선 지정 → Neo4j 그래프/텍스트 매칭 대신 Kakao 거리 스코어링에 완전 위임
            # 서울(또는 지정 region) 전체 후보풀 확보 후 search_scored에서 실제 거리로 정렬
            geo_region = criteria.regions if criteria.regions else ["서울"]
            params = {
                "regions": geo_region,
                "subwayLines": [],
                "stations": [],
                "styles": criteria.styles,
                "features": criteria.features,
                "budgetLimit": int(criteria.budget * 1.25) if criteria.budget else None,
                "mealBudgetLimit": int(criteria.meal_budget * 1.25) if criteria.meal_budget else None,
                "tokens": [],
                "limit": 120,
            }
        else:
            params = {
                "regions": criteria.regions,
                "subwayLines": [],
                "stations": [],
                "styles": criteria.styles,
                "features": criteria.features,
                "budgetLimit": int(criteria.budget * 1.25) if criteria.budget else None,
                "mealBudgetLimit": int(criteria.meal_budget * 1.25) if criteria.meal_budget else None,
                "tokens": self._tokenize_query(query),
                "limit": limit,
            }

        rows = self._run_query(self._search_query(), **params)
        return [self._row_to_hall(row) for row in rows]

    def _fetch_halls_by_partner_ids(self, partner_ids: list[int]) -> list[HallRecord]:
        if not partner_ids:
            return []
        rows = self._run_query(
            self._search_query(where_extra="h.partnerId IN $partnerIds"),
            partnerIds=partner_ids,
            regions=[],
            styles=[],
            features=[],
            budgetLimit=None,
            mealBudgetLimit=None,
            tokens=[],
            limit=max(len(partner_ids), 1),
        )
        halls = [self._row_to_hall(row) for row in rows]
        order = {partner_id: index for index, partner_id in enumerate(partner_ids)}
        halls.sort(key=lambda hall: order.get(hall.partner_id, 9_999))
        return halls

    def _plan_tour_with_kakao(
        self,
        halls: list[HallRecord],
        start_location: str | None,
        transport: str,
    ) -> dict[str, Any] | None:
        if not self.settings.kakao_rest_api_key:
            return None

        start_coord = self._geocode_place(start_location) if start_location else None
        hall_points = []
        for hall in halls:
            coord = self._resolve_hall_coordinate(hall)
            hall_points.append({"hall": hall, "coord": coord})

        valid_points = [point for point in hall_points if point["coord"]]
        if not valid_points:
            return None

        ordered_points, legs, total_distance_km, total_travel_min = self._optimize_route(
            valid_points=valid_points,
            start_coord=start_coord,
            transport=transport,
        )
        ordered_halls = [point["hall"] for point in ordered_points]
        if not ordered_halls:
            return None

        summary = (
            f"추천 동선은 {' -> '.join(hall.name for hall in ordered_halls)} 순서입니다. "
            f"예상 이동거리는 약 {total_distance_km:.1f}km, 이동 시간은 약 {total_travel_min:.0f}분입니다."
        )
        return {
            "ordered_halls": [self.serialize_hall(hall) for hall in ordered_halls],
            "summary": summary,
            "transport": transport,
            "route_source": "kakao",
            "total_distance_km": round(total_distance_km, 2),
            "total_travel_min": round(total_travel_min, 1),
            "start_location": start_location,
            "legs": legs,
        }

    def _plan_tour_fallback(self, halls: list[HallRecord], start_location: str | None = None) -> list[HallRecord]:
        ordered = halls[:]
        if start_location:
            start = str(start_location).strip().lower()
            ordered.sort(
                key=lambda hall: (
                    -self._location_match_score(start, hall),
                    -(hall.rating or 0),
                    -(hall.review_count or 0),
                ),
            )

        if len(ordered) > 2:
            route = [ordered.pop(0)]
            while ordered:
                current = route[-1]
                next_hall = max(
                    ordered,
                    key=lambda hall: (
                        self._hall_proximity_score(current, hall),
                        hall.rating or 0,
                        hall.review_count or 0,
                    ),
                )
                route.append(next_hall)
                ordered.remove(next_hall)
            ordered = route
        return ordered

    @staticmethod
    def _search_query(where_extra: str | None = None) -> str:
        extra_clause = f"  AND ({where_extra})\n" if where_extra else ""
        return (
            "MATCH (h:Hall)\n"
            "WHERE 1 = 1\n"
            "  AND (size($regions) = 0 OR any(region IN $regions WHERE "
            "toLower(coalesce(h.region, '')) CONTAINS toLower(region) OR "
            "toLower(coalesce(h.subRegion, '')) CONTAINS toLower(region) OR "
            "toLower(coalesce(h.address, '')) CONTAINS toLower(region) OR "
            "toLower(coalesce(h.name, '')) CONTAINS toLower(region)))\n"
            "  AND (size($subwayLines) = 0 OR EXISTS { "
            "MATCH (h)-[:ON_SUBWAY_LINE]->(sl:SubwayLine) "
            "WHERE any(line IN $subwayLines WHERE toLower(sl.name) CONTAINS toLower(line)) })\n"
            "  AND (size($stations) = 0 OR EXISTS { "
            "MATCH (h)-[:NEAR_STATION]->(st:Station) "
            "WHERE any(station IN $stations WHERE toLower(st.name) = toLower(station)) })\n"
            "  AND ($budgetLimit IS NULL OR coalesce(h.minIndividualHallPrice, 0) = 0 OR h.minIndividualHallPrice <= $budgetLimit)\n"
            "  AND ($mealBudgetLimit IS NULL OR coalesce(h.minMealPrice, 0) = 0 OR h.minMealPrice <= $mealBudgetLimit)\n"
            "  AND (size($tokens) = 0 OR any(token IN $tokens WHERE "
            "toLower(coalesce(h.name, '')) CONTAINS token OR "
            "toLower(coalesce(h.address, '')) CONTAINS token OR "
            "toLower(coalesce(h.subRegion, '')) CONTAINS token OR "
            "(' ' + toLower(coalesce(h.address2, '')) + ' ') CONTAINS (' ' + token + ' ') OR "
            "toLower(coalesce(h.searchText, '')) CONTAINS token OR "
            "toLower(coalesce(h.memoContent, '')) CONTAINS token))\n"
            f"{extra_clause}"
            "OPTIONAL MATCH (h)-[:HAS_TAG]->(t:Tag)\n"
            "OPTIONAL MATCH (h)-[:HAS_STYLE_FILTER]->(sf:StyleFilter)\n"
            "OPTIONAL MATCH (h)-[:HAS_BENEFIT]->(bn:Benefit)\n"
            "OPTIONAL MATCH (h)-[:HAS_IMAGE]->(img:Image)\n"
            "OPTIONAL MATCH (h)-[ns:NEAR_STATION]->(st:Station)\n"
            "OPTIONAL MATCH (h)-[:ON_SUBWAY_LINE]->(sl:SubwayLine)\n"
            "OPTIONAL MATCH (h)-[:IN_REGION]->(r:Region)\n"
            "OPTIONAL MATCH (h)-[:IN_DISTRICT]->(d:District)\n"
            "WITH h,\n"
            "     collect(DISTINCT t.name) AS tags,\n"
            "     collect(DISTINCT sf.name) AS styleFilters,\n"
            "     collect(DISTINCT bn.title) AS benefits,\n"
            "     collect(DISTINCT img.url) AS images,\n"
            "     collect(DISTINCT st.name) AS stations,\n"
            "     collect(DISTINCT sl.name) AS subwayLines,\n"
            "     min(ns.walkMinutes) AS walkMinutes,\n"
            "     head(collect(DISTINCT r.name)) AS regionName,\n"
            "     head(collect(DISTINCT d.name)) AS districtName\n"
            "WHERE (size($styles) = 0 OR any(style IN $styles WHERE "
            "any(item IN styleFilters WHERE toLower(coalesce(item, '')) CONTAINS toLower(style)) OR "
            "any(item IN tags WHERE toLower(coalesce(item, '')) CONTAINS toLower(style)) OR "
            "toLower(coalesce(h.memoContent, '')) CONTAINS toLower(style)))\n"
            "  AND (size($features) = 0 OR any(feature IN $features WHERE "
            "any(item IN styleFilters WHERE toLower(coalesce(item, '')) CONTAINS toLower(feature)) OR "
            "any(item IN tags WHERE toLower(coalesce(item, '')) CONTAINS toLower(feature)) OR "
            "any(item IN subwayLines WHERE toLower(coalesce(item, '')) CONTAINS toLower(feature)) OR "
            "any(item IN stations WHERE toLower(coalesce(item, '')) CONTAINS toLower(feature)) OR "
            "any(item IN benefits WHERE toLower(coalesce(item, '')) CONTAINS toLower(feature)) OR "
            "toLower(coalesce(h.memoContent, '')) CONTAINS toLower(feature)))\n"
            "RETURN\n"
            "  h.partnerId AS partnerId,\n"
            "  h.name AS name,\n"
            "  coalesce(regionName, h.region, '') AS region,\n"
            "  coalesce(districtName, h.subRegion, '') AS subRegion,\n"
            "  coalesce(h.address, '') AS address,\n"
            "  coalesce(h.address2, '') AS addressHint,\n"
            "  coalesce(h.tel, '') AS tel,\n"
            "  coalesce(h.rating, 0.0) AS rating,\n"
            "  coalesce(h.reviewCnt, 0) AS reviewCnt,\n"
            "  coalesce(h.coverUrl, '') AS coverUrl,\n"
            "  coalesce(h.profileUrl, '') AS profileUrl,\n"
            "  coalesce(h.profile, '') AS profileText,\n"
            "  h.minMealPrice AS minMealPrice,\n"
            "  h.maxMealPrice AS maxMealPrice,\n"
            "  h.minRentalPrice AS minRentalPrice,\n"
            "  h.maxRentalPrice AS maxRentalPrice,\n"
            "  h.minIndividualHallPrice AS minHallPrice,\n"
            "  h.maxIndividualHallPrice AS maxHallPrice,\n"
            "  tags,\n"
            "  styleFilters,\n"
            "  benefits,\n"
            "  subwayLines,\n"
            "  stations,\n"
            "  walkMinutes,\n"
            "  coalesce(h.memoContent, '') AS memo,\n"
            "  images\n"
            "ORDER BY coalesce(h.rating, 0) DESC, coalesce(h.reviewCnt, 0) DESC\n"
            "LIMIT $limit"
        )

    def _run_query(self, query: str, **parameters: Any) -> list[dict[str, Any]]:
        self._ensure_driver()
        with self.driver.session() as session:
            return session.run(query, **parameters).data()

    def _resolve_search_anchor(
        self,
        criteria: HallCriteria,
        query: str,
    ) -> tuple[float, float] | None:
        for station in criteria.stations:
            coord = self._geocode_place(station)
            if coord:
                return coord
        for region in criteria.regions:
            coord = self._geocode_place(region)
            if coord:
                return coord
        return self._geocode_place(query)

    def _ensure_driver(self) -> None:
        if not self.driver:
            raise RuntimeError(self.startup_error or "Hall Neo4j driver is not ready.")

    @staticmethod
    def _row_to_hall(row: dict[str, Any]) -> HallRecord:
        return HallRecord(
            partner_id=int(row.get("partnerId") or 0),
            name=str(row.get("name") or "").strip(),
            region=str(row.get("region") or "").strip(),
            sub_region=str(row.get("subRegion") or "").strip(),
            address=str(row.get("address") or "").strip(),
            address_hint=str(row.get("addressHint") or "").strip(),
            tel=str(row.get("tel") or "").strip(),
            rating=float(row.get("rating") or 0),
            review_count=int(row.get("reviewCnt") or 0),
            cover_url=str(row.get("coverUrl") or "").strip(),
            profile_url=str(row.get("profileUrl") or "").strip(),
            profile_text=str(row.get("profileText") or "").strip(),
            min_meal_price=HallGraphRagEngine._safe_int(row.get("minMealPrice")),
            max_meal_price=HallGraphRagEngine._safe_int(row.get("maxMealPrice")),
            min_rental_price=HallGraphRagEngine._safe_int(row.get("minRentalPrice")),
            max_rental_price=HallGraphRagEngine._safe_int(row.get("maxRentalPrice")),
            min_total_price=HallGraphRagEngine._safe_int(row.get("minHallPrice")),
            max_total_price=HallGraphRagEngine._safe_int(row.get("maxHallPrice")),
            tags=HallGraphRagEngine._clean_list(row.get("tags")),
            style_filters=HallGraphRagEngine._clean_list(row.get("styleFilters")),
            benefits=HallGraphRagEngine._clean_list(row.get("benefits")),
            subway_lines=HallGraphRagEngine._clean_list(row.get("subwayLines")),
            stations=HallGraphRagEngine._clean_list(row.get("stations")),
            walk_minutes=HallGraphRagEngine._safe_int(row.get("walkMinutes")),
            memo=str(row.get("memo") or "").strip(),
            images=HallGraphRagEngine._clean_list(row.get("images")),
        )

    @staticmethod
    def _clean_list(raw: Any) -> list[str]:
        if not isinstance(raw, list):
            return []
        cleaned: list[str] = []
        seen: set[str] = set()
        for item in raw:
            text = str(item or "").strip()
            if not text or text in seen:
                continue
            cleaned.append(text)
            seen.add(text)
        return cleaned

    @staticmethod
    def _safe_int(value: Any) -> int | None:
        if value in (None, ""):
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _score_hall(
        self,
        hall: HallRecord,
        normalized_query: str,
        criteria: HallCriteria,
        strict_region: bool = False,
    ) -> float | None:
        searchable = hall.searchable_text
        # rating을 주 기준으로, review는 보조 (리뷰 많은 먼 홀이 거리 보너스를 압도하지 않도록 조정)
        score = hall.rating * 1.2 + min(hall.review_count, 300) * 0.008

        if criteria.regions:
            region_score = max(
                (
                    2.4
                    if region.lower() in searchable
                    else 0.0
                )
                for region in criteria.regions
            )
            if strict_region and region_score == 0:
                return None
            score += region_score

        if criteria.subway_lines:
            line_hits = sum(1 for line in criteria.subway_lines if line.lower() in searchable)
            if line_hits == 0 and any("호선" in token for token in criteria.subway_lines):
                score -= 0.4
            score += line_hits * 1.4

        if criteria.stations:
            # 단어 경계 매칭: "사당역"이 "국회의사당역" 부분문자열로 오매칭되는 것 방지
            station_hits = sum(
                1 for station in criteria.stations
                if f" {station.lower()}" in searchable or searchable.startswith(station.lower())
            )
            if station_hits == 0:
                score -= 0.4
            score += station_hits * 1.8
            if hall.walk_minutes is not None:
                score += max(0.0, 1.4 - (hall.walk_minutes / 8))

        if criteria.meal_budget and hall.min_meal_price:
            if hall.min_meal_price > int(criteria.meal_budget * 1.35):
                return None
            score += max(0.0, 2 - (hall.min_meal_price / max(criteria.meal_budget, 1)))

        if criteria.budget and hall.min_total_price:
            if hall.min_total_price > int(criteria.budget * 1.35):
                return None
            score += max(0.0, 2 - (hall.min_total_price / max(criteria.budget, 1)))

        for style in criteria.styles:
            if style.lower() in searchable:
                score += 1.3

        for feature in criteria.features:
            if feature.lower() in searchable:
                score += 1.0

        tokens = self._tokenize_query(normalized_query)
        exact_name_hits = sum(1 for token in tokens if token in hall.name.lower())
        context_hits = sum(1 for token in tokens if token in searchable)
        score += exact_name_hits * 0.8 + context_hits * 0.25

        if criteria.guest_count and hall.memo:
            guest_numbers = [int(match) for match in re.findall(r"(\d{2,4})명", hall.memo)]
            if guest_numbers:
                nearest_gap = min(abs(number - criteria.guest_count) for number in guest_numbers)
                score += max(0.0, 1.5 - nearest_gap / 150)

        return score

    @staticmethod
    def _tokenize_query(query: str) -> list[str]:
        tokens = re.findall(r"[가-힣a-zA-Z0-9]{2,}", query.lower())
        return [token for token in tokens if token not in QUERY_STOPWORDS]

    @staticmethod
    def _extract_keywords(normalized: str, keyword_map: dict[str, list[str]]) -> list[str]:
        matched: list[str] = []
        for canonical, aliases in keyword_map.items():
            if any(alias.lower() in normalized for alias in aliases):
                matched.append(canonical)
        return matched

    def _extract_regions(self, normalized: str) -> list[str]:
        matched: list[str] = []
        for canonical, aliases in REGION_ALIASES.items():
            if any(alias.lower() in normalized for alias in aliases):
                matched.append(canonical)
        return matched

    @staticmethod
    def _extract_subway_lines(normalized: str) -> list[str]:
        return [f"{line}호선" for line in re.findall(r"(\d+)호선", normalized)]

    @staticmethod
    def _extract_stations(normalized: str) -> list[str]:
        return list({match.strip() for match in re.findall(r"([가-힣a-zA-Z0-9]+역)", normalized)})

    @staticmethod
    def _extract_budget(normalized: str, meal_only: bool) -> int | None:
        if meal_only:
            meal_patterns = [
                r"식대\s*(\d+)\s*만원",
                r"인당\s*(\d+)\s*만원",
                r"1인\s*(\d+)\s*만원",
            ]
            for pattern in meal_patterns:
                match = re.search(pattern, normalized)
                if match:
                    return int(match.group(1)) * 10000
            return None

        match = re.search(r"(\d+)\s*(천|백)?\s*만원", normalized)
        if not match:
            return None
        amount = int(match.group(1))
        unit = match.group(2)
        if unit == "천":
            return amount * 10_000_000
        if unit == "백":
            return amount * 1_000_000
        return amount * 10_000

    @staticmethod
    def _extract_guest_count(normalized: str) -> int | None:
        match = re.search(r"(\d{2,4})\s*명", normalized)
        if not match:
            return None
        return int(match.group(1))

    @staticmethod
    def _extract_count(normalized: str) -> int | None:
        match = re.search(r"(\d+)\s*개", normalized)
        if not match:
            return None
        return max(1, min(int(match.group(1)), 20))

    @staticmethod
    def _location_match_score(location: str, hall: HallRecord) -> float:
        searchable = hall.searchable_text
        if location in hall.name.lower():
            return 3.0
        if location in hall.address.lower() or location in hall.address_hint.lower():
            return 2.0
        if location in hall.sub_region.lower() or location in hall.region.lower():
            return 1.2
        if location in searchable:
            return 0.8
        return 0.0

    @staticmethod
    def _hall_proximity_score(left: HallRecord, right: HallRecord) -> float:
        score = 0.0
        if left.region and left.region == right.region:
            score += 1.0
        if left.sub_region and left.sub_region == right.sub_region:
            score += 2.0
        left_tags = set(left.tags + left.style_filters)
        right_tags = set(right.tags + right.style_filters)
        score += len(left_tags & right_tags) * 0.15
        return score

    def _resolve_hall_coordinate(self, hall: HallRecord) -> tuple[float, float] | None:
        candidates = [
            f"{hall.name} 웨딩홀",
            hall.name,
            hall.address,
            f"{hall.region} {hall.sub_region}".strip(),
        ]
        for candidate in candidates:
            coord = self._geocode_place(candidate)
            if coord:
                return coord
        return None

    def _geocode_place(self, query: str | None) -> tuple[float, float] | None:
        if not query:
            return None
        normalized = str(query).strip()
        if not normalized:
            return None
        if normalized in self._geo_cache:
            return self._geo_cache[normalized]

        address_result = self._kakao_get(
            "https://dapi.kakao.com/v2/local/search/address.json",
            {"query": normalized},
        )
        coord = self._extract_kakao_coord(address_result, kind="address")
        if coord:
            self._geo_cache[normalized] = coord
            return coord

        keyword_result = self._kakao_get(
            "https://dapi.kakao.com/v2/local/search/keyword.json",
            {"query": normalized},
        )
        coord = self._extract_kakao_coord(keyword_result, kind="keyword")
        self._geo_cache[normalized] = coord
        return coord

    def _extract_kakao_coord(
        self,
        payload: dict[str, Any] | None,
        kind: str,
    ) -> tuple[float, float] | None:
        if not payload:
            return None
        documents = payload.get("documents") or []
        if not documents:
            return None
        first = documents[0]
        try:
            if kind == "address":
                return float(first["y"]), float(first["x"])
            return float(first["y"]), float(first["x"])
        except (KeyError, TypeError, ValueError):
            return None

    def _get_travel_metrics(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        transport: str,
    ) -> tuple[float, float]:
        cache_key = (
            f"{origin[0]:.6f},{origin[1]:.6f}",
            f"{destination[0]:.6f},{destination[1]:.6f}",
            transport,
        )
        if cache_key in self._route_cache:
            cached = self._route_cache[cache_key]
            if cached is not None:
                return cached

        result: tuple[float, float] | None = None
        if transport == "car":
            result = self._get_kakao_driving_info(origin, destination)

        if result is None:
            distance_km = self._haversine_distance(origin[0], origin[1], destination[0], destination[1])
            if transport == "walk":
                duration_min = (distance_km / 4) * 60
            elif transport == "transit":
                duration_min = (distance_km / 20) * 60 + 5
            else:
                duration_min = (distance_km / 30) * 60
            result = (round(distance_km, 2), round(duration_min, 1))

        self._route_cache[cache_key] = result
        return result

    def _get_kakao_driving_info(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
    ) -> tuple[float, float] | None:
        payload = self._kakao_get(
            "https://apis-navi.kakao.com/v1/directions",
            {
                "origin": f"{origin[1]},{origin[0]}",
                "destination": f"{destination[1]},{destination[0]}",
                "priority": "RECOMMEND",
                "car_type": 1,
                "summary": "false",
            },
            timeout=5,
        )
        if not payload:
            return None
        routes = payload.get("routes") or []
        if not routes:
            return None
        route = routes[0]
        if route.get("result_code") != 0:
            return None
        summary = route.get("summary") or {}
        try:
            distance_km = float(summary.get("distance", 0)) / 1000
            duration_min = float(summary.get("duration", 0)) / 60
        except (TypeError, ValueError):
            return None
        return round(distance_km, 2), round(duration_min, 1)

    def _optimize_route(
        self,
        valid_points: list[dict[str, Any]],
        start_coord: tuple[float, float] | None,
        transport: str,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], float, float]:
        remaining = valid_points[:]
        ordered: list[dict[str, Any]] = []
        current_coord = start_coord

        if current_coord is None:
            remaining.sort(
                key=lambda point: (
                    -(point["hall"].rating or 0),
                    -(point["hall"].review_count or 0),
                )
            )
            first = remaining.pop(0)
            ordered.append(first)
            current_coord = first["coord"]

        while remaining:
            next_point = min(
                remaining,
                key=lambda point: self._get_travel_metrics(current_coord, point["coord"], transport)[1],
            )
            ordered.append(next_point)
            remaining.remove(next_point)
            current_coord = next_point["coord"]

        total_distance_km = 0.0
        total_travel_min = 0.0
        legs: list[dict[str, Any]] = []

        current_label = "출발지" if start_coord else ordered[0]["hall"].name
        current_coord = start_coord or ordered[0]["coord"]
        start_index = 0 if start_coord else 1

        for point in ordered[start_index:]:
            distance_km, duration_min = self._get_travel_metrics(current_coord, point["coord"], transport)
            legs.append(
                {
                    "from": current_label,
                    "to": point["hall"].name,
                    "distance_km": distance_km,
                    "duration_min": duration_min,
                }
            )
            total_distance_km += distance_km
            total_travel_min += duration_min
            current_label = point["hall"].name
            current_coord = point["coord"]

        return ordered, legs, total_distance_km, total_travel_min

    def _kakao_get(
        self,
        url: str,
        params: dict[str, Any],
        timeout: int = 10,
    ) -> dict[str, Any] | None:
        api_key = self.settings.kakao_rest_api_key
        if not api_key:
            return None

        query_string = urlencode({key: value for key, value in params.items() if value is not None})
        request = Request(
            f"{url}?{query_string}",
            headers={"Authorization": f"KakaoAK {api_key.strip()}"},
        )
        try:
            with urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError):
            return None

    @staticmethod
    def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        radius = 6371.0
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
        return 2 * radius * asin(sqrt(a))
