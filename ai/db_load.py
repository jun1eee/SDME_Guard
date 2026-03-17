import json
import os
from neo4j import GraphDatabase

# === 설정 ===
NEO4J_URI = "neo4j://127.0.0.1:7687"
NEO4J_USER = "neo4j"
NEO4J_PW = "password123"

# 스크립트 위치 기준으로 경로 설정 (어느 폴더에서 실행해도 동작)
_BASE = os.path.dirname(os.path.abspath(__file__))

VENDOR_FILES = {
    "dress":  os.path.join(_BASE, "json", "iwedding_dress_detail.json"),
    "makeup": os.path.join(_BASE, "json", "iwedding_makeup_detail.json"),
    "studio": os.path.join(_BASE, "json", "iwedding_studio_detail.json"),
}
HALL_LIST_PATH   = os.path.join(_BASE, "json", "weddingbook_halls_list.json")
HALL_DETAIL_PATH = os.path.join(_BASE, "json", "weddingbook_halls_detail.json")


# ──────────────────────────────────────────
# 공통 유틸
# ──────────────────────────────────────────
def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    for key in ["data", "items", "result", "partners"]:
        if key in data and isinstance(data[key], list):
            return data[key]
    raise ValueError(f"JSON 구조를 알 수 없음: {path}")


def setup(session):
    session.run("MATCH (n) DETACH DELETE n")
    print("기존 데이터 전체 삭제 완료")

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


# ──────────────────────────────────────────
# 스드메 (Vendor 노드)
# ──────────────────────────────────────────
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
                "packageInfoStr":  json.dumps(item.get("packageInfo", []), ensure_ascii=False),
                "addcostStr":      json.dumps(item.get("addcostOptions", []), ensure_ascii=False),
                "reviewsStr":      json.dumps(item.get("reviews", []), ensure_ascii=False),
                "detailCmt":       item.get("detailCmt", ""),
                "iweddingNo":      item.get("iwedding_no", ""),
                "enterpriseCode":  item.get("iwedding_enterprise_code", ""),
                "productName":     item.get("iwedding_product_name", ""),
                "subCategory":     item.get("iwedding_sub_category", ""),
                "tags":   [t["name"] for t in item.get("tags", []) if t.get("name")],
                "styles": [sf["name"] for sf in item.get("styleFilter", []) if sf.get("name")],
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
                holiday: row.holiday, packageInfoStr: row.packageInfoStr,
                addcostStr: row.addcostStr, reviewsStr: row.reviewsStr,
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

        print(f"  [{category}] {min(i+len(batch), len(items))}/{len(items)}")

    cnt = session.run(
        "MATCH (v:Vendor {category: $cat}) RETURN count(v) AS cnt", cat=category
    ).single()["cnt"]
    print(f"  → [{category}] Vendor 노드 {cnt}개 완료\n")


# ──────────────────────────────────────────
# 웨딩홀 (Hall 노드) — DB.py 로직 그대로
# ──────────────────────────────────────────
def _upsert_hall(tx, list_item, detail_item):
    partnerId    = list_item.get("partnerId")
    partnerUuid  = list_item.get("partnerUuid")
    subRegion    = list_item.get("subRegion")
    region       = list_item.get("region")

    if detail_item:
        name        = detail_item.get("name") or list_item.get("partnerProfileName")
        tel         = detail_item.get("tel")
        address     = detail_item.get("address")
        profileUrl  = detail_item.get("profileUrl")
        reviewCnt   = detail_item.get("reviewCnt")
        rating      = detail_item.get("rating")
        memoContent = detail_item.get("memoContent")
        typeName    = detail_item.get("typeName")
        modTsp      = detail_item.get("modTsp")
        uuid        = detail_item.get("uuid") or partnerUuid
    else:
        name = list_item.get("partnerProfileName")
        tel = address = profileUrl = reviewCnt = rating = memoContent = modTsp = None
        typeName = "웨딩홀"
        uuid = partnerUuid

    props = {
        "partnerId": partnerId, "uuid": uuid, "name": name, "typeName": typeName,
        "region": region, "subRegion": subRegion, "tel": tel, "address": address,
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
    print(f"  → [hall] Hall 노드 {cnt}개 완료\n")


# ──────────────────────────────────────────
# 메인
# ──────────────────────────────────────────
def main():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PW))

    with driver.session() as session:
        setup(session)

        # 스드메
        for category, path in VENDOR_FILES.items():
            print(f"[{category}] 로딩 시작...")
            items = load_json(path)
            print(f"  {len(items)}개 항목 로드됨")
            insert_vendors(session, items, category)

        # 웨딩홀
        print("[hall] 로딩 시작...")
        list_items   = load_json(HALL_LIST_PATH)
        detail_items = load_json(HALL_DETAIL_PATH)
        print(f"  list {len(list_items)}개 / detail {len(detail_items)}개 로드됨")
        insert_halls(session, list_items, detail_items)

        # 최종 통계
        total_nodes = session.run("MATCH (n) RETURN count(n) AS cnt").single()["cnt"]
        total_rels  = session.run("MATCH ()-[r]->() RETURN count(r) AS cnt").single()["cnt"]
        print(f"✅ 전체 로드 완료 — 노드: {total_nodes}개 / 관계: {total_rels}개")

    driver.close()


if __name__ == "__main__":
    main()
