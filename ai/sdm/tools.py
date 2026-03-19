"""스드메 Tool 함수 + 유틸"""
import json
import re
import mysql.connector

from deps import get_driver
from config import settings
from sdm.graphrag import get_rag_cypher, create_vector_rag

NO_RESULT_PHRASES = ["찾지 못했습니다", "없습니다", "검색 결과가 없"]


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
        vec_rag, _ = create_vector_rag(category=category)
        result = vec_rag.search(query_text=query)
        vendors = extract_vendors_from_retriever(result)
        answer = result.answer
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
