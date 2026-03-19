"""스드메 Tool 함수 + 유틸"""
import json
import re
import requests as http_requests

from deps import get_driver
from config import settings
from sdm.graphrag import get_rag_cypher, create_vector_rag

def _extract_location(query):
    """쿼리에서 위치 키워드 추출. '가좌역 근처 스튜디오' → '가좌역'"""
    # 패턴: ~역, ~동, ~구, ~시 등 위치 관련 단어 추출
    m = re.search(r"(\S+(?:역|동|구|시|읍|면|리|타워|빌딩|아파트))", query)
    if m:
        return m.group(1)
    # 패턴: "근처", "가까운" 앞의 단어
    m = re.search(r"(\S+)\s*(?:근처|가까운|주변|쪽|부근|인근)", query)
    if m:
        return m.group(1)
    return None


def geocode_query(query):
    """사용자 입력에서 위치를 추출 후 카카오맵으로 지오코딩. (lat, lng, place_name) 반환."""
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


def search_nearest_vendors(category, lat, lng, limit=5):
    """좌표 기반 가장 가까운 업체 검색 (Neo4j point.distance)"""
    driver = get_driver()
    with driver.session() as session:
        records = session.run("""
            MATCH (v:Vendor {category: $cat})
            WHERE v.location IS NOT NULL
            WITH v, point.distance(v.location, point({latitude: $lat, longitude: $lng})) AS dist
            ORDER BY dist ASC
            LIMIT $limit
            OPTIONAL MATCH (v)-[:HAS_TAG]->(t:Tag)
            WITH v, dist, collect(DISTINCT t.name) AS tags
            RETURN v.name AS name, v.category AS category,
                   v.salePrice AS price, v.rating AS rating,
                   v.address AS address, v.profileUrl AS url,
                   round(dist) AS distanceMeters, tags
        """, cat=category, lat=lat, lng=lng, limit=limit).data()
    return records


NO_RESULT_PHRASES = [
    "찾지 못했습니다", "없습니다", "검색 결과가 없",
    "포함되어 있지 않습니다", "정보가 없", "찾을 수 없",
    "데이터에 포함", "제공되지 않", "존재하지 않",
]


# ── 유틸 ──

def extract_vendors_from_retriever(result):
    vendors = []
    if hasattr(result, "retriever_result") and result.retriever_result:
        for item in getattr(result.retriever_result, "items", []):
            name = None
            if item.metadata and isinstance(item.metadata, dict):
                name = item.metadata.get("name")
            if not name and item.content and isinstance(item.content, str):
                m = re.search(r'"name":\s*"([^"]+)"', item.content)
                if m:
                    name = m.group(1)
                if not name:
                    m = re.search(r"name='([^']+)'", item.content)
                    if m:
                        name = m.group(1)
            if name and 2 <= len(name) <= 30 and name not in vendors:
                vendors.append(name)
    return vendors


def extract_vendors_from_answer(answer):
    """답변 텍스트에서 업체명 추출 — **볼드** 텍스트 기반"""
    # 답변에서 **볼드** 텍스트 전부 추출
    bold_names = re.findall(r"\*\*([^*]{2,30})\*\*", answer)

    # 필드 라벨 제외 (가격, 평점, 특징 등)
    skip = {"가격", "평점", "특징", "주소", "웹사이트", "링크", "리뷰", "참고"}
    vendors = []
    for name in bold_names:
        name = name.strip()
        if name in skip or any(s in name for s in skip):
            continue
        if 2 <= len(name) <= 30 and name not in vendors:
            vendors.append(name)
    return vendors


def query_vendors_by_names(vendor_names):
    driver = get_driver()
    with driver.session() as session:
        records = session.run("""
            MATCH (v:Vendor)
            WHERE any(name IN $names WHERE v.name = name)
            WITH v
            OPTIONAL MATCH (v)-[:HAS_TAG]->(t:Tag)
            WITH v, collect(DISTINCT t.name) AS tags
            OPTIONAL MATCH (v)-[:HAS_PACKAGE]->(p:Package)
            WITH v, tags, collect(DISTINCT {title: p.title, value: p.value})[..3] AS packages
            OPTIONAL MATCH (v)-[:HAS_REVIEW]->(rv:Review)
            WITH v, tags, packages,
                 round(avg(rv.score), 1) AS avgReviewScore,
                 count(rv) AS reviewCount,
                 collect(rv.contents)[..2] AS recentReviews
            RETURN v.name AS name, v.category AS category,
                   v.salePrice AS price, v.rating AS rating,
                   v.address AS address, v.region AS region,
                   v.profileUrl AS url, v.holiday AS holiday,
                   v.reviewCnt AS reviewCnt,
                   tags, packages, avgReviewScore,
                   reviewCount, recentReviews
            ORDER BY v.rating DESC
        """, names=vendor_names).data()
    return records


# ── Tool 함수 ──

def tool_search_structured(query, category, **kwargs):
    rag = get_rag_cypher()
    result = rag.search(query_text=query)
    vendors = extract_vendors_from_retriever(result)
    answer = result.answer
    if not vendors:
        vendors = extract_vendors_from_answer(answer)
    if answer and any(p in answer for p in NO_RESULT_PHRASES):
        cat_kr = {"studio": "스튜디오", "dress": "드레스", "makeup": "메이크업"}
        # 거리 기반 fallback: 사용자 입력에서 위치 추출 → 지오코딩 → 가까운 업체 검색
        lat, lng, place = geocode_query(query)
        if lat and lng:
            records = search_nearest_vendors(category, lat, lng, limit=5)
            if records:
                # 거리 정보를 포함한 안내 메시지 추가
                for r in records:
                    dist_m = r.get("distanceMeters", 0)
                    if dist_m >= 1000:
                        r["distanceText"] = f"{dist_m / 1000:.1f}km"
                    else:
                        r["distanceText"] = f"{int(dist_m)}m"
                data = json.dumps(records, ensure_ascii=False, default=str)
                vendors = [r["name"] for r in records]
                return "raw", data, vendors
        # 지오코딩 실패 시 일반 벡터 검색 fallback
        fallback_query = f"{cat_kr.get(category, '')} 추천"
        vec_rag, _ = create_vector_rag(category=category)
        result = vec_rag.search(query_text=fallback_query)
        vendors = extract_vendors_from_retriever(result)
        if not vendors:
            vendors = extract_vendors_from_answer(result.answer)
        answer = f"해당 지역에 등록된 업체가 없어 가까운 업체를 추천드립니다.\n\n{result.answer}"
    return "graphrag", answer, vendors


def tool_search_semantic(query, category, region=None, max_price=None, min_price=None, **kwargs):
    vec_rag, _ = create_vector_rag(
        category=category, region=region, max_price=max_price, min_price=min_price,
    )
    result = vec_rag.search(query_text=query)
    vendors = extract_vendors_from_retriever(result)
    if not vendors:
        vendors = extract_vendors_from_answer(result.answer)
    return "graphrag", result.answer, vendors


def tool_compare_vendors(vendor_names, criteria=None, **kwargs):
    records = query_vendors_by_names(vendor_names)
    data = json.dumps(records, ensure_ascii=False, default=str)
    vendor_list = list(dict.fromkeys(r["name"] for r in records))
    return "raw", data, vendor_list


def tool_filter_previous(vendor_names, condition, count=None, **kwargs):
    records = query_vendors_by_names(vendor_names)
    data = json.dumps(records, ensure_ascii=False, default=str)
    vendor_list = list(dict.fromkeys(r["name"] for r in records))
    return "raw", data, vendor_list


def tool_get_vendor_detail(vendor_name, **kwargs):
    records = query_vendors_by_names([vendor_name])
    data = json.dumps(records, ensure_ascii=False, default=str)
    return "raw", data, [vendor_name]


def tool_get_user_preference(**kwargs):
    # TODO: Spring API 호출로 전환
    return "direct", "현재 저장된 취향 정보입니다.\n- region: 서울\n- studio_style: 인물중심", []


def tool_get_user_likes(**kwargs):
    # TODO: Spring API 호출로 전환
    return "direct", "좋아요한 업체가 없습니다.", []


TOOL_MAP = {
    "search_structured": tool_search_structured,
    "search_semantic": tool_search_semantic,
    "compare_vendors": tool_compare_vendors,
    "filter_previous": tool_filter_previous,
    "get_vendor_detail": tool_get_vendor_detail,
    "get_user_preference": tool_get_user_preference,
    "get_user_likes": tool_get_user_likes,
}
