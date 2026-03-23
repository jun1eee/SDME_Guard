import json
import re
from typing import Any, Dict, List, Optional

SKIP_EXACT_TEXTS = {
    "꼭 확인하세요!",
    "꼭 확인해주세요!",
    "실물 없는 모바일 단독카드",
    "※ 해당 카드는 신규 발급이 중단되었습니다.",
    "※ 해당 카드는 신규 발급이 중단되었습니다",
}

PER_THRESHOLD_SPEND_RE = re.compile(
    r'연간\s*누적\s*이용금액\s*(\d+(?:,\d{3})*|\d+)\s*만원당\s*(\d{1,3}(?:,\d{3})*|\d+)\s*원'
)

# =========================
# 기본 정규식 도우미
# =========================

PERCENT_RE = re.compile(r'(\d+(?:\.\d+)?)\s*%')
WON_RE = re.compile(r'(\d{1,3}(?:,\d{3})*|\d+)\s*원')
MANWON_RE = re.compile(r'(\d+(?:\.\d+)?)\s*만원')
COUNT_RE = re.compile(r'(연|월|일|건당)?\s*(\d+)\s*회')
MAX_RE = re.compile(r'(최대|최고|up to)', re.IGNORECASE)

# 전월 30만원 이상 / 전월 이용금액 100만원 이상
PREV_MONTH_SPEND_RE = re.compile(
    r'전월(?:\s*(?:이용금액|이용실적|실적))?\s*(\d+(?:,\d{3})*|\d+)\s*만원\s*이상'
)

# 전년도 / 12개월 / 카드 발급 확정월 포함 12개월
QUALIFYING_SPEND_RE = re.compile(
    r'(전년도|최근\s*\d+\s*개월|(?:카드\s*발급.*?포함\s*)?\d+\s*개월).*?'
    r'이용\s*금액\s*(\d+(?:,\d{3})*|\d+)\s*만원\s*이상'
)

# 최소 결제금액
MIN_PAYMENT_RE = re.compile(
    r'(?:건당|최소)\s*(\d+(?:,\d{3})*|\d+)\s*원\s*이상'
)

ONLINE_RE = re.compile(r'온라인|온라인쇼핑|간편결제')
OFFLINE_RE = re.compile(r'오프라인|현장결제')
ADDITIONAL_RE = re.compile(r'\[?\s*추가혜택\s*\]?')
VOUCHER_RE = re.compile(r'바우처')
POINT_RE = re.compile(r'포인트|적립')
CASHBACK_RE = re.compile(r'캐시백|캐쉬백|캐시벡')
DISCOUNT_RE = re.compile(r'할인|청구할인|랗인|한인')
SERVICE_RE = re.compile(r'라운지|발렛|컨시어지|무료입장|제공서비스')
FEE_WAIVER_RE = re.compile(r'연회비\s*면제|면제')


# =========================
# 문자열/금액 파싱
# =========================

def clean_text(text: Optional[str]) -> str:
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()


def to_int_won(num_str: str, unit: str = "won") -> Optional[int]:
    if not num_str:
        return None
    num_str = num_str.replace(",", "").strip()
    try:
        value = float(num_str)
    except ValueError:
        return None

    if unit == "manwon":
        return int(value * 10000)
    return int(value)


def extract_percent(text: str) -> Optional[float]:
    m = PERCENT_RE.search(text)
    return float(m.group(1)) if m else None

def extract_benefit_amount_won(text: str) -> Optional[int]:
    if not text:
        return None

    # 1,000원당 / 1,500원당 같은 기준금액은 혜택금액이 아님
    if re.search(r'(\d{1,3}(?:,\d{3})*|\d+)\s*원\s*당', text):
        return None
    if re.search(r'\d+(?:\.\d+)?만원\s*당', text):
        return None

    # 1) 할인/캐시백/제공/증정/쿠폰/바우처 근처 금액 우선
    patterns = [
        r'(\d+(?:,\d{3})*|\d+)\s*원\s*(?:결제일\s*)?(?:청구\s*)?할인',
        r'(\d+(?:,\d{3})*|\d+)\s*원\s*캐시백',
        r'(\d+(?:,\d{3})*|\d+)\s*원\s*적립',
        r'(\d+(?:,\d{3})*|\d+)\s*원\s*(?:권\s*)?(?:제공|증정|교환)',
        r'(\d+(?:,\d{3})*|\d+)\s*원\s*(?:쿠폰|바우처)',
        r'(\d+(?:\.\d+)?)\s*만원\s*(?:상당\s*)?(?:바우처|쿠폰|제공|증정|교환|할인)',
    ]

    for p in patterns:
        m = re.search(p, text)
        if m:
            raw = m.group(1)
            if "만원" in m.group(0):
                return to_int_won(raw, "manwon")
            return to_int_won(raw, "won")

    # 2) fallback: 이상 앞 금액은 제외하고 마지막 금액 후보 사용
    all_amounts = []
    for m in re.finditer(r'(\d+(?:,\d{3})*|\d+)\s*원', text):
        snippet = text[m.end():m.end()+10]
        if "이상" in snippet:
            continue
        all_amounts.append(to_int_won(m.group(1), "won"))

    for m in re.finditer(r'(\d+(?:\.\d+)?)\s*만원', text):
        snippet = text[m.end():m.end()+10]
        if "이상" in snippet:
            continue
        all_amounts.append(to_int_won(m.group(1), "manwon"))

    return all_amounts[-1] if all_amounts else None

def extract_amount_won(text: str) -> Optional[int]:
    # "30만원" 우선
    m = MANWON_RE.search(text)
    if m:
        return to_int_won(m.group(1), "manwon")

    m = WON_RE.search(text)
    if m:
        return to_int_won(m.group(1), "won")

    return None


def extract_prev_month_spend(text: str) -> Optional[int]:
    m = PREV_MONTH_SPEND_RE.search(text)
    if m:
        return to_int_won(m.group(1), "manwon")
    return None


def extract_qualifying_spend(text: str) -> Dict[str, Any]:
    result = {
        "qualifying_period_type": None,
        "qualifying_period_months": None,
        "min_qualifying_spend": None,
    }

    # 연간 누적 1500만원당 30000원 같은 패턴
    m = PER_THRESHOLD_SPEND_RE.search(text)
    if m:
        threshold_raw = m.group(1)
        result["min_qualifying_spend"] = to_int_won(threshold_raw, "manwon")
        result["qualifying_period_type"] = "yearly_per_threshold"
        result["qualifying_period_months"] = 12
        return result

    m = QUALIFYING_SPEND_RE.search(text)
    if not m:
        return result

    period_raw = clean_text(m.group(1))
    amount_raw = m.group(2)

    result["min_qualifying_spend"] = to_int_won(amount_raw, "manwon")

    if "전년도" in period_raw:
        result["qualifying_period_type"] = "yearly"
        result["qualifying_period_months"] = 12
    elif "12개월" in period_raw and "발급" in text:
        result["qualifying_period_type"] = "card_anniversary_12m"
        result["qualifying_period_months"] = 12
    elif "12개월" in period_raw:
        result["qualifying_period_type"] = "rolling_12m"
        result["qualifying_period_months"] = 12
    else:
        result["qualifying_period_type"] = "custom"

    return result

def extract_frequency(text: str) -> Dict[str, Any]:
    result = {
        "reward_frequency_type": "none",
        "reward_frequency_count": None,
    }

    m = COUNT_RE.search(text)
    if not m:
        return result

    prefix = m.group(1)
    count = int(m.group(2))

    if prefix == "연":
        result["reward_frequency_type"] = "yearly"
    elif prefix == "월":
        result["reward_frequency_type"] = "monthly"
    elif prefix == "일":
        result["reward_frequency_type"] = "daily"
    else:
        result["reward_frequency_type"] = "per_txn"

    result["reward_frequency_count"] = count
    return result


# =========================
# 분류 로직
# =========================

def classify_benefit_type(text: str, raw_category: Optional[str] = None) -> str:
    full_text = f"{raw_category or ''} {text}".strip()

    if FEE_WAIVER_RE.search(full_text):
        return "면제"

    if re.search(r'무이자', full_text):
        return "서비스"

    if re.search(r'수수료 우대|수수료 무료|ATM수수료|무료 주차|무료이용|무료 이용|영화 \d+회 무료|총 \d+회 영화 무료', full_text):
        return "서비스"

    if re.search(r'무료숙박|레스토랑 무료|수수료우대|수수료 우대|현금카드 기능|후불 하이패스|하이패스 결제|해외ATM|전자세금계산서|상권분석|유가보조금|유류세 환급', full_text):
        return "서비스"

    # 여기 3개를 먼저
    if CASHBACK_RE.search(full_text):
        return "캐시백"

    if DISCOUNT_RE.search(full_text):
        return "할인"

    if POINT_RE.search(full_text) or re.search(r'마일|마일리지', full_text):
        return "적립"

    # 그 다음 제공형
    if re.search(r'바우처|기프트|이용권|교환|리워드|제공|쿠폰|항공권|숙박권|선택서비스|선물', full_text):
        return "제공"

    # 팩/옵션은 standalone일 때만
    if re.search(r'(^|[\s\[\(])(Pack|PACK|패키지|선택형|Option|옵션)([\s\]\)]|$)', full_text, re.IGNORECASE):
        return "제공"

    if re.search(r'해외이용 안내|현금카드기능|현금카드 기능|후불하이패스|하이패스 전용 기능|결제 기능|터치 결제 가능|환율.*우대|CMA|자동투자|금리 최대|수익율|수익률|소득공제 혜택', full_text):
        return "서비스"

    if re.search(r'선불카드|상품권|증정|발송|사진카드 발급|콘도 1박 무료|무료$', full_text):
        return "제공"

    if re.search(r'Gift Option|Free Package|Priority Pass|LoungeKey|PP카드|Premium Services?', full_text, re.IGNORECASE):
        return "제공"

    if SERVICE_RE.search(full_text) or re.search(r'라운지|발렛|컨시어지|보험|무료입장|우대서비스|서비스', full_text):
        return "서비스"

    if raw_category and "바우처" in raw_category:
        return "제공"

    return "기타"

def classify_benefit_class(text: str, benefit_type: str, raw_category: Optional[str] = None) -> str:
    qualifying = extract_qualifying_spend(text)
    full_text = f"{raw_category or ''} {text}".strip()

    # 연간 누적 1500만원당 30000원 같은 패턴은 milestone
    if re.search(r'연간\s*누적.*만원당', full_text):
        return "milestone"

    if qualifying["min_qualifying_spend"]:
        return "milestone"

    if benefit_type in ("할인", "캐시백", "적립"):
        if MAX_RE.search(full_text) or "월 최대" in full_text or "건당 최대" in full_text:
            return "capped"
        return "transactional"

    if benefit_type == "제공":
        if re.search(r'할인|적립|캐시백|캐쉬백', full_text):
            if MAX_RE.search(full_text) or "월 최대" in full_text or "건당 최대" in full_text:
                return "capped"
            return "transactional"

        if re.search(r'연\s*\d+\s*회|매년|전년도|\d+\s*개월|\d+\s*만원\s*이상', full_text):
            return "milestone"

        if re.search(r'쿠폰|항공권|숙박권|패키지|택1|택\s*1|선택서비스|무료', full_text):
            return "milestone"

        if raw_category and "바우처" in raw_category:
            return "milestone"

        return "service"

    if benefit_type == "서비스":
        return "service"

    if benefit_type == "면제":
        return "fee_waiver"

    return "service"

def classify_unit_and_value(text: str, benefit_type: str) -> Dict[str, Any]:
    result = {
        "benefit_unit": "text",
        "benefit_value": None,
        "benefit_cap_type": "none",
        "benefit_cap_amount": None,
    }

    # 연간 누적 1500만원당 30000원 캐시백
    m = PER_THRESHOLD_SPEND_RE.search(text)
    if m:
        reward_raw = m.group(2)
        result["benefit_unit"] = "amount"
        result["benefit_value"] = to_int_won(reward_raw, "won")
        return result

    cap_amount = extract_cap_amount_won(text)

    if cap_amount is not None:
        result["benefit_cap_type"] = "max"
        result["benefit_cap_amount"] = cap_amount

    percent = extract_percent(text)
    amount = extract_benefit_amount_won(text)

    if benefit_type in ("할인", "캐시백", "적립"):
        if percent is not None:
            result["benefit_unit"] = "percent"
            result["benefit_value"] = percent
        elif amount is not None:
            result["benefit_unit"] = "amount"
            result["benefit_value"] = amount
        elif cap_amount is not None:
            # "최대 7천원 할인", "월 최대 6천원 캐시백" 같은 문장 보정
            result["benefit_unit"] = "amount"
            result["benefit_value"] = cap_amount

    elif benefit_type == "제공":
        if re.search(r'바우처|기프트|이용권|교환|쿠폰', text):
            result["benefit_unit"] = "voucher"
            result["benefit_value"] = amount if amount is not None else cap_amount
        elif amount is not None:
            result["benefit_unit"] = "amount"
            result["benefit_value"] = amount
        elif cap_amount is not None:
            result["benefit_unit"] = "amount"
            result["benefit_value"] = cap_amount

    elif benefit_type == "면제":
        result["benefit_unit"] = "text"

    elif benefit_type == "서비스":
        result["benefit_unit"] = "text"

    return result

def extract_cap_amount_won(text: str) -> Optional[int]:
    if not text:
        return None

    patterns = [
        r'월\s*최대\s*(\d{1,3}(?:,\d{3})*|\d+)\s*원',
        r'건당\s*최대\s*(\d{1,3}(?:,\d{3})*|\d+)\s*원',
        r'최대\s*(\d{1,3}(?:,\d{3})*|\d+)\s*원',
        r'할인한도\s*(\d{1,3}(?:,\d{3})*|\d+)\s*원',
        r'월\s*최대\s*(\d{1,3}(?:,\d{3})*|\d+)\s*머니',
        r'최대\s*(\d{1,3}(?:,\d{3})*|\d+)\s*머니',
        r'월\s*최대\s*(\d+)\s*천원',
        r'최대\s*(\d+)\s*천원',
        r'월\s*최대\s*(\d+)\s*만\s*(\d+)\s*천',
        r'최대\s*(\d+)\s*만\s*(\d+)\s*천',
        r'월\s*최대\s*(\d+(?:\.\d+)?)\s*만원',
        r'건당\s*최대\s*(\d+(?:\.\d+)?)\s*만원',
        r'최대\s*(\d+(?:\.\d+)?)\s*만원',
    ]

    for pattern in patterns:
        m = re.search(pattern, text)
        if not m:
            continue

        s = m.group(0)

        # 2만 5천
        if len(m.groups()) == 2 and "만" in s and "천" in s:
            man = int(m.group(1))
            chun = int(m.group(2))
            return man * 10000 + chun * 1000

        # 6천원
        if "천원" in s:
            return int(m.group(1)) * 1000

        # 4만 머니 / 40000머니
        if "머니" in s:
            return int(m.group(1).replace(",", ""))

        # 만원
        if "만원" in s:
            return to_int_won(m.group(1), "manwon")

        # 원
        return to_int_won(m.group(1), "won")

    return None

def detect_flags(text: str) -> Dict[str, Any]:
    return {
        "is_additional_benefit": bool(ADDITIONAL_RE.search(text)),
        "online_only": bool(ONLINE_RE.search(text)),
        "offline_only": bool(OFFLINE_RE.search(text)),
    }


def determine_score_flags(
    benefit_class: str,
    benefit_type: str,
    benefit_unit: str,
    benefit_value: Any,
    text: str
) -> Dict[str, Any]:
    txn = False
    longterm = False
    confidence = "medium"
    exclusion_reason = None

    if benefit_class == "transactional":
        if benefit_unit in ("percent", "amount") and benefit_value is not None:
            txn = True
            confidence = "high"
        else:
            exclusion_reason = "transactional_but_no_numeric_value"
            confidence = "low"

    elif benefit_class == "capped":
        if benefit_unit in ("percent", "amount") and benefit_value is not None:
            txn = True
            confidence = "high"
        else:
            exclusion_reason = "capped_but_no_numeric_value"
            confidence = "low"

    elif benefit_class == "milestone":
        if extract_qualifying_spend(text)["min_qualifying_spend"] and benefit_value is not None:
            longterm = True
            confidence = "high"
        elif benefit_unit in ("voucher", "amount") and benefit_value is not None:
            longterm = True
            confidence = "medium"
        else:
            longterm = False
            confidence = "low"
            exclusion_reason = "milestone_condition_incomplete"

    elif benefit_class in ("service", "fee_waiver"):
        txn = False
        longterm = False
        confidence = "medium"

    return {
        "is_calculable_txn_score": txn,
        "is_calculable_longterm_score": longterm,
        "parse_confidence": confidence,
        "exclusion_reason": exclusion_reason,
    }

def should_skip_fragment(text: str) -> bool:
    t = clean_text(text)

    if not t:
        return True

    if t in SKIP_EXACT_TEXTS:
        return True

    if len(t) <= 3:
        return True

    if "신규 발급이 중단" in t:
        return True

    t_compact = re.sub(r"\s+", "", t)

    if t_compact in {
        "해당카드는신규발급중단되었습니다.",
        "해당카드는신규발급중단되었습니다",
        "※해당카드는신규발급이중단되었습니다.",
        "※해당카드는신규발급이중단되었습니다",
    }:
        return True
    
    if re.search(r'제휴 혜택|관련 혜택|카드 안내|혜택 카드|마음에 드는', t):
        return True

    if re.fullmatch(r'꼭 확인하세요!?|꼭 확인해주세요!?', t):
        return True
    
    if re.search(r'해외이용 안내|공통 안내|이용방법|결제 혜택$|혜택 공통 안내|꼭 알아두세요!?|꼭 읽어보세요!?', t):
        return True

    if re.search(r'카드란\?|제도란\?|사업 지역 안내|유형을 선택|디자인 선택|통합$', t):
        return True
        

    if t in {
        "플레이트",
        "카드 디자인 선택",
        "플레이트 디자인 선택 가능",
        "플레이트 디자인 선택가능",
    }:
        return True

    has_numeric = bool(re.search(r"\d|%|만원|원|회", t))
    has_benefit_word = bool(re.search(r"할인|적립|캐시백|캐쉬백|제공|쿠폰|바우처|서비스|교환|면제|무료", t))

    if not has_numeric and not has_benefit_word:
        simple_label_like = [
            "CGV, 메가박스",
            "CGV, 롯데시네마",
            "스타벅스, 커피빈",
            "소셜커머스",
            "택시",
            "GS25, 세븐일레븐, CU",
            "파리바게트, 뚜레쥬르",
            "아웃백·VIPS·TGIF·세븐스프링스",
        ]
        if t in simple_label_like:
            return True

    return False

def normalize_category(raw_category: Optional[str]) -> Optional[str]:
    if not raw_category:
        return None

    category = clean_text(raw_category)

    mapping = {
        "반려동물 관련": "반려동물",
        "온라인 쇼핑": "온라인쇼핑",
        "온라인결제": "온라인쇼핑",
        "웨딩 관련": "웨딩",
        "스드메 관련": "스드메",
    }

    return mapping.get(category, category)

def parse_benefit_fragment(
    raw_category: Optional[str],
    raw_text: str,
    source_section: str,
    raw_value: Optional[str] = None,
    raw_description: Optional[str] = None,
    analysis_text: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    text = clean_text(raw_text)

    if should_skip_fragment(text):
        return None

    analysis = clean_text(
        analysis_text or f"{text} {raw_value or ''} {raw_description or ''}"
    )

    benefit_type = classify_benefit_type(
        analysis,
        raw_category=raw_category
    )

    benefit_class = classify_benefit_class(
        analysis,
        benefit_type,
        raw_category=raw_category
    )

    unit_info = classify_unit_and_value(analysis, benefit_type)
    flags = detect_flags(analysis)
    prev_month_spend = extract_prev_month_spend(analysis)
    qualifying = extract_qualifying_spend(analysis)
    frequency = extract_frequency(analysis)

    score_flags = determine_score_flags(
        benefit_class=benefit_class,
        benefit_type=benefit_type,
        benefit_unit=unit_info["benefit_unit"],
        benefit_value=unit_info["benefit_value"],
        text=analysis
    )

    return {
        "source_section": source_section,
        "raw_category": raw_category,
        "normalized_category": normalize_category(raw_category),
        "raw_benefit_text": text,
        "analysis_text": analysis,
        "benefit_type": benefit_type,
        "benefit_class": benefit_class,
        "benefit_unit": unit_info["benefit_unit"],
        "benefit_value": unit_info["benefit_value"],
        "benefit_cap_type": unit_info["benefit_cap_type"],
        "benefit_cap_amount": unit_info["benefit_cap_amount"],
        "per_txn_cap_amount": extract_per_txn_cap_amount(analysis),
        "monthly_cap_amount": extract_monthly_cap_amount(analysis),
        "min_previous_month_spend": prev_month_spend,
        "qualifying_period_type": qualifying["qualifying_period_type"],
        "qualifying_period_months": qualifying["qualifying_period_months"],
        "min_qualifying_spend": qualifying["min_qualifying_spend"],
        "reward_frequency_type": frequency["reward_frequency_type"],
        "reward_frequency_count": frequency["reward_frequency_count"],
        "online_only": flags["online_only"],
        "offline_only": flags["offline_only"],
        "is_additional_benefit": flags["is_additional_benefit"],
        "is_calculable_txn_score": score_flags["is_calculable_txn_score"],
        "is_calculable_longterm_score": score_flags["is_calculable_longterm_score"],
        "parse_confidence": score_flags["parse_confidence"],
        "exclusion_reason": score_flags["exclusion_reason"],
        "raw_value": raw_value,
        "raw_description": raw_description,
    }

PER_TXN_CAP_RE = re.compile(
    r'(?:결제\s*건당|건당).*?최대(?:\s*(?:캐시백|할인|적립))?(?:\s*금액)?\s*[:：]?\s*'
    r'(\d{1,3}(?:,\d{3})*|\d+\s*천|\d+\s*만\s*\d+\s*천|\d+(?:\.\d+)?\s*만원|\d+)'
)

MONTHLY_CAP_RE = re.compile(
    r'(?:통합\s*)?(?:월간|월)?\s*(?:캐시백|할인|적립)?\s*한도\s*'
    r'(\d{1,3}(?:,\d{3})*|\d+|\d+\s*천|\d+\s*만원|\d+\s*만\s*\d+\s*천)'
)

def parse_loose_amount_to_won(text: str) -> Optional[int]:
    text = clean_text(text)
    if not text:
        return None

    # 2만 5천원 / 1만5천원
    m = re.search(r'(\d+)\s*만\s*(\d+)\s*천(?:원)?', text)
    if m:
        return int(m.group(1)) * 10000 + int(m.group(2)) * 1000

    # 7천원
    m = re.search(r'(\d+)\s*천(?:원)?', text)
    if m:
        return int(m.group(1)) * 1000

    # 1.5만원 / 1만원
    m = re.search(r'(\d+(?:\.\d+)?)\s*만원', text)
    if m:
        return to_int_won(m.group(1), "manwon")

    # 7,000원 / 7000
    m = re.search(r'(\d{1,3}(?:,\d{3})*|\d+)', text)
    if m:
        return to_int_won(m.group(1), "won")

    return None

def extract_per_txn_cap_amount(text: str) -> Optional[int]:
    m = PER_TXN_CAP_RE.search(text)
    if not m:
        return None
    return parse_loose_amount_to_won(m.group(1))


def extract_monthly_cap_amount(text: str) -> Optional[int]:
    m = MONTHLY_CAP_RE.search(text)
    if not m:
        return None
    return parse_loose_amount_to_won(m.group(1))

# =========================
# 카드 전체 파싱
# =========================

def dedup_keep_order(items: List[str]) -> List[str]:
    result = []
    seen = set()
    for item in items:
        if item and item not in seen:
            result.append(item)
            seen.add(item)
    return result

NOTE_CATEGORY_RE = re.compile(r'유의사항|안내')
HIGH_SIGNAL_NOTE_RE = re.compile(r'한도|최대|전월|실적|제외|적립률|할인율|캐시백|할인|적립')

def collect_note_lines(card: Dict[str, Any]) -> List[str]:
    lines = []

    for sec in card.get("detail_sections", []) or []:
        category = clean_text(sec.get("category"))
        if not NOTE_CATEGORY_RE.search(category or ""):
            continue

        for line in sec.get("detail_lines", []) or []:
            line = clean_text(line)
            if line and HIGH_SIGNAL_NOTE_RE.search(line):
                lines.append(line)

        for table in sec.get("tables", []) or []:
            for row in table[1:]:
                row_text = " | ".join([clean_text(x) for x in row if clean_text(x)])
                if row_text:
                    lines.append(row_text)

    return dedup_keep_order(lines)


def build_section_analysis_text(sec: Dict[str, Any], global_note_lines: List[str]) -> str:
    chunks = []

    summary = clean_text(sec.get("summary"))
    if summary:
        chunks.append(summary)

    for line in sec.get("detail_lines", []) or []:
        line = clean_text(line)
        if line:
            chunks.append(line)

    for line in global_note_lines:
        line = clean_text(line)
        if not line:
            continue

        if re.search(r'(한도|최대|전월|실적)', line) and re.search(r'(\d|천원|만원|%)', line):
            chunks.append(line)

    chunks = dedup_keep_order([x for x in chunks if x])
    return " ".join(chunks)

def parse_card(card: Dict[str, Any]) -> Dict[str, Any]:
    card_id = card.get("card_id")
    card_name = card.get("name")
    parsed_benefits: List[Dict[str, Any]] = []

    global_note_lines = collect_note_lines(card)

    has_non_note_detail = any(
        not NOTE_CATEGORY_RE.search(clean_text(sec.get("category")) or "")
        and clean_text(sec.get("summary"))
        for sec in card.get("detail_sections", []) or []
    )

    # detail이 없을 때만 summary 사용
    if not has_non_note_detail:
        for item in card.get("summary_benefits", []) or []:
            category = item.get("category")
            value = item.get("value")
            description = item.get("description")

            raw_text = " ".join([x for x in [category, value, description] if x]).strip()

            parsed = parse_benefit_fragment(
                raw_category=category,
                raw_text=raw_text,
                source_section="summary_benefit",
                raw_value=value,
                raw_description=description,
                analysis_text=raw_text
            )
            if parsed:
                parsed["card_id"] = card_id
                parsed["card_name"] = card_name
                parsed_benefits.append(parsed)

    # detail_sections는 non-note section만 본 혜택으로 파싱
    for sec in card.get("detail_sections", []) or []:
        category = clean_text(sec.get("category"))
        summary = clean_text(sec.get("summary"))

        if NOTE_CATEGORY_RE.search(category or ""):
            continue

        if not summary:
            continue

        analysis_text = build_section_analysis_text(sec, global_note_lines)

        parsed = parse_benefit_fragment(
            raw_category=category,
            raw_text=summary,
            source_section="detail_section_main",
            analysis_text=analysis_text
        )
        if parsed:
            parsed["card_id"] = card_id
            parsed["card_name"] = card_name
            parsed_benefits.append(parsed)

    # dedupe
    deduped = []
    seen = set()
    for b in parsed_benefits:
        key = (
            b["card_id"],
            b.get("normalized_category"),
            b.get("benefit_type"),
            b.get("benefit_unit"),
            str(b.get("benefit_value")),
            str(b.get("per_txn_cap_amount")),
            str(b.get("monthly_cap_amount")),
            str(b.get("min_previous_month_spend")),
            str(b.get("min_qualifying_spend")),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(b)

    return {
        "card_id": card_id,
        "card_name": card_name,
        "parsed_benefits": deduped,
    }

def parse_cards_from_file(json_path: str) -> List[Dict[str, Any]]:
    with open(json_path, "r", encoding="utf-8") as f:
        cards = json.load(f)

    results = []
    for card in cards:
        results.append(parse_card(card))
    return results

# =========================
# 실행 예시
# =========================

if __name__ == "__main__":
    sample_1 = {
        "card_id": 1,
        "name": "샘플카드A",
        "summary_benefits": [
            {
                "category": "반려동물 관련",
                "value": "최대 7%",
                "description": "캐시백"
            }
        ],
        "detail_sections": [
            {
                "category": "온라인쇼핑",
                "summary": "[추가혜택] 전월 이용금액 100만원 이상 시 10% 할인",
                "items": [],
                "tables": [],
                "plain_text": None
            },
            {
                "category": "바우처",
                "summary": "[추가혜택] 전년도(카드 발급 확정월 포함 12개월) 이용 금액 1,200만원 이상 시 30만원 바우처 제공(연 1회)",
                "items": [],
                "tables": [],
                "plain_text": None
            }
        ]
    }

    parsed = parse_card(sample_1)
    print(json.dumps(parsed, ensure_ascii=False, indent=2))