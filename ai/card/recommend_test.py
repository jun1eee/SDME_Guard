import mysql.connector
from collections import defaultdict
from typing import Dict, List, Any, Tuple
import re

CONFLICT_KEYWORDS_BY_SPEND_TYPE = {
    "웨딩홀": [
        "외식", "음식점", "푸드", "커피", "카페", "디저트",
        "편의점", "배달", "영화", "주유", "통신", "마트",
        "백화점", "쇼핑", "기차", "KTX", "SRT", "숙박", "여행"
    ],
    "스튜디오": [
        "외식", "음식점", "푸드", "커피", "카페", "디저트",
        "편의점", "배달", "영화", "주유", "통신", "마트"
    ],
    "드레스": [
        "외식", "음식점", "푸드", "커피", "카페", "디저트",
        "편의점", "배달", "영화", "주유", "통신", "마트"
    ],
    "메이크업": [
        "외식", "음식점", "푸드", "커피", "카페", "디저트",
        "편의점", "배달", "영화", "주유", "통신", "마트"
    ],
}

MIN_TXN_PATTERNS = [
    re.compile(r'건별\s*(\d{1,3}(?:,\d{3})*|\d+)\s*원\s*이상'),
    re.compile(r'(\d{1,3}(?:,\d{3})*|\d+)\s*원\s*이상\s*결제\s*시'),
    re.compile(r'(\d{1,3}(?:,\d{3})*|\d+)\s*원\s*이상'),
]

def extract_min_txn_amount(raw_text: str) -> int | None:
    if not raw_text:
        return None

    for pattern in MIN_TXN_PATTERNS:
        m = pattern.search(raw_text)
        if m:
            return int(m.group(1).replace(",", ""))
    return None

def get_connection():
    return mysql.connector.connect(
        host="localhost",
        port=3306,
        user="root",
        password="gunhee0516@",
        database="card_recommend",
        charset="utf8mb4"
    )

def is_benefit_really_applicable(benefit: Dict[str, Any], spend_type: str) -> bool:
    text = (benefit.get("raw_benefit_text") or "").strip()
    category = (benefit.get("category_name") or "").strip()

    # milestone은 일단 허용
    if benefit.get("benefit_class") == "milestone":
        return True

    conflict_keywords = CONFLICT_KEYWORDS_BY_SPEND_TYPE.get(spend_type, [])
    for keyword in conflict_keywords:
        if keyword in text or keyword in category:
            return False

    return True

# 웨딩 서비스용 아주 단순한 결제 타입 매핑
SPEND_TYPE_CATEGORY_MAP = {
    "웨딩홀": ["웨딩홀", "결제시", "온라인결제", "캐시백", "포인트"],
    "스튜디오": ["스튜디오", "결제시", "온라인결제", "캐시백", "포인트"],
    "드레스": ["드레스", "결제시", "온라인결제", "캐시백", "포인트"],
    "메이크업": ["메이크업", "결제시", "온라인결제", "캐시백", "포인트"],
}

def get_user_id_by_name(conn, user_name: str) -> int:
    cursor = conn.cursor()
    cursor.execute(
        "SELECT user_id FROM users WHERE user_name = %s ORDER BY user_id DESC LIMIT 1",
        (user_name,)
    )
    row = cursor.fetchone()
    cursor.close()

    if not row:
        raise ValueError(f"user_name={user_name} 사용자를 찾을 수 없음")
    return row[0]


def get_user_cards(conn, user_id: int) -> List[Dict[str, Any]]:
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT
            c.card_id,
            c.card_name,
            c.is_discontinued,
            c.annual_fee_domestic,
            c.annual_fee_overseas
        FROM user_cards uc
        JOIN cards c ON c.card_id = uc.card_id
        WHERE uc.user_id = %s
          AND uc.is_active = 1
    """, (user_id,))
    rows = cursor.fetchall()
    cursor.close()
    return rows

def get_all_active_cards(conn) -> List[Dict[str, Any]]:
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT
            c.card_id,
            c.card_name,
            c.is_discontinued,
            c.annual_fee_domestic,
            c.annual_fee_overseas
        FROM cards c
        WHERE c.is_discontinued = 0
        ORDER BY c.card_id
    """)
    rows = cursor.fetchall()
    cursor.close()
    return rows

def is_global_longterm_benefit(benefit: Dict[str, Any]) -> bool:
    text = (benefit.get("raw_benefit_text") or "").strip()

    # milestone + 실제 계산 가능한 금액형만 허용
    if (
        benefit.get("benefit_class") == "milestone"
        and benefit.get("benefit_unit") in ("voucher", "amount")
        and benefit.get("benefit_value") is not None
    ):
        return True

    # 만원당/연간누적 패턴은 별도 허용
    if re.search(r'연간\s*누적\s*이용금액.*만원당.*원', text):
        return True

    return False

def calculate_annual_fee_penalty(card: Dict[str, Any]) -> float:
    fee = card.get("annual_fee_domestic")
    if fee is None:
        return 0.0
    return float(fee)

def score_cards_common(cards: List[Dict[str, Any]], spend_type: str, amount: int, top_n: int = 10, apply_annual_fee_penalty: bool = False) -> List[Dict[str, Any]]:
    conn = get_connection()

    try:
        if not cards:
            return []

        card_map = {card["card_id"]: card for card in cards}
        card_ids = list(card_map.keys())

        all_benefits = get_all_benefits_for_cards(conn, card_ids)
        all_benefits = dedupe_benefits(all_benefits)
        filtered_benefits = filter_benefits_for_spend_type(all_benefits, spend_type)
        filtered_benefits = choose_best_benefits_per_card(filtered_benefits)
        
        grouped = defaultdict(list)
        for benefit in filtered_benefits:
            grouped[benefit["card_id"]].append(benefit)

        results = []
        for card_id, card in card_map.items():
            instant_score = 0.0
            longterm_score = 0.0
            matched_benefits = []

            for benefit in grouped.get(card_id, []):
                inst = calculate_instant_score(benefit, amount)
                inst = apply_category_weight(benefit, spend_type, inst)

                if is_allowed_longterm_cashback(benefit):
                    longt = calculate_longterm_score(benefit, amount)
                else:
                    longt = 0.0

                instant_score += inst
                longterm_score += longt

                benefit_score = inst + longt
                if benefit_score > 0:
                    matched_benefits.append({
                        "category": benefit.get("category_name"),
                        "text": benefit["raw_benefit_text"],
                        "benefit_class": benefit["benefit_class"],
                        "score": round(benefit_score, 2),
                    })

            annual_fee_penalty = calculate_annual_fee_penalty(card) if apply_annual_fee_penalty else 0.0
            total_score = instant_score + longterm_score - annual_fee_penalty

            results.append({
                "card_id": card_id,
                "card_name": card["card_name"],
                "instant_score": round(instant_score, 2),
                "longterm_score": round(longterm_score, 2),
                "annual_fee_penalty": round(annual_fee_penalty, 2),
                "total_score": round(total_score, 2),
                "matched_benefits": sorted(matched_benefits, key=lambda x: x["score"], reverse=True),
            })

        results.sort(key=lambda x: x["total_score"], reverse=True)
        return results[:top_n]

    finally:
        conn.close()

def get_all_benefits_for_cards(conn, card_ids: List[int]) -> List[Dict[str, Any]]:
    if not card_ids:
        return []

    placeholders = ",".join(["%s"] * len(card_ids))
    sql = f"""
        SELECT
            cb.benefit_id,
            cb.card_id,
            cb.raw_benefit_text,
            cb.benefit_class,
            cb.benefit_unit,
            cb.benefit_value,
            cb.benefit_cap_type,
            cb.benefit_cap_amount,
            cb.is_calculable_txn_score,
            cb.is_calculable_longterm_score,
            bc.category_name,
            bcond.min_previous_month_spend,
            bcond.min_qualifying_spend,
            bcond.qualifying_period_type
        FROM card_benefits cb
        LEFT JOIN benefit_categories bc
            ON bc.category_id = cb.category_id
        LEFT JOIN benefit_conditions bcond
            ON bcond.benefit_id = cb.benefit_id
        WHERE cb.card_id IN ({placeholders})
    """

    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, tuple(card_ids))
    rows = cursor.fetchall()
    cursor.close()
    return rows


def dedupe_benefits(benefits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set[Tuple] = set()
    deduped = []

    for b in benefits:
        key = (
            b["card_id"],
            b.get("category_name"),
            b.get("raw_benefit_text"),
            b.get("benefit_class"),
            b.get("benefit_unit"),
            str(b.get("benefit_value")),
            str(b.get("benefit_cap_amount")),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(b)

    return deduped

def is_allowed_longterm_cashback(benefit: Dict[str, Any]) -> bool:
    text = (benefit.get("raw_benefit_text") or "").strip()
    category = (benefit.get("category_name") or "").strip()

    if benefit.get("benefit_class") != "milestone":
        return False

    if "캐시백" in text or "캐쉬백" in text:
        return True

    if category == "캐시백":
        return True

    return False

def filter_benefits_for_spend_type(benefits: List[Dict[str, Any]], spend_type: str) -> List[Dict[str, Any]]:
    allowed_categories = SPEND_TYPE_CATEGORY_MAP.get(spend_type, [])

    filtered = []

    for b in benefits:
        category_name = b.get("category_name")
        benefit_class = b.get("benefit_class")
        text = (b.get("raw_benefit_text") or "").strip()

        # 1. 누적 캐시백은 예외 허용
        if is_allowed_longterm_cashback(b):
            filtered.append(b)
            continue

        # 2. 웨딩 추천에서는 즉시 결제형만 허용
        if benefit_class not in ("transactional", "capped"):
            continue

        # 3. 특수혜택 제외
        if re.search(r'바우처|기프트|홀인원|라운지|숙박권|항공권|PP카드|Lounge|보험|컨시어지|프리미엄', text, re.IGNORECASE):
            continue

        # 4. 허용 카테고리만 통과
        if category_name in allowed_categories and is_benefit_really_applicable(b, spend_type):
            filtered.append(b)

    return filtered

def choose_best_benefits_per_card(benefits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    picked = {}

    for b in benefits:
        key = (
            b["card_id"],
            b.get("category_name"),
            b.get("benefit_class"),
            b.get("benefit_unit"),
            str(b.get("benefit_value")),
            str(b.get("benefit_cap_amount")),
        )

        prev = picked.get(key)
        if prev is None:
            picked[key] = b
            continue

        prev_text = prev.get("raw_benefit_text") or ""
        curr_text = b.get("raw_benefit_text") or ""

        # 더 구체적인 설명(보통 더 긴 문장)을 남김
        if len(curr_text) > len(prev_text):
            picked[key] = b

    return list(picked.values())

def calculate_instant_score(benefit, amount):
    if benefit["benefit_class"] not in ("transactional", "capped"):
        return 0.0

    value = benefit.get("benefit_value")
    if value is None:
        return 0.0

    if benefit["benefit_unit"] == "percent":
        score = amount * (float(value) / 100.0)
    elif benefit["benefit_unit"] == "amount":
        score = float(value)
    else:
        return 0.0

    cap_amount = benefit.get("benefit_cap_amount")
    if cap_amount is not None:
        score = min(score, float(cap_amount))

    return score

def apply_category_weight(benefit: Dict[str, Any], spend_type: str, score: float) -> float:
    category = benefit.get("category_name") or ""

    if spend_type in ("웨딩홀", "스튜디오", "드레스", "메이크업"):
        if category == "간편결제":
            return score
        if category == "결제시":
            return score

    return score

def calculate_longterm_score(benefit: Dict[str, Any], amount: int) -> float:
    if benefit["benefit_class"] != "milestone":
        return 0.0

    value = benefit.get("benefit_value")
    if value is None:
        return 0.0

    if benefit["benefit_unit"] not in ("voucher", "amount"):
        return 0.0

    threshold = benefit.get("min_qualifying_spend")
    if threshold:
        threshold = float(threshold)
        if amount < threshold:
            return 0.0

        repeat_count = int(amount // threshold)
        return float(value) * repeat_count

    return float(value)

def recommend_for_user(user_name: str, spend_type: str, amount: int, top_n: int = 10) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        user_id = get_user_id_by_name(conn, user_name)
        cards = get_user_cards(conn, user_id)
    finally:
        conn.close()

    return score_cards_common(
        cards=cards,
        spend_type=spend_type,
        amount=amount,
        top_n=top_n,
        apply_annual_fee_penalty=False
    )

def recommend_all_cards(spend_type: str, amount: int, top_n: int = 10) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cards = get_all_active_cards(conn)
    finally:
        conn.close()

    return score_cards_common(
        cards=cards,
        spend_type=spend_type,
        amount=amount,
        top_n=top_n,
        apply_annual_fee_penalty=True
    )

if __name__ == "__main__":
    user_name = "temp_user_01"
    spend_type = "웨딩홀"
    amount = 15000000

    print("\n[보유 카드 추천]")
    owned_recommendations = recommend_for_user(user_name, spend_type, amount, top_n=5)

    for idx, rec in enumerate(owned_recommendations, 1):
        print(f"{idx}. {rec['card_name']}")
        print(f"   - 즉시 혜택 점수: {rec['instant_score']:.0f}원")
        print(f"   - 누적 혜택 점수: {rec['longterm_score']:.0f}원")
        print(f"   - 총점: {rec['total_score']:.0f}원")
        for b in rec["matched_benefits"][:3]:
            print(f"     * [{b['category']}] {b['text']} -> {b['score']:.0f}원")
        print()

    print("\n[전체 카드 추천]")
    all_recommendations = recommend_all_cards(spend_type, amount, top_n=5)

    for idx, rec in enumerate(all_recommendations, 1):
        print(f"{idx}. {rec['card_name']}")
        print(f"   - 즉시 혜택 점수: {rec['instant_score']:.0f}원")
        print(f"   - 누적 혜택 점수: {rec['longterm_score']:.0f}원")
        print(f"   - 연회비 패널티: {rec['annual_fee_penalty']:.0f}원")
        print(f"   - 총점: {rec['total_score']:.0f}원")
        for b in rec["matched_benefits"][:3]:
            print(f"     * [{b['category']}] {b['text']} -> {b['score']:.0f}원")
        print()