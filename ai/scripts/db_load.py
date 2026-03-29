import json
import os
import re
import sys
import asyncio
import aiohttp
from dotenv import load_dotenv
from neo4j import GraphDatabase
from openai import OpenAI

# === 설정 (.env에서 로드) ===
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

NEO4J_URI = os.environ["NEO4J_URI"]
NEO4J_USER = os.environ["NEO4J_USER"]
NEO4J_PW = os.environ["NEO4J_PW"]

openai_client = OpenAI()
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
KAKAO_API_KEYS = [
    k.strip() for k in [
        os.environ.get("KAKAO_API_KEY", ""),
        os.environ.get("KAKAO_REST_API_KEY2", ""),
        os.environ.get("KAKAO_REST_API_KEY3", ""),
        os.environ.get("KAKAO_REST_API_KEY4", ""),
        os.environ.get("KAKAO_REST_API_KEY5", ""),
        os.environ.get("KAKAO_REST_API_KEY6", ""),
        os.environ.get("KAKAO_REST_API_KEY7", ""),
    ] if k.strip()
]
KAKAO_API_KEY = KAKAO_API_KEYS[0] if KAKAO_API_KEYS else ""
_kakao_key_index = 0
_kakao_abort = False  # 한도가 아닌 에러 시 전체 중단


def _get_kakao_key():
    global _kakao_key_index
    if not KAKAO_API_KEYS or _kakao_abort:
        return ""
    return KAKAO_API_KEYS[_kakao_key_index % len(KAKAO_API_KEYS)]


def _rotate_kakao_key():
    global _kakao_key_index
    _kakao_key_index += 1
    if _kakao_key_index >= len(KAKAO_API_KEYS):
        print(f"    모든 키 소진 ({len(KAKAO_API_KEYS)}개)")
        return ""
    print(f"    키 로테이션: {_kakao_key_index + 1}/{len(KAKAO_API_KEYS)}")
    return KAKAO_API_KEYS[_kakao_key_index]

# 스크립트 위치 기준으로 경로 설정 (어느 폴더에서 실행해도 동작)
# ai/ 루트 기준 경로 (scripts/ 에서 한 단계 위)
_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

GEOCODE_CACHE_PATH = os.path.join(_BASE, "data", "geocode_cache.json")


def pick_existing_path(*candidates):
    for path in candidates:
        if os.path.exists(path):
            return path
    return candidates[0]

VENDOR_FILES = {
    "dress":  os.path.join(_BASE, "data", "json", "iwedding_dress_detail.json"),
    "makeup": os.path.join(_BASE, "data", "json", "iwedding_makeup_detail.json"),
    "studio": os.path.join(_BASE, "data", "json", "iwedding_studio_detail.json"),
}
HALL_LIST_PATH = pick_existing_path(
    os.path.join(_BASE, "data", "json", "weddingbook_halls_reco_list.json"),
    os.path.join(_BASE, "data", "json", "weddingbook_halls_list.json"),
)
HALL_DETAIL_PATH = pick_existing_path(
    os.path.join(_BASE, "data", "json", "weddingbook_halls_reco_detail.json"),
    os.path.join(_BASE, "data", "json", "weddingbook_halls_detail.json"),
)


# --────────────────────────────────────────
# 공통 유틸
# --────────────────────────────────────────
def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    for key in ["data", "items", "result", "partners"]:
        if key in data and isinstance(data[key], list):
            return data[key]
    raise ValueError(f"JSON 구조를 알 수 없음: {path}")


def _load_geocode_cache():
    """지오코딩 캐시 파일 로드. 없으면 빈 dict 반환."""
    if os.path.exists(GEOCODE_CACHE_PATH):
        with open(GEOCODE_CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_geocode_cache(cache):
    """지오코딩 캐시 파일 저장."""
    os.makedirs(os.path.dirname(GEOCODE_CACHE_PATH), exist_ok=True)
    with open(GEOCODE_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


# --────────────────────────────────────────
# setup / setup_constraints
# --────────────────────────────────────────
def setup(session):
    """전체 삭제 + 제약조건 생성 (--clean 전용)."""
    session.run("MATCH (n) DETACH DELETE n")
    print("기존 데이터 전체 삭제 완료")
    setup_constraints(session)


def setup_constraints(session):
    """제약조건만 생성 (기본 모드). 충돌 제약조건 제거 포함."""
    # 챗봇 노트북에서 생성된 충돌 제약조건을 이름으로 조회 후 삭제
    try:
        constraints = session.run("SHOW CONSTRAINTS").data()
        for c in constraints:
            name = c.get("name", "")
            labelsOrTypes = c.get("labelsOrTypes", [])
            props = c.get("properties", [])
            # Tag.name 단독 유니크 or Vendor.partnerId 단독 유니크 제약조건 제거
            if (labelsOrTypes == ["Tag"] and props == ["name"]) or \
               (labelsOrTypes == ["Vendor"] and props == ["partnerId"]):
                try:
                    session.run(f"DROP CONSTRAINT {name}")
                    print(f"  제약조건 제거: {name}")
                except Exception:
                    pass
    except Exception:
        pass

    for c in [
        "CREATE CONSTRAINT IF NOT EXISTS FOR (h:Hall)   REQUIRE h.partnerId IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (r:Region) REQUIRE r.name IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (d:District) REQUIRE d.name IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (s:StyleFilter) REQUIRE s.name IS UNIQUE",
    ]:
        session.run(c)
    print("제약조건 생성 완료")


# --────────────────────────────────────────
# 카카오맵 지오코딩 (주소 -> 좌표, 병렬 처리)
# --────────────────────────────────────────
KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"


def _clean_address(addr):
    """주소에서 층수, 빌딩명 등 제거하여 지오코딩 성공률 향상."""
    if not addr:
        return ""
    addr = re.split(r"\d+층", addr)[0]
    addr = re.split(r":\s", addr)[0]
    addr = re.sub(r"\([^)]*\)", "", addr)
    addr = re.sub(r"\s+\d+F\b", "", addr, flags=re.IGNORECASE)
    addr = re.sub(r"\s*B\d+\b", "", addr)
    addr = re.sub(r"\s+", " ", addr).strip().rstrip(",").strip()
    return addr


def _geocode_sync(addresses):
    """주소 리스트를 순차 지오코딩. 429→다음 키, 403/401→중단."""
    import requests as req
    global _kakao_abort

    results = []
    fail_streak = 0  # 연속 실패 카운트

    for i, addr in enumerate(addresses):
        if _kakao_abort:
            results.append((addr, None, None))
            continue

        clean = _clean_address(addr)
        if not clean:
            results.append((addr, None, None))
            continue

        geocoded = False
        for _ in range(len(KAKAO_API_KEYS)):
            key = _get_kakao_key()
            if not key:
                break
            try:
                r = req.get(
                    KAKAO_KEYWORD_URL,
                    params={"query": clean, "size": 1},
                    headers={"Authorization": f"KakaoAK {key}"},
                    timeout=3,
                )
                if r.status_code == 429:
                    new_key = _rotate_kakao_key()
                    if not new_key:
                        break
                    continue
                if r.status_code in (401, 403):
                    print(f"    키 인증 실패 (status {r.status_code}) — 중단")
                    _kakao_abort = True
                    break
                if r.status_code == 200:
                    docs = r.json().get("documents", [])
                    if docs:
                        results.append((addr, float(docs[0]["y"]), float(docs[0]["x"])))
                        fail_streak = 0
                    else:
                        results.append((addr, None, None))
                        fail_streak += 1
                else:
                    results.append((addr, None, None))
                    fail_streak += 1
                geocoded = True
                break
            except Exception:
                results.append((addr, None, None))
                fail_streak += 1
                geocoded = True
                break

        if not geocoded:
            results.append((addr, None, None))

        # 진행 상황 출력 (50건마다)
        if (i + 1) % 50 == 0:
            ok = sum(1 for _, lat, _ in results if lat is not None)
            print(f"    진행: {i+1}/{len(addresses)}, 성공: {ok}")

    ok = sum(1 for _, lat, _ in results if lat is not None)
    print(f"    완료: {len(addresses)}건 중 {ok}건 성공")
    return results


def _geocode_with_cache(unique_addrs, cache):
    """캐시를 활용한 지오코딩. 캐시 미스만 API 호출."""
    cached_results = {}
    uncached_addrs = []

    for addr in unique_addrs:
        if addr in cache:
            cached_results[addr] = tuple(cache[addr])
        else:
            uncached_addrs.append(addr)

    print(f"    캐시 히트: {len(cached_results)}건, API 호출 필요: {len(uncached_addrs)}건")

    # 캐시 미스 주소만 API 호출 (동기 + 키 로테이션)
    if uncached_addrs and KAKAO_API_KEYS:
        api_results = _geocode_sync(uncached_addrs)
        for addr, lat, lng in api_results:
            if lat is not None:
                cached_results[addr] = (lat, lng)
                cache[addr] = [lat, lng]

    return cached_results


def geocode_vendors(session, items, category, cache):
    """Vendor 노드에 lat, lng 속성 추가 (카카오맵 지오코딩 + 캐시)."""
    if not KAKAO_API_KEYS:
        print(f"  [{category}] KAKAO_API_KEY 미설정 -- 지오코딩 건너뜀")
        return

    # 중복 주소 제거하여 API 호출 최소화
    addr_to_pids = {}
    for item in items:
        addr = item.get("address", "")
        pid = item.get("partnerId", 0)
        addr_to_pids.setdefault(addr, []).append(pid)

    unique_addrs = [a for a in addr_to_pids if a]
    print(f"  [{category}] 지오코딩 중... (업체 {len(items)}개, 고유 주소 {len(unique_addrs)}개)")
    coord_map = _geocode_with_cache(unique_addrs, cache)

    batch = []
    for addr, pids in addr_to_pids.items():
        if addr in coord_map:
            lat, lng = coord_map[addr]
            for pid in pids:
                batch.append({"partnerId": pid, "lat": lat, "lng": lng})

    for i in range(0, len(batch), 100):
        chunk = batch[i:i+100]
        session.run("""
            UNWIND $batch AS row
            MATCH (v:Vendor {partnerId: row.partnerId, category: $cat})
            SET v.lat = row.lat, v.lng = row.lng
        """, batch=chunk, cat=category)

    print(f"  -> [{category}] 지오코딩 완료: {len(coord_map)}/{len(unique_addrs)}건 성공 -> {len(batch)}개 Vendor 업데이트")


def geocode_halls(session, list_items, cache):
    """Hall 노드에 lat, lng 속성 추가 (카카오맵 지오코딩 + 캐시)."""
    if not KAKAO_API_KEYS:
        print("  [hall] KAKAO_API_KEY 미설정 -- 지오코딩 건너뜀")
        return

    addr_to_pids = {}
    for item in list_items:
        # detail에 address가 있으면 우선, 없으면 list에서 추출
        addr = item.get("address", "")
        pid = item.get("partnerId")
        if addr and pid is not None:
            addr_to_pids.setdefault(addr, []).append(int(pid))

    unique_addrs = [a for a in addr_to_pids if a]
    print(f"  [hall] 지오코딩 중... (홀 {len(list_items)}개, 고유 주소 {len(unique_addrs)}개)")
    coord_map = _geocode_with_cache(unique_addrs, cache)

    batch = []
    for addr, pids in addr_to_pids.items():
        if addr in coord_map:
            lat, lng = coord_map[addr]
            for pid in pids:
                batch.append({"partnerId": pid, "lat": lat, "lng": lng})

    for i in range(0, len(batch), 100):
        chunk = batch[i:i+100]
        session.run("""
            UNWIND $batch AS row
            MATCH (h:Hall {partnerId: row.partnerId})
            SET h.lat = row.lat, h.lng = row.lng
        """, batch=chunk)

    print(f"  -> [hall] 지오코딩 완료: {len(coord_map)}/{len(unique_addrs)}건 성공 -> {len(batch)}개 Hall 업데이트")


def create_point_index(session):
    """Vendor 좌표 기반 포인트 인덱스 생성"""
    try:
        session.run("""
            CREATE POINT INDEX vendor_location_index IF NOT EXISTS
            FOR (v:Vendor) ON (v.location)
        """)
    except Exception:
        pass
    # lat, lng -> Neo4j point 속성 변환
    session.run("""
        MATCH (v:Vendor) WHERE v.lat IS NOT NULL AND v.lng IS NOT NULL
        SET v.location = point({latitude: v.lat, longitude: v.lng})
    """)
    cnt = session.run("""
        MATCH (v:Vendor) WHERE v.location IS NOT NULL RETURN count(v) AS cnt
    """).single()["cnt"]
    print(f"  -> 좌표 인덱스 생성 완료: {cnt}개 Vendor에 location 설정")

    # Hall에도 point 속성 변환
    try:
        session.run("""
            CREATE POINT INDEX hall_location_index IF NOT EXISTS
            FOR (h:Hall) ON (h.location)
        """)
    except Exception:
        pass
    session.run("""
        MATCH (h:Hall) WHERE h.lat IS NOT NULL AND h.lng IS NOT NULL
        SET h.location = point({latitude: h.lat, longitude: h.lng})
    """)
    hall_cnt = session.run("""
        MATCH (h:Hall) WHERE h.location IS NOT NULL RETURN count(h) AS cnt
    """).single()["cnt"]
    print(f"  -> 좌표 인덱스 생성 완료: {hall_cnt}개 Hall에 location 설정")


# --────────────────────────────────────────
# 주소에서 동(洞) 이름 추출
# --────────────────────────────────────────
def extract_dong(address):
    """주소 문자열에서 동(洞) 이름 추출. 없으면 None 반환."""
    if not address:
        return None
    # 1순위: 괄호 안의 동 -- (청담동), (논현동 101-3), (성수동2가)
    m = re.search(r"\((\S+동\d*가?)\b", address)
    if m:
        return m.group(1)
    # 2순위: 구 뒤의 지번 동 -- 강남구 신사동 (도로명 "동로/동길" 제외)
    m = re.search(r"[시군구]\s+(\S+동\d*가?)(?!\s*로|길)\b", address)
    if m:
        return m.group(1)
    # 3순위: 주소가 동으로 시작 -- 청담동2-10
    m = re.match(r"(\S+동\d*가?)(?!\s*로|길)\b", address)
    if m:
        return m.group(1)
    return None


# --────────────────────────────────────────
# 스드메 (Vendor 노드)
# --────────────────────────────────────────
def insert_vendors(session, items, category, batch_size=100):
    for i in range(0, len(items), batch_size):
        batch = [
            {
                "partnerId":       item.get("partnerId", 0),
                "category":        category,
                "uuid":            item.get("uuid", ""),
                "name":            item.get("name", ""),
                "typeName":        item.get("typeName", ""),
                "tel":             item.get("tel", ""),
                "address":         item.get("address", ""),
                "region":          item.get("region", "") or "기타",
                "coverUrl":        item.get("coverUrl", ""),
                "profile":         item.get("profile", ""),
                "profileUrl":      item.get("profileUrl", ""),
                "rating":          item.get("rating", 0),
                "reviewCnt":       item.get("reviewCnt", 0),
                "productPrice":    item.get("productPrice", 0),
                "salePrice":       item.get("salePrice", 0),
                "eventOptionPrice":item.get("eventOptionPrice", 0),
                "eventPrice":      item.get("eventPrice", 0),
                "likeCnt":         item.get("likeCnt", 0),
                "viewCnt":         item.get("viewCnt", 0),
                "orderCnt":        item.get("orderCnt", 0),
                "holiday":         item.get("holiday", ""),
                "packages": [
                    {"title": p.get("title", ""), "value": p.get("value", ""), "desc": p.get("desc", "")}
                    for p in item.get("packageInfo", []) if p.get("title")
                ],
                "reviews": [
                    {"name": r.get("name", ""), "contents": r.get("contents", ""),
                     "score": r.get("score", 0), "date": r.get("date", "")}
                    for r in item.get("reviews", []) if r.get("contents")
                ],
                "detailCmt":       item.get("detailCmt", ""),
                "iweddingNo":      item.get("iwedding_no", ""),
                "enterpriseCode":  item.get("iwedding_enterprise_code", ""),
                "productName":     item.get("iwedding_product_name", ""),
                "subCategory":     item.get("iwedding_sub_category", ""),
                "tags":   [t["name"] for t in item.get("tags", []) if t.get("name")],
                "styles": [sf["name"] for sf in item.get("styleFilter", []) if sf.get("name")],
                "dong":    extract_dong(item.get("address", "")),
            }
            for item in items[i:i+batch_size]
        ]

        # Vendor 노드 (category + partnerId 조합으로 구분)
        session.run("""
            UNWIND $batch AS row
            MERGE (v:Vendor {partnerId: row.partnerId, category: row.category})
            SET v += {uuid: row.uuid, name: row.name, typeName: row.typeName,
                tel: row.tel, address: row.address, region: row.region,
                coverUrl: row.coverUrl, profile: row.profile, profileUrl: row.profileUrl,
                rating: row.rating, reviewCnt: row.reviewCnt,
                productPrice: row.productPrice, salePrice: row.salePrice,
                eventOptionPrice: row.eventOptionPrice, eventPrice: row.eventPrice,
                likeCnt: row.likeCnt, viewCnt: row.viewCnt, orderCnt: row.orderCnt,
                holiday: row.holiday,
                detailCmt: row.detailCmt, iweddingNo: row.iweddingNo,
                enterpriseCode: row.enterpriseCode, productName: row.productName,
                subCategory: row.subCategory}
        """, batch=batch)

        session.run("""
            UNWIND $batch AS row
            MATCH (v:Vendor {partnerId: row.partnerId, category: row.category})
            MERGE (r:Region {name: row.region})
            MERGE (v)-[:IN_REGION]->(r)
        """, batch=batch)

        # District 노드 (동 단위)
        session.run("""
            UNWIND $batch AS row
            WITH row WHERE row.dong IS NOT NULL
            MATCH (v:Vendor {partnerId: row.partnerId, category: row.category})
            MERGE (d:District {name: row.dong})
            MERGE (v)-[:IN_DISTRICT]->(d)
            WITH d, row
            MATCH (r:Region {name: row.region})
            MERGE (d)-[:PART_OF]->(r)
        """, batch=batch)

        session.run("""
            UNWIND $batch AS row
            MATCH (v:Vendor {partnerId: row.partnerId, category: row.category})
            UNWIND row.tags AS tagName
            MERGE (t:Tag {name: tagName, category: row.category})
            MERGE (v)-[:HAS_TAG]->(t)
        """, batch=batch)

        session.run("""
            UNWIND $batch AS row
            MATCH (v:Vendor {partnerId: row.partnerId, category: row.category})
            UNWIND row.styles AS styleName
            MERGE (sf:StyleFilter {name: styleName})
            MERGE (v)-[:HAS_STYLE]->(sf)
        """, batch=batch)

        # Review 노드 -- 기존 Review 삭제 후 재생성 (Vendor 단위)
        session.run("""
            UNWIND $batch AS row
            MATCH (v:Vendor {partnerId: row.partnerId, category: row.category})-[r:HAS_REVIEW]->(rv:Review)
            DETACH DELETE rv
        """, batch=batch)

        session.run("""
            UNWIND $batch AS row
            MATCH (v:Vendor {partnerId: row.partnerId, category: row.category})
            UNWIND row.reviews AS rev
            CREATE (rv:Review {name: rev.name, contents: rev.contents,
                               score: rev.score, date: rev.date})
            CREATE (v)-[:HAS_REVIEW]->(rv)
        """, batch=batch)

        # Package 노드 -- 기존 Package 삭제 후 재생성 (Vendor 단위)
        session.run("""
            UNWIND $batch AS row
            MATCH (v:Vendor {partnerId: row.partnerId, category: row.category})-[r:HAS_PACKAGE]->(p:Package)
            DETACH DELETE p
        """, batch=batch)

        session.run("""
            UNWIND $batch AS row
            MATCH (v:Vendor {partnerId: row.partnerId, category: row.category})
            UNWIND row.packages AS pkg
            CREATE (p:Package {title: pkg.title, value: pkg.value, desc: pkg.desc})
            CREATE (v)-[:HAS_PACKAGE]->(p)
        """, batch=batch)

        print(f"  [{category}] {min(i+len(batch), len(items))}/{len(items)}")

    cnt = session.run(
        "MATCH (v:Vendor {category: $cat}) RETURN count(v) AS cnt", cat=category
    ).single()["cnt"]
    print(f"  -> [{category}] Vendor 노드 {cnt}개 완료\n")


def create_tag_co_occurs(session, category):
    """같은 카테고리에서 같은 Vendor에 동시 등장하는 Tag 쌍에 CO_OCCURS 관계 생성"""
    session.run("""
        MATCH (v:Vendor {category: $cat})-[:HAS_TAG]->(t1:Tag {category: $cat}),
              (v)-[:HAS_TAG]->(t2:Tag {category: $cat})
        WHERE id(t1) < id(t2)
        WITH t1, t2, count(v) AS cnt
        WHERE cnt >= 2
        MERGE (t1)-[r:CO_OCCURS]->(t2)
        SET r.count = cnt
    """, cat=category)
    co_cnt = session.run("""
        MATCH (:Tag {category: $cat})-[r:CO_OCCURS]->(:Tag {category: $cat})
        RETURN count(r) AS cnt
    """, cat=category).single()["cnt"]
    print(f"  -> [{category}] CO_OCCURS 관계 {co_cnt}개 생성\n")


# --────────────────────────────────────────
# 스드메 임베딩 생성
# --────────────────────────────────────────
CATEGORY_KR = {"studio": "스튜디오", "dress": "드레스", "makeup": "메이크업"}


def _clean_html(text):
    """HTML 태그 및 불필요한 공백 제거"""
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("\r\n", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", text).strip()


def _build_embedding_text(item, category):
    """Vendor 1개의 임베딩용 텍스트 조합"""
    parts = [
        item.get("name", ""),
        CATEGORY_KR.get(category, category),
        item.get("region", ""),
    ]

    tags = [t["name"] for t in item.get("tags", []) if t.get("name")]
    if tags:
        parts.append(" ".join(tags))

    detail = _clean_html(item.get("detailCmt", ""))
    if detail:
        parts.append(detail)

    reviews = sorted(
        [r for r in item.get("reviews", []) if r.get("contents")],
        key=lambda r: r.get("score", 0),
        reverse=True,
    )[:3]
    for r in reviews:
        parts.append(_clean_html(r["contents"])[:200])

    return " | ".join(p for p in parts if p)


def _build_hall_embedding_text(list_item, detail_item):
    """Hall 1개의 임베딩용 텍스트 조합"""
    name = (detail_item or {}).get("name") or list_item.get("partnerProfileName", "")
    region = list_item.get("region", "")
    sub_region = list_item.get("subRegion", "")

    parts = [name, "웨딩홀"]
    if region or sub_region:
        parts.append(f"{region} {sub_region}".strip())

    tags = [t["name"] for t in (detail_item or {}).get("tags", []) if t.get("name")]
    if tags:
        parts.append(" ".join(tags))

    styles = [s["name"] for s in (detail_item or {}).get("styleFilter", []) if s.get("name")]
    if styles:
        parts.append(" ".join(styles))

    memo = _clean_html((detail_item or {}).get("memoContent", ""))
    if memo:
        parts.append(memo[:500])

    benefits = []
    for b in list_item.get("benefits", []):
        if b.get("title"):
            benefits.append(b["title"])
    for b in (detail_item or {}).get("benefits", []):
        if b.get("title") and b["title"] not in benefits:
            benefits.append(b["title"])
    if benefits:
        parts.append(" ".join(benefits))

    return " | ".join(p for p in parts if p)


def create_hall_embeddings(session, list_items, detail_items):
    """Hall 노드에 embedding 속성 추가"""
    detail_map = {int(x["partnerId"]): x for x in detail_items if "partnerId" in x}

    texts, partner_ids = [], []
    for li in list_items:
        pid = int(li.get("partnerId")) if li.get("partnerId") is not None else None
        if pid is None:
            continue
        di = detail_map.get(pid)
        texts.append(_build_hall_embedding_text(li, di))
        partner_ids.append(pid)

    print(f"  [hall] 임베딩 생성 중... ({len(texts)}개)")
    embeddings = _batch_embed(texts)

    for i in range(0, len(embeddings), 100):
        batch = [
            {"partnerId": partner_ids[j], "embedding": embeddings[j]}
            for j in range(i, min(i + 100, len(embeddings)))
        ]
        session.run("""
            UNWIND $batch AS row
            MATCH (h:Hall {partnerId: row.partnerId})
            SET h.embedding = row.embedding
        """, batch=batch)

    print(f"  -> [hall] 임베딩 {len(embeddings)}개 저장 완료")


def _batch_embed(texts, batch_size=100):
    """OpenAI 임베딩 API 배치 호출"""
    embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        resp = openai_client.embeddings.create(input=batch, model=EMBEDDING_MODEL)
        embeddings.extend([d.embedding for d in resp.data])
    return embeddings


def create_vendor_embeddings(session, items, category):
    """Vendor 노드에 embedding 속성 추가"""
    texts = [_build_embedding_text(item, category) for item in items]
    partner_ids = [item.get("partnerId", 0) for item in items]

    print(f"  [{category}] 임베딩 생성 중... ({len(texts)}개)")
    embeddings = _batch_embed(texts)

    for i in range(0, len(embeddings), 100):
        batch = [
            {"partnerId": partner_ids[j], "embedding": embeddings[j]}
            for j in range(i, min(i + 100, len(embeddings)))
        ]
        session.run("""
            UNWIND $batch AS row
            MATCH (v:Vendor {partnerId: row.partnerId, category: $cat})
            SET v.embedding = row.embedding
        """, batch=batch, cat=category)

    print(f"  -> [{category}] 임베딩 {len(embeddings)}개 저장 완료")


def create_vector_index(session):
    """Vendor 벡터 인덱스 생성 (기존 인덱스 있으면 삭제 후 재생성)"""
    existing = session.run("SHOW INDEXES YIELD name, type WHERE type = 'VECTOR' RETURN name").data()
    for idx in existing:
        name = idx["name"]
        session.run(f"DROP INDEX {name}")
        print(f"  기존 벡터 인덱스 삭제: {name}")

    session.run("""
        CREATE VECTOR INDEX vendor_embedding_index IF NOT EXISTS
        FOR (v:Vendor) ON (v.embedding)
        OPTIONS {indexConfig: {
            `vector.dimensions`: $dim,
            `vector.similarity_function`: 'COSINE'
        }}
    """, dim=EMBEDDING_DIM)
    print(f"  -> vendor_embedding_index 생성 완료 (dim={EMBEDDING_DIM}, cosine)")

    session.run("""
        CREATE VECTOR INDEX hall_embedding_index IF NOT EXISTS
        FOR (h:Hall) ON (h.embedding)
        OPTIONS {indexConfig: {
            `vector.dimensions`: $dim,
            `vector.similarity_function`: 'COSINE'
        }}
    """, dim=EMBEDDING_DIM)
    print(f"  -> hall_embedding_index 생성 완료 (dim={EMBEDDING_DIM}, cosine)")


# --────────────────────────────────────────
# 웨딩홀 (Hall 노드) -- DB.py 로직 그대로
# --────────────────────────────────────────
def _upsert_hall(tx, list_item, detail_item):
    partnerId    = list_item.get("partnerId")
    partnerUuid  = list_item.get("partnerUuid")
    subRegion    = list_item.get("subRegion")
    region       = list_item.get("region")

    if detail_item:
        name        = detail_item.get("name") or list_item.get("partnerProfileName")
        tel         = detail_item.get("tel")
        address     = detail_item.get("address")
        address2    = detail_item.get("address2")
        profileUrl  = detail_item.get("profileUrl")
        reviewCnt   = detail_item.get("reviewCnt")
        rating      = detail_item.get("rating")
        memoContent = detail_item.get("memoContent")
        typeName    = detail_item.get("typeName")
        modTsp      = detail_item.get("modTsp")
        logoUrl     = detail_item.get("logoUrl")
        coverUrl    = detail_item.get("coverUrl")
        uuid        = detail_item.get("uuid") or partnerUuid
    else:
        name = list_item.get("partnerProfileName")
        tel = address = address2 = profileUrl = reviewCnt = rating = memoContent = modTsp = None
        typeName = "웨딩홀"
        logoUrl = coverUrl = None
        uuid = partnerUuid

    props = {
        "partnerId": partnerId, "uuid": uuid, "name": name, "typeName": typeName,
        "region": region, "subRegion": subRegion, "tel": tel, "address": address,
        "address2": address2, "logoUrl": logoUrl, "coverUrl": coverUrl,
        "profileUrl": profileUrl, "reviewCnt": reviewCnt, "rating": rating,
        "memoContent": memoContent, "modTsp": modTsp,
        "minIndividualHallPrice": list_item.get("minIndividualHallPrice"),
        "maxIndividualHallPrice": list_item.get("maxIndividualHallPrice"),
        "minRentalPrice":  list_item.get("minRentalPrice"),
        "maxRentalPrice":  list_item.get("maxRentalPrice"),
        "minMealPrice":    list_item.get("minMealPrice"),
        "maxMealPrice":    list_item.get("maxMealPrice"),
        "availableContract": list_item.get("availableContract"),
        "bookingState":      list_item.get("bookingState"),
        "consultingUsed":    list_item.get("consultingUsed"),
        "consultingUseAutoApproval": list_item.get("consultingUseAutoApproval"),
        "storedToConsulting": list_item.get("storedToConsulting"),
        "isLike":            list_item.get("isLike"),
        "partnerProfileId":   list_item.get("partnerProfileId"),
        "partnerProfileUuid": list_item.get("partnerProfileUuid"),
        "partnerProfileName": list_item.get("partnerProfileName"),
    }
    tx.run("MERGE (h:Hall {partnerId:$partnerId}) SET h += $props",
           partnerId=partnerId, props=props)

    if region:
        tx.run("""
            MATCH (h:Hall {partnerId:$pid})
            MERGE (r:Region {name:$region})
            MERGE (h)-[:IN_REGION]->(r)
        """, pid=partnerId, region=region)
    if subRegion:
        tx.run("""
            MATCH (h:Hall {partnerId:$pid})
            MERGE (d:District {name:$d})
            MERGE (h)-[:IN_DISTRICT]->(d)
        """, pid=partnerId, d=subRegion)

    for img in (list_item.get("partnerProfileImages") or []):
        url = img.get("url")
        if not url:
            continue
        tx.run("""
            MATCH (h:Hall {partnerId:$pid})
            MERGE (i:Image {url:$url})
            ON CREATE SET i.title=$title
            MERGE (h)-[:HAS_IMAGE]->(i)
        """, pid=partnerId, url=url, title=img.get("title"))

    for b in (list_item.get("benefits") or []):
        key = f"{b.get('title','')}//{b.get('tag','')}"
        tx.run("""
            MATCH (h:Hall {partnerId:$pid})
            MERGE (bn:Benefit {uuid:$key})
            ON CREATE SET bn.title=$title, bn.content=$content, bn.badge=$badge, bn.iconUrl=$iconUrl
            MERGE (h)-[:HAS_BENEFIT]->(bn)
        """, pid=partnerId, key=key, title=b.get("title"),
             content=b.get("content"), badge=b.get("tag"), iconUrl=b.get("iconUrl"))

    for code in (list_item.get("eventTagCds") or []):
        tx.run("""
            MATCH (h:Hall {partnerId:$pid})
            MERGE (e:EventTag {code:$code})
            MERGE (h)-[:HAS_EVENT_TAG]->(e)
        """, pid=partnerId, code=code)

    if detail_item:
        for t in (detail_item.get("tags") or []):
            tx.run("""
                MATCH (h:Hall {partnerId:$pid})
                MERGE (tg:Tag {type:$type, name:$name})
                ON CREATE SET tg.typeName=$typeName
                MERGE (h)-[:HAS_TAG]->(tg)
            """, pid=partnerId, type=t.get("type"),
                 typeName=t.get("typeName"), name=t.get("name"))

        for b in (detail_item.get("benefits") or []):
            buuid = b.get("uuid")
            if not buuid:
                continue
            tx.run("""
                MATCH (h:Hall {partnerId:$pid})
                MERGE (bn:Benefit {uuid:$uuid})
                ON CREATE SET bn.title=$title, bn.content=$content,
                              bn.badge=$badge, bn.iconUrl=$iconUrl, bn.linkUrl=$linkUrl
                MERGE (h)-[:HAS_BENEFIT]->(bn)
            """, pid=partnerId, uuid=buuid, title=b.get("title"),
                 content=b.get("content"), badge=b.get("badge"),
                 iconUrl=b.get("iconUrl"), linkUrl=b.get("linkUrl"))

        for sf in (detail_item.get("styleFilter") or []):
            sid = sf.get("id")
            if sid is None:
                continue
            tx.run("""
                MATCH (h:Hall {partnerId:$pid})
                MERGE (s:StyleFilter {id:$id})
                ON CREATE SET s.name=$name, s.partnerType=$pt
                MERGE (h)-[:HAS_STYLE_FILTER]->(s)
            """, pid=partnerId, id=sid, name=sf.get("name"), pt=sf.get("partnerType"))


def insert_halls(session, list_items, detail_items):
    detail_map = {int(x["partnerId"]): x for x in detail_items if "partnerId" in x}
    total = len(list_items)
    for idx, li in enumerate(list_items, 1):
        pid = int(li.get("partnerId")) if li.get("partnerId") is not None else None
        di = detail_map.get(pid) if pid is not None else None
        session.execute_write(_upsert_hall, li, di)
        if idx % 50 == 0 or idx == total:
            print(f"  [hall] {idx}/{total}")
    cnt = session.run("MATCH (h:Hall) RETURN count(h) AS cnt").single()["cnt"]
    print(f"  -> [hall] Hall 노드 {cnt}개 완료\n")


# --────────────────────────────────────────
# 메인
# --────────────────────────────────────────
def main():
    clean = "--clean" in sys.argv

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PW))

    with driver.session() as session:
        if clean:
            print("[mode] --clean: 전체 삭제 후 재적재")
            setup(session)
        else:
            print("[mode] upsert: 기존 데이터 유지, 신규/변경분만 MERGE")
            setup_constraints(session)

        # 스드메
        for category, path in VENDOR_FILES.items():
            print(f"[{category}] 로딩 시작...")
            items = load_json(path)
            print(f"  {len(items)}개 항목 로드됨")
            insert_vendors(session, items, category)

        # Tag 동시출현 관계
        for category in VENDOR_FILES:
            create_tag_co_occurs(session, category)

        # 지오코딩 (캐시 활용)
        print("\n[geocoding] 지오코딩 시작...")
        geocode_cache = _load_geocode_cache()
        print(f"  캐시 로드: {len(geocode_cache)}건")

        for category, path in VENDOR_FILES.items():
            items = load_json(path)
            geocode_vendors(session, items, category, geocode_cache)

        # 웨딩홀
        print("[hall] 로딩 시작...")
        list_items   = load_json(HALL_LIST_PATH)
        detail_items = load_json(HALL_DETAIL_PATH)
        print(f"  hall list source: {HALL_LIST_PATH}")
        print(f"  hall detail source: {HALL_DETAIL_PATH}")
        print(f"  list {len(list_items)}개 / detail {len(detail_items)}개 로드됨")
        insert_halls(session, list_items, detail_items)

        # 웨딩홀 지오코딩
        # detail에서 address 정보를 모아서 geocode
        detail_map = {int(x["partnerId"]): x for x in detail_items if "partnerId" in x}
        hall_addr_items = []
        for li in list_items:
            pid = int(li.get("partnerId")) if li.get("partnerId") is not None else None
            di = detail_map.get(pid) if pid is not None else None
            addr = (di.get("address") if di else None) or ""
            if addr and pid is not None:
                hall_addr_items.append({"address": addr, "partnerId": pid})
        geocode_halls(session, hall_addr_items, geocode_cache)

        # 캐시 저장
        _save_geocode_cache(geocode_cache)
        print(f"  캐시 저장 완료: {len(geocode_cache)}건")

        create_point_index(session)

        # 스드메 임베딩 생성 + 벡터 인덱스
        print("\n[embedding] 임베딩 생성 시작...")
        for category, path in VENDOR_FILES.items():
            items = load_json(path)
            create_vendor_embeddings(session, items, category)
        create_vector_index(session)

        # 웨딩홀 임베딩 생성
        print("\n[hall embedding] 임베딩 생성 시작...")
        create_hall_embeddings(session, list_items, detail_items)

        # 최종 통계
        total_nodes = session.run("MATCH (n) RETURN count(n) AS cnt").single()["cnt"]
        total_rels  = session.run("MATCH ()-[r]->() RETURN count(r) AS cnt").single()["cnt"]
        print(f"전체 로드 완료 -- 노드: {total_nodes}개 / 관계: {total_rels}개")

    driver.close()


if __name__ == "__main__":
    main()
