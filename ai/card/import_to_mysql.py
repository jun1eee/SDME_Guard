import json
import mysql.connector
from mysql.connector import Error
from typing import Dict, Any, Optional, List
from parsingMySql import parse_card

# -----------------------------
# DB 연결
# -----------------------------
def get_connection():
    return mysql.connector.connect(
        host="localhost",
        port=3306,
        user="root",
        password="gunhee0516@",
        database="card_recommend",
        charset="utf8mb4"
    )


# -----------------------------
# 마스터 ID 조회/생성
# -----------------------------
def get_or_create_issuer(conn, issuer_name: str) -> int:
    cursor = conn.cursor()
    cursor.execute(
        "SELECT issuer_id FROM issuers WHERE issuer_name = %s",
        (issuer_name,)
    )
    row = cursor.fetchone()
    if row:
        cursor.close()
        return row[0]

    cursor.execute(
        "INSERT INTO issuers (issuer_name) VALUES (%s)",
        (issuer_name,)
    )
    issuer_id = cursor.lastrowid
    cursor.close()
    return issuer_id


def get_or_create_category(conn, category_name: Optional[str]) -> Optional[int]:
    if not category_name:
        return None

    cursor = conn.cursor()
    cursor.execute(
        "SELECT category_id FROM benefit_categories WHERE category_name = %s",
        (category_name,)
    )
    row = cursor.fetchone()
    if row:
        cursor.close()
        return row[0]

    cursor.execute(
        "INSERT INTO benefit_categories (category_name) VALUES (%s)",
        (category_name,)
    )
    category_id = cursor.lastrowid
    cursor.close()
    return category_id


def get_or_create_benefit_type(conn, benefit_type_name: str) -> int:
    cursor = conn.cursor()
    cursor.execute(
        "SELECT benefit_type_id FROM benefit_types WHERE benefit_type_name = %s",
        (benefit_type_name,)
    )
    row = cursor.fetchone()
    if row:
        cursor.close()
        return row[0]

    cursor.execute(
        "INSERT INTO benefit_types (benefit_type_name) VALUES (%s)",
        (benefit_type_name,)
    )
    benefit_type_id = cursor.lastrowid
    cursor.close()
    return benefit_type_id


# -----------------------------
# cards 저장
# -----------------------------
def insert_card(conn, card: Dict[str, Any]) -> None:
    issuer_name = card.get("issuer") or "미상"
    issuer_id = get_or_create_issuer(conn, issuer_name)

    cursor = conn.cursor()
    sql = """
    INSERT INTO cards (
        card_id,
        issuer_id,
        card_name,
        detail_url,
        image_url,
        annual_fee_domestic,
        annual_fee_overseas,
        annual_fee_detail_text,
        apply_status_text,
        is_discontinued,
        discontinued_text,
        previous_month_spending_text,
        previous_month_spending_amount
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE
        issuer_id = VALUES(issuer_id),
        card_name = VALUES(card_name),
        detail_url = VALUES(detail_url),
        image_url = VALUES(image_url),
        annual_fee_domestic = VALUES(annual_fee_domestic),
        annual_fee_overseas = VALUES(annual_fee_overseas),
        annual_fee_detail_text = VALUES(annual_fee_detail_text),
        apply_status_text = VALUES(apply_status_text),
        is_discontinued = VALUES(is_discontinued),
        discontinued_text = VALUES(discontinued_text),
        previous_month_spending_text = VALUES(previous_month_spending_text),
        previous_month_spending_amount = VALUES(previous_month_spending_amount)
    """
    cursor.execute(sql, (
        card.get("card_id"),
        issuer_id,
        card.get("name"),
        card.get("url"),
        card.get("image_url"),
        card.get("annual_fee_domestic") or 0,
        card.get("annual_fee_overseas") or 0,
        card.get("annual_fee_detail_text"),
        card.get("apply_status_text"),
        1 if card.get("is_discontinued") else 0,
        card.get("discontinued_text"),
        card.get("previous_month_spending_text"),
        card.get("previous_month_spending_amount"),
    ))
    cursor.close()


def insert_card_brands(conn, card: Dict[str, Any]) -> None:
    brands = card.get("brand") or []
    if isinstance(brands, str):
        brands = [brands]

    cursor = conn.cursor()
    cursor.execute("DELETE FROM card_brands WHERE card_id = %s", (card["card_id"],))

    for brand in brands:
        brand = str(brand).strip()
        if not brand:
            continue
        cursor.execute(
            "INSERT INTO card_brands (card_id, brand_name) VALUES (%s, %s)",
            (card["card_id"], brand)
        )
    cursor.close()


def insert_raw_card_import(conn, card: Dict[str, Any], source_name: str = "card_gorilla") -> None:
    cursor = conn.cursor()
    sql = """
    INSERT INTO raw_card_imports (source_name, raw_card_id, raw_json)
    VALUES (%s, %s, %s)
    ON DUPLICATE KEY UPDATE
        raw_json = VALUES(raw_json)
    """
    cursor.execute(sql, (
        source_name,
        card.get("card_id"),
        json.dumps(card, ensure_ascii=False)
    ))
    cursor.close()


# -----------------------------
# raw fragment 저장
# -----------------------------
def insert_raw_fragment(
    conn,
    raw_card_id: int,
    card_id: int,
    source_section: str,
    raw_category: Optional[str],
    raw_value: Optional[str],
    raw_description: Optional[str],
    raw_text: Optional[str],
    fragment_order: int
) -> int:
    cursor = conn.cursor()
    sql = """
    INSERT INTO raw_card_benefit_fragments (
        raw_card_id, card_id, source_section,
        raw_category, raw_value, raw_description, raw_text, fragment_order
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    cursor.execute(sql, (
        raw_card_id,
        card_id,
        source_section,
        raw_category,
        raw_value,
        raw_description,
        raw_text,
        fragment_order
    ))
    fragment_id = cursor.lastrowid
    cursor.close()
    return fragment_id

def normalize_reward_frequency_type(value: Optional[str]) -> str:
    allowed = {"none", "per_txn", "daily", "monthly", "yearly", "once"}
    if value in allowed:
        return value
    return "none"

# -----------------------------
# card_benefits / conditions 저장
# -----------------------------
def insert_card_benefit(conn, parsed: Dict[str, Any], source_fragment_id: Optional[int]) -> int:
    category_id = get_or_create_category(conn, parsed.get("normalized_category"))
    benefit_type_id = get_or_create_benefit_type(conn, parsed["benefit_type"])

    cursor = conn.cursor()
    sql = """
    INSERT INTO card_benefits (
        card_id,
        category_id,
        benefit_type_id,
        benefit_class,
        source_fragment_id,
        raw_benefit_text,
        benefit_unit,
        benefit_value,
        benefit_cap_type,
        benefit_cap_amount,
        benefit_cap_count,
        reward_frequency_type,
        reward_frequency_count,
        is_additional_benefit,
        is_calculable_txn_score,
        is_calculable_longterm_score,
        parse_confidence,
        exclusion_reason
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    cursor.execute(sql, (
        parsed["card_id"],
        category_id,
        benefit_type_id,
        parsed["benefit_class"],
        source_fragment_id,
        parsed["raw_benefit_text"],
        parsed["benefit_unit"],
        parsed["benefit_value"],
        normalize_benefit_cap_type(parsed["benefit_cap_type"]),
        parsed.get("benefit_cap_amount"),
        parsed.get("benefit_cap_count"),
        normalize_reward_frequency_type(parsed["reward_frequency_type"]),
        parsed["reward_frequency_count"],
        1 if parsed["is_additional_benefit"] else 0,
        1 if parsed["is_calculable_txn_score"] else 0,
        1 if parsed["is_calculable_longterm_score"] else 0,
        parsed["parse_confidence"],
        parsed["exclusion_reason"],
    ))
    benefit_id = cursor.lastrowid
    cursor.close()
    return benefit_id

def normalize_qualifying_period_type(value: Optional[str]) -> Optional[str]:
    allowed = {"yearly", "rolling_12m", "card_anniversary_12m", "custom"}
    if value in allowed:
        return value

    # 새 패턴은 우선 yearly로 다운캐스팅
    if value == "yearly_per_threshold":
        return "yearly"

    return None

def insert_benefit_condition(conn, benefit_id: int, parsed: Dict[str, Any]) -> None:
    cursor = conn.cursor()
    sql = """
    INSERT INTO benefit_conditions (
        benefit_id,
        min_previous_month_spend,
        qualifying_period_type,
        qualifying_period_months,
        min_qualifying_spend,
        online_only,
        offline_only,
        per_txn_cap_amount,
        monthly_cap_amount,
        condition_text
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    cursor.execute(sql, (
        benefit_id,
        parsed.get("min_previous_month_spend"),
        normalize_qualifying_period_type(parsed.get("qualifying_period_type")),
        parsed.get("qualifying_period_months"),
        parsed.get("min_qualifying_spend"),
        1 if parsed.get("online_only") else 0,
        1 if parsed.get("offline_only") else 0,
        parsed.get("per_txn_cap_amount"),
        parsed.get("monthly_cap_amount"),
        parsed.get("analysis_text") or parsed.get("raw_benefit_text"),
    ))
    cursor.close()

def normalize_benefit_cap_type(value: Optional[str]) -> str:
    allowed = {"none", "max"}
    if value in allowed:
        return value

    # rate_max 같은 새 타입은 일단 none으로 저장
    return "none"

# -----------------------------
# fragment 원문 추출 후 저장
# -----------------------------
def save_parsed_benefits(
    conn,
    card: Dict[str, Any],
    parsed_result: Dict[str, Any]
) -> None:
    parsed_benefits = parsed_result["parsed_benefits"]

    for fragment_order, parsed in enumerate(parsed_benefits):
        fragment_id = insert_raw_fragment(
            conn=conn,
            raw_card_id=card["card_id"],
            card_id=card["card_id"],
            source_section=parsed["source_section"],
            raw_category=parsed.get("raw_category"),
            raw_value=parsed.get("raw_value"),
            raw_description=parsed.get("raw_description"),
            raw_text=parsed.get("raw_benefit_text"),
            fragment_order=fragment_order
        )

        benefit_id = insert_card_benefit(conn, parsed, fragment_id)
        insert_benefit_condition(conn, benefit_id, parsed)
        
# -----------------------------
# 전체 실행
# parse_card는 이전에 만든 함수 사용
# -----------------------------
def process_cards(json_path: str, parse_card_func):
    with open(json_path, "r", encoding="utf-8") as f:
        cards = json.load(f)

    conn = get_connection()

    try:
        for idx, card in enumerate(cards, 1):
            insert_raw_card_import(conn, card)
            insert_card(conn, card)
            delete_existing_card_data(conn, card["card_id"])
            insert_card_brands(conn, card)

            parsed_result = parse_card_func(card)
            save_parsed_benefits(conn, card, parsed_result)

            if idx % 100 == 0:
                conn.commit()
                print(f"{idx}개 처리 완료")

        conn.commit()
        print("전체 처리 완료")

    except Exception as e:
        conn.rollback()
        print("에러 발생:", e)
        raise
    finally:
        conn.close()

def delete_existing_card_data(conn, card_id: int) -> None:
    cursor = conn.cursor()

    cursor.execute("""
        DELETE bc
        FROM benefit_conditions bc
        JOIN card_benefits cb ON bc.benefit_id = cb.benefit_id
        WHERE cb.card_id = %s
    """, (card_id,))

    cursor.execute("DELETE FROM card_benefits WHERE card_id = %s", (card_id,))
    cursor.execute("DELETE FROM raw_card_benefit_fragments WHERE card_id = %s", (card_id,))
    cursor.execute("DELETE FROM card_brands WHERE card_id = %s", (card_id,))

    cursor.close()

if __name__ == "__main__":
    process_cards("card_gorilla_cards.json", parse_card)