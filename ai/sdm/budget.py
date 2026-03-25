"""예산 플래너 — 카테고리별 배분, 숨은 비용, 예산 적합성 분석"""

DEFAULT_ALLOCATION_RATIO = {
    "웨딩홀": 0.45,
    "스튜디오": 0.20,
    "드레스": 0.20,
    "메이크업": 0.10,
    "기타": 0.05,
}

HIDDEN_COSTS = {
    "스튜디오": [
        {"name": "원판 구매비", "min": 100000, "max": 500000, "desc": "보정 전 원본 사진 구매"},
        {"name": "헬퍼 비용", "min": 100000, "max": 200000, "desc": "촬영 보조 인력"},
        {"name": "토요일 추가금", "min": 100000, "max": 300000, "desc": "주말(토요일) 촬영 추가 요금"},
    ],
    "드레스": [
        {"name": "속드레스", "min": 50000, "max": 150000, "desc": "드레스 안에 입는 이너웨어"},
        {"name": "베일/글러브/슈즈", "min": 100000, "max": 500000, "desc": "드레스 소품 별도 대여/구매"},
        {"name": "벌수 추가", "min": 200000, "max": 800000, "desc": "추가 드레스 벌수 대여 비용"},
    ],
    "메이크업": [
        {"name": "리허설 추가", "min": 50000, "max": 200000, "desc": "본식 전 리허설 메이크업"},
        {"name": "어머니 메이크업", "min": 100000, "max": 300000, "desc": "양가 어머니 메이크업 비용"},
        {"name": "터치업", "min": 50000, "max": 150000, "desc": "본식 중 메이크업 수정"},
    ],
    "웨딩홀": [
        {"name": "주차/발렛", "min": 100000, "max": 500000, "desc": "주차 대행 및 발렛 서비스"},
        {"name": "사회자/축가", "min": 200000, "max": 500000, "desc": "전문 사회자 및 축가 섭외"},
        {"name": "영상/사진 추가", "min": 300000, "max": 1000000, "desc": "본식 스냅, DVD 촬영 등"},
    ],
}

# 카테고리 한글 → 영문 매핑
_KO_TO_EN = {
    "웨딩홀": "hall", "스튜디오": "studio", "드레스": "dress",
    "메이크업": "makeup", "기타": "etc",
}


def allocate_budget(
    total: int,
    priorities: list[str] | None = None,
) -> dict:
    """총 예산을 카테고리별로 배분. priorities에 있는 카테고리는 비율 +5%p 상향."""
    ratios = dict(DEFAULT_ALLOCATION_RATIO)

    if priorities:
        boost = 0.05
        boosted = []
        for p in priorities:
            p_norm = p.strip()
            if p_norm in ratios:
                ratios[p_norm] += boost
                boosted.append(p_norm)

        if boosted:
            total_boost = boost * len(boosted)
            non_boosted = [k for k in ratios if k not in boosted]
            if non_boosted:
                deduction = total_boost / len(non_boosted)
                for k in non_boosted:
                    ratios[k] = max(ratios[k] - deduction, 0.02)

    # 비율 정규화 (합이 1.0이 되도록)
    ratio_sum = sum(ratios.values())
    if ratio_sum > 0:
        ratios = {k: v / ratio_sum for k, v in ratios.items()}

    result = {}
    for cat, ratio in ratios.items():
        amount = int(total * ratio)
        result[cat] = {
            "ratio": round(ratio * 100, 1),
            "amount": amount,
            "amount_display": _format_won(amount),
        }

    return {
        "total_budget": total,
        "total_display": _format_won(total),
        "allocation": result,
    }


def get_hidden_costs(category: str) -> list[dict] | None:
    """카테고리별 숨은 비용 목록 반환."""
    costs = HIDDEN_COSTS.get(category)
    if not costs:
        return None
    result = []
    for c in costs:
        result.append({
            "name": c["name"],
            "range": f"{_format_won(c['min'])} ~ {_format_won(c['max'])}",
            "desc": c["desc"],
        })
    return result


def check_budget_fit(
    vendor_prices: dict[str, int],
    current_budget: dict[str, int],
) -> dict:
    """업체 가격이 예산에 맞는지 분석.

    vendor_prices: {"스튜디오": 1500000, "드레스": 2000000, ...}
    current_budget: {"스튜디오": 2000000, "드레스": 2500000, ...}
    """
    analysis = {}
    total_vendor = 0
    total_budget = 0

    for cat, price in vendor_prices.items():
        budget = current_budget.get(cat, 0)
        diff = budget - price
        total_vendor += price
        total_budget += budget
        analysis[cat] = {
            "vendor_price": _format_won(price),
            "budget": _format_won(budget),
            "remaining": _format_won(abs(diff)),
            "status": "within" if diff >= 0 else "over",
            "status_display": "여유" if diff >= 0 else "초과",
        }

    return {
        "categories": analysis,
        "total_vendor": _format_won(total_vendor),
        "total_budget": _format_won(total_budget),
        "total_remaining": _format_won(abs(total_budget - total_vendor)),
        "overall_status": "within" if total_budget >= total_vendor else "over",
    }


def format_budget_allocation(total: int, result: dict) -> str:
    """예산 배분 결과를 마크다운으로 포맷"""
    lines = [f"**총 예산 {total // 10000:,}만원** 배분 추천:\n"]
    for name, info in result["allocation"].items():
        amount = info["amount"]
        ratio = info["ratio"] / 100  # ratio is stored as percentage (e.g. 45.0)
        lines.append(f"- **{name}**: {amount // 10000:,}만원 ({ratio:.0%})")

    # 각 카테고리의 숨은 비용 안내
    hidden = []
    for name in result["allocation"]:
        costs = get_hidden_costs(name)
        if costs:
            for c in costs:
                hidden.append(f"- {c['name']}: {c['range']} ({c['desc']})")
    if hidden:
        lines.append("\n**숨은 비용 주의:**")
        for h in hidden[:5]:
            lines.append(h)

    return "\n".join(lines)


def _format_won(amount: int) -> str:
    """금액을 한국어 표기로 변환 (예: 15000000 → '1,500만원')."""
    if amount >= 100000000:  # 1억 이상
        eok = amount // 100000000
        remainder = amount % 100000000
        if remainder >= 10000:
            man = remainder // 10000
            return f"{eok}억 {man:,}만원"
        return f"{eok}억원"
    if amount >= 10000:
        man = amount // 10000
        return f"{man:,}만원"
    return f"{amount:,}원"
