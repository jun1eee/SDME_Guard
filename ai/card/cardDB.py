import json
import re
from typing import List, Dict, Any, Set
from neo4j import GraphDatabase, basic_auth

# =========================
# 설정
# =========================
JSON_PATH = "card_gorilla_cards.json"

NEO4J_URI = "neo4j://127.0.0.1:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "20010910"

# =========================
# 유틸
# =========================
def clean_text(text: str | None) -> str | None:
    if not text:
        return None
    return re.sub(r"\s+", " ", text).strip()

def split_brand(brand_text: str | None) -> List[str]:
    if not brand_text:
        return []
    text = clean_text(brand_text) or ""
    # MastercardJCB 같은 붙은 문자열도 대응
    candidates = ["Mastercard", "VISA", "JCB", "AMEX", "UnionPay", "UPI", "LOCAL", "국내전용"]
    result = []
    for c in candidates:
        if c in text:
            result.append(c)
    return list(dict.fromkeys(result))

def parse_benefit_value(value: str | None) -> tuple[float | None, str | None]:
    if not value:
        return None, None

    value = value.strip()

    m = re.search(r"(\d+(?:\.\d+)?)\s*%", value)
    if m:
        return float(m.group(1)), "percent"

    m = re.search(r"([\d,]+)\s*원", value)
    if m:
        return float(m.group(1).replace(",", "")), "krw"

    if "면제" in value:
        return None, "waive"

    return None, "text"

# =========================
# 카테고리 분류 규칙
# =========================
CATEGORY_RULES = {
    "general_payment": [
        "국내외 가맹점", "국내 가맹점", "해외 이용금액", "일반 가맹점", "모든 가맹점", "해외 이용"
    ],
    "shopping": [
        "쇼핑", "온라인쇼핑", "온라인 장보기", "백화점", "면세점", "패션", "가전", "가구"
    ],
    "mart": [
        "마트", "슈퍼", "대형마트", "온라인장보기"
    ],
    "convenience_store": [
        "편의점"
    ],
    "cafe": [
        "커피", "카페", "스타벅스", "투썸", "이디야", "할리스", "메가MGC"
    ],
    "delivery": [
        "배달"
    ],
    "telecom": [
        "통신", "이동통신"
    ],
    "fuel": [
        "주유"
    ],
    "travel": [
        "여행", "항공", "호텔", "숙박", "렌터카", "면세점"
    ],
    "overseas": [
        "해외", "국제", "해외 이용", "해외겸용"
    ],
    "dining": [
        "외식", "레스토랑", "식음료", "다이닝", "푸드"
    ],
    "education": [
        "학원", "교육"
    ],
    "utility": [
        "생활요금", "공과금", "전기", "가스", "수도", "아파트관리비"
    ],
    "insurance": [
        "보험"
    ],
    "health_beauty": [
        "병원", "약국", "뷰티", "자기관리", "일상케어"
    ],
    "subscription": [
        "OTT", "구독", "멤버십", "APP"
    ],
    "cashback": [
        "캐시백"
    ],
    "installment": [
        "할부", "무이자할부"
    ],
    "fee_waiver": [
        "수수료 면제", "해외 이용 수수료 면제", "수수료우대"
    ]
}

PAYMENT_USECASE_RULES = {
    "웨딩홀": {"general_payment", "cashback", "installment"},
    "스드메": {"shopping", "general_payment", "installment", "health_beauty"},
    "혼수": {"shopping", "mart", "general_payment", "installment"},
    "신혼여행": {"travel", "overseas", "general_payment"}
}

def classify_categories(*texts: str | None) -> List[str]:
    joined = " ".join([t for t in texts if t])
    joined = clean_text(joined) or ""

    matched = set()

    for category, keywords in CATEGORY_RULES.items():
        for keyword in keywords:
            if keyword in joined:
                matched.add(category)
                break

    # 아무 것도 안 잡히는데 "할인/적립/캐시백"은 있는 경우 일반 결제로 보조 분류
    if not matched and any(x in joined for x in ["할인", "적립", "캐시백", "서비스"]):
        matched.add("general_payment")

    return sorted(matched)

def classify_payment_usecases(categories: List[str]) -> List[str]:
    cat_set = set(categories)
    result = []

    for usecase, needed in PAYMENT_USECASE_RULES.items():
        if cat_set & needed:
            result.append(usecase)

    return result

def normalize_benefit_type(raw_type: str | None, raw_desc: str | None) -> str:
    joined = f"{raw_type or ''} {raw_desc or ''}"

    if "캐시백" in joined:
        return "cashback"
    if "할인" in joined:
        return "discount"
    if "적립" in joined:
        return "point"
    if "수수료" in joined:
        return "fee_waiver"
    if "서비스" in joined:
        return "service"
    if "할부" in joined:
        return "installment"
    return "other"

def make_benefit_id(card_id: int, idx: int, source: str) -> str:
    return f"{card_id}_{source}_{idx}"

# =========================
# JSON -> Neo4j 구조화
# =========================
def transform_cards(raw_cards: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    transformed = []

    for card in raw_cards:
        card_id = card["card_id"]
        card_name = clean_text(card.get("name"))
        issuer = clean_text(card.get("issuer"))
        brands = split_brand(card.get("brand"))

        benefits = []
        usecases: Set[str] = set()

        # 1) summary_benefits
        for idx, item in enumerate(card.get("summary_benefits", []), start=1):
            category_raw = clean_text(item.get("category"))
            value_raw = clean_text(item.get("value"))
            desc_raw = clean_text(item.get("description"))

            benefit_value, benefit_unit = parse_benefit_value(value_raw)
            benefit_type = normalize_benefit_type(desc_raw, desc_raw)
            categories = classify_categories(category_raw, desc_raw, value_raw)
            payment_usecases = classify_payment_usecases(categories)

            usecases.update(payment_usecases)

            benefits.append({
                "benefit_id": make_benefit_id(card_id, idx, "summary"),
                "source": "summary",
                "title": category_raw,
                "raw_text": " ".join([x for x in [category_raw, value_raw, desc_raw] if x]),
                "benefit_type": benefit_type,
                "benefit_value": benefit_value,
                "benefit_unit": benefit_unit,
                "categories": categories,
                "payment_usecases": payment_usecases,
            })

        # 2) detail_benefits
        for idx, item in enumerate(card.get("detail_benefits", []), start=1):
            benefit_type_raw = clean_text(item.get("benefit_type"))
            section_title = clean_text(item.get("section_title"))
            raw_text = clean_text(item.get("raw_text"))
            raw_html = item.get("raw_html")

            benefit_type = normalize_benefit_type(benefit_type_raw, section_title)
            categories = classify_categories(benefit_type_raw, section_title, raw_text)
            payment_usecases = classify_payment_usecases(categories)

            usecases.update(payment_usecases)

            benefits.append({
                "benefit_id": make_benefit_id(card_id, idx, "detail"),
                "source": "detail",
                "title": section_title,
                "raw_text": raw_text,
                "raw_html": raw_html,
                "benefit_type": benefit_type,
                "benefit_value": None,
                "benefit_unit": None,
                "categories": categories,
                "payment_usecases": payment_usecases,
            })

        transformed.append({
            "card_id": card_id,
            "name": card_name,
            "issuer": issuer,
            "event_text": clean_text(card.get("event_text")),
            "image_url": card.get("image_url"),
            "annual_fee_domestic": card.get("annual_fee_domestic"),
            "annual_fee_overseas": card.get("annual_fee_overseas"),
            "previous_month_spending_text": clean_text(card.get("previous_month_spending_text")),
            "previous_month_spending_amount": card.get("previous_month_spending_amount"),
            "brands": brands,
            "usecases": sorted(usecases),
            "benefits": benefits
        })

    return transformed

# =========================
# Neo4j 적재
# =========================
def create_constraints(driver):
    queries = [
        "CREATE CONSTRAINT card_id_unique IF NOT EXISTS FOR (c:Card) REQUIRE c.card_id IS UNIQUE",
        "CREATE CONSTRAINT issuer_name_unique IF NOT EXISTS FOR (i:Issuer) REQUIRE i.name IS UNIQUE",
        "CREATE CONSTRAINT brand_name_unique IF NOT EXISTS FOR (b:Brand) REQUIRE b.name IS UNIQUE",
        "CREATE CONSTRAINT benefit_id_unique IF NOT EXISTS FOR (b:Benefit) REQUIRE b.benefit_id IS UNIQUE",
        "CREATE CONSTRAINT category_name_unique IF NOT EXISTS FOR (c:Category) REQUIRE c.name IS UNIQUE",
        "CREATE CONSTRAINT usecase_name_unique IF NOT EXISTS FOR (u:PaymentUseCase) REQUIRE u.name IS UNIQUE",
    ]
    with driver.session() as session:
        for q in queries:
            session.run(q)

def insert_card(tx, card: Dict[str, Any]):
    tx.run("""
    MERGE (c:Card {card_id: $card_id})
    SET c.name = $name,
        c.event_text = $event_text,
        c.image_url = $image_url,
        c.annual_fee_domestic = $annual_fee_domestic,
        c.annual_fee_overseas = $annual_fee_overseas,
        c.previous_month_spending_text = $previous_month_spending_text,
        c.previous_month_spending_amount = $previous_month_spending_amount
    """, **card)

    tx.run("""
    MERGE (i:Issuer {name: $issuer})
    WITH i
    MATCH (c:Card {card_id: $card_id})
    MERGE (c)-[:ISSUED_BY]->(i)
    """, issuer=card["issuer"], card_id=card["card_id"])

    for brand in card.get("brands", []):
        tx.run("""
        MERGE (b:Brand {name: $brand})
        WITH b
        MATCH (c:Card {card_id: $card_id})
        MERGE (c)-[:HAS_BRAND]->(b)
        """, brand=brand, card_id=card["card_id"])

    for usecase in card.get("usecases", []):
        tx.run("""
        MERGE (u:PaymentUseCase {name: $usecase})
        WITH u
        MATCH (c:Card {card_id: $card_id})
        MERGE (c)-[:SUITABLE_FOR]->(u)
        """, usecase=usecase, card_id=card["card_id"])

    for benefit in card.get("benefits", []):
        tx.run("""
        MERGE (b:Benefit {benefit_id: $benefit_id})
        SET b.source = $source,
            b.title = $title,
            b.raw_text = $raw_text,
            b.raw_html = $raw_html,
            b.benefit_type = $benefit_type,
            b.benefit_value = $benefit_value,
            b.benefit_unit = $benefit_unit
        WITH b
        MATCH (c:Card {card_id: $card_id})
        MERGE (c)-[:HAS_BENEFIT]->(b)
        """,
        benefit_id=benefit["benefit_id"],
        source=benefit.get("source"),
        title=benefit.get("title"),
        raw_text=benefit.get("raw_text"),
        raw_html=benefit.get("raw_html"),
        benefit_type=benefit.get("benefit_type"),
        benefit_value=benefit.get("benefit_value"),
        benefit_unit=benefit.get("benefit_unit"),
        card_id=card["card_id"])

        for category in benefit.get("categories", []):
            tx.run("""
            MERGE (cat:Category {name: $category})
            WITH cat
            MATCH (b:Benefit {benefit_id: $benefit_id})
            MERGE (b)-[:IN_CATEGORY]->(cat)
            """, category=category, benefit_id=benefit["benefit_id"])

def insert_all_to_neo4j(driver, transformed_cards: List[Dict[str, Any]], batch_size: int = 100):
    total = len(transformed_cards)

    with driver.session() as session:
        for idx, card in enumerate(transformed_cards, start=1):
            session.execute_write(insert_card, card)
            if idx % batch_size == 0 or idx == total:
                print(f"{idx}/{total} inserted")

# =========================
# 실행
# =========================
if __name__ == "__main__":
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        raw_cards = json.load(f)

    transformed_cards = transform_cards(raw_cards)

    # 확인용 샘플 출력
    print(json.dumps(transformed_cards[0], ensure_ascii=False, indent=2)[:4000])

    driver = GraphDatabase.driver(
        NEO4J_URI,
        auth=basic_auth(NEO4J_USER, NEO4J_PASSWORD)
    )

    try:
        create_constraints(driver)
        insert_all_to_neo4j(driver, transformed_cards, batch_size=100)
    finally:
        driver.close()