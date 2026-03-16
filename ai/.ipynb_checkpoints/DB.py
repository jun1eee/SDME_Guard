import json
import os
from neo4j import GraphDatabase

_BASE = os.path.dirname(os.path.abspath(__file__))

LIST_PATH   = os.path.join(_BASE, "json", "weddingbook_halls_list.json")
DETAIL_PATH = os.path.join(_BASE, "json", "weddingbook_halls_detail.json")

NEO4J_URI = "neo4j://127.0.0.1:7687"
NEO4J_USER = "neo4j"
NEO4J_PW = "password123"


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # 파일이 배열이거나, {"data":[...]} 형태일 수도 있어서 방어
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ["data", "items", "result", "partners"]:
            if key in data and isinstance(data[key], list):
                return data[key]
    raise ValueError(f"JSON 구조를 알 수 없음: {path}")


def build_maps(list_items, detail_items):
    # detail은 partnerId를 키로 잡는 게 가장 안정적
    detail_by_partnerId = {int(x["partnerId"]): x for x in detail_items if "partnerId" in x}

    merged = []
    for it in list_items:
        pid = int(it.get("partnerId")) if it.get("partnerId") is not None else None
        d = detail_by_partnerId.get(pid) if pid is not None else None
        merged.append((it, d))
    return merged


def upsert_hall(tx, list_item, detail_item):
    # list 기반 (없으면 기본값)
    partnerId = list_item.get("partnerId")
    partnerUuid = list_item.get("partnerUuid")
    subRegion = list_item.get("subRegion")
    region = list_item.get("region")

    # detail 기반 (있으면 덮어쓰기)
    if detail_item:
        name = detail_item.get("name") or list_item.get("partnerProfileName")
        tel = detail_item.get("tel")
        address = detail_item.get("address")
        profileUrl = detail_item.get("profileUrl")
        reviewCnt = detail_item.get("reviewCnt")
        rating = detail_item.get("rating")
        memoContent = detail_item.get("memoContent")
        typeName = detail_item.get("typeName")
        modTsp = detail_item.get("modTsp")
        uuid = detail_item.get("uuid") or partnerUuid
    else:
        # 상세가 없을 때도 리스트 정보로 최소 생성
        name = list_item.get("partnerProfileName")
        tel = None
        address = None
        profileUrl = None
        reviewCnt = None
        rating = None
        memoContent = None
        typeName = "웨딩홀"
        modTsp = None
        uuid = partnerUuid

    # 가격/식대(리스트에 있음)
    props = {
        "partnerId": partnerId,
        "uuid": uuid,
        "name": name,
        "typeName": typeName,
        "region": region,
        "subRegion": subRegion,
        "tel": tel,
        "address": address,
        "profileUrl": profileUrl,
        "reviewCnt": reviewCnt,
        "rating": rating,
        "memoContent": memoContent,
        "modTsp": modTsp,
        "minIndividualHallPrice": list_item.get("minIndividualHallPrice"),
        "maxIndividualHallPrice": list_item.get("maxIndividualHallPrice"),
        "minRentalPrice": list_item.get("minRentalPrice"),
        "maxRentalPrice": list_item.get("maxRentalPrice"),
        "minMealPrice": list_item.get("minMealPrice"),
        "maxMealPrice": list_item.get("maxMealPrice"),
        "availableContract": list_item.get("availableContract"),
        "bookingState": list_item.get("bookingState"),
        "partnerProfileId": list_item.get("partnerProfileId"),
        "partnerProfileUuid": list_item.get("partnerProfileUuid"),
        "partnerProfileName": list_item.get("partnerProfileName"),
    }

    tx.run(
        """
        MERGE (h:Hall {partnerId:$partnerId})
        SET h += $props
        """,
        partnerId=partnerId,
        props=props,
    )

    # Region / District 관계
    if region:
        tx.run(
            """
            MATCH (h:Hall {partnerId:$partnerId})
            MERGE (r:Region {name:$region})
            MERGE (h)-[:IN_REGION]->(r)
            """,
            region=region,
            partnerId=partnerId,
        )
    if subRegion:
        tx.run(
            """
            MATCH (h:Hall {partnerId:$partnerId})
            MERGE (d:District {name:$district})
            MERGE (h)-[:IN_DISTRICT]->(d)
            """,
            district=subRegion,
            partnerId=partnerId,
        )

    # 리스트 이미지
    images = list_item.get("partnerProfileImages") or []
    for img in images:
        url = img.get("url")
        title = img.get("title")
        if not url:
            continue
        tx.run(
            """
            MATCH (h:Hall {partnerId:$partnerId})
            MERGE (i:Image {url:$url})
            ON CREATE SET i.title=$title
            MERGE (h)-[:HAS_IMAGE]->(i)
            """,
            url=url,
            title=title,
            partnerId=partnerId,
        )

    # 리스트 benefits (title/content/tag 등)
    benefits_list = list_item.get("benefits") or []
    for b in benefits_list:
        key = f"{b.get('title','')}//{b.get('tag','')}"
        tx.run(
            """
            MATCH (h:Hall {partnerId:$partnerId})
            MERGE (bn:Benefit {uuid:$key})
            ON CREATE SET bn.title=$title, bn.content=$content, bn.badge=$badge, bn.iconUrl=$iconUrl
            MERGE (h)-[:HAS_BENEFIT]->(bn)
            """,
            key=key,
            title=b.get("title"),
            content=b.get("content"),
            badge=b.get("tag"),
            iconUrl=b.get("iconUrl"),
            partnerId=partnerId,
        )

    # 리스트 eventTagCds
    for code in (list_item.get("eventTagCds") or []):
        tx.run(
            """
            MATCH (h:Hall {partnerId:$partnerId})
            MERGE (e:EventTag {code:$code})
            MERGE (h)-[:HAS_EVENT_TAG]->(e)
            """,
            code=code,
            partnerId=partnerId,
        )

    # 상세 tags
    if detail_item:
        for t in (detail_item.get("tags") or []):
            tx.run(
                """
                MATCH (h:Hall {partnerId:$partnerId})
                MERGE (tg:Tag {type:$type, name:$name})
                ON CREATE SET tg.typeName=$typeName
                MERGE (h)-[:HAS_TAG]->(tg)
                """,
                type=t.get("type"),
                typeName=t.get("typeName"),
                name=t.get("name"),
                partnerId=partnerId,
            )

        # 상세 benefits (uuid 있음)
        for b in (detail_item.get("benefits") or []):
            buuid = b.get("uuid")
            if not buuid:
                continue
            tx.run(
                """
                MATCH (h:Hall {partnerId:$partnerId})
                MERGE (bn:Benefit {uuid:$uuid})
                ON CREATE SET bn.title=$title, bn.content=$content, bn.badge=$badge, bn.iconUrl=$iconUrl, bn.linkUrl=$linkUrl
                MERGE (h)-[:HAS_BENEFIT]->(bn)
                """,
                uuid=buuid,
                title=b.get("title"),
                content=b.get("content"),
                badge=b.get("badge"),
                iconUrl=b.get("iconUrl"),
                linkUrl=b.get("linkUrl"),
                partnerId=partnerId,
            )

        # styleFilter
        for sf in (detail_item.get("styleFilter") or []):
            sid = sf.get("id")
            if sid is None:
                continue
            tx.run(
                """
                MATCH (h:Hall {partnerId:$partnerId})
                MERGE (s:StyleFilter {id:$id})
                ON CREATE SET s.name=$name, s.partnerType=$partnerType
                MERGE (h)-[:HAS_STYLE_FILTER]->(s)
                """,
                id=sid,
                name=sf.get("name"),
                partnerType=sf.get("partnerType"),
                partnerId=partnerId,
            )


def main():
    list_items = load_json(LIST_PATH)
    detail_items = load_json(DETAIL_PATH)
    merged = build_maps(list_items, detail_items)

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PW))

    with driver.session() as session:
        for list_item, detail_item in merged:
            session.execute_write(upsert_hall, list_item, detail_item)

    driver.close()
    print("✅ 업로드 완료")


if __name__ == "__main__":
    main()