"""결혼 준비 타임라인 & 체크리스트 데이터"""
from datetime import date, timedelta

WEDDING_TIMELINE = {
    "D-180": {
        "label": "6개월 전",
        "tasks": [
            {"title": "웨딩홀 예약", "category": "hall", "priority": 1},
            {"title": "전체 예산 설정", "category": None, "priority": 1},
            {"title": "웨딩 플래너 상담 (선택)", "category": None, "priority": 2},
        ],
    },
    "D-120": {
        "label": "4개월 전",
        "tasks": [
            {"title": "스튜디오 예약", "category": "studio", "priority": 1},
            {"title": "드레스샵 예약", "category": "dress", "priority": 1},
            {"title": "메이크업샵 예약", "category": "makeup", "priority": 1},
            {"title": "혼수 준비 시작", "category": None, "priority": 2},
        ],
    },
    "D-90": {
        "label": "3개월 전",
        "tasks": [
            {"title": "드레스 1차 피팅", "category": "dress", "priority": 1},
            {"title": "청첩장 디자인/주문", "category": None, "priority": 1},
            {"title": "신혼여행 예약", "category": None, "priority": 2},
        ],
    },
    "D-60": {
        "label": "2개월 전",
        "tasks": [
            {"title": "메이크업 리허설", "category": "makeup", "priority": 1},
            {"title": "혼인신고 서류 준비", "category": None, "priority": 1},
            {"title": "예복 준비 (신랑)", "category": None, "priority": 2},
        ],
    },
    "D-30": {
        "label": "1개월 전",
        "tasks": [
            {"title": "드레스 최종 피팅", "category": "dress", "priority": 1},
            {"title": "하객 수 최종 확정", "category": "hall", "priority": 1},
            {"title": "축의금 관리 계획", "category": None, "priority": 2},
        ],
    },
    "D-14": {
        "label": "2주 전",
        "tasks": [
            {"title": "식순 확정", "category": "hall", "priority": 1},
            {"title": "예물/예단 최종 준비", "category": None, "priority": 1},
            {"title": "감사 인사말 준비", "category": None, "priority": 2},
        ],
    },
    "D-7": {
        "label": "1주 전",
        "tasks": [
            {"title": "모든 업체 최종 확인 전화", "category": None, "priority": 1},
            {"title": "리허설 (가능한 경우)", "category": None, "priority": 1},
            {"title": "하객 좌석 배치 확인", "category": "hall", "priority": 2},
        ],
    },
    "D-1": {
        "label": "전날",
        "tasks": [
            {"title": "짐 챙기기 (드레스, 소품, 서류)", "category": None, "priority": 1},
            {"title": "최종 점검 전화", "category": None, "priority": 1},
            {"title": "충분한 수면", "category": None, "priority": 1},
        ],
    },
}

# phase key → days before wedding
_PHASE_DAYS = {
    "D-180": 180, "D-120": 120, "D-90": 90, "D-60": 60,
    "D-30": 30, "D-14": 14, "D-7": 7, "D-1": 1,
}

CATEGORY_DEADLINE = {
    "hall": "D-180",
    "studio": "D-120",
    "dress": "D-120",
    "makeup": "D-120",
}


def _parse_date(wedding_date: str) -> date | None:
    try:
        return date.fromisoformat(wedding_date)
    except (ValueError, TypeError):
        return None


def get_current_phase(wedding_date: str) -> dict | None:
    wd = _parse_date(wedding_date)
    if not wd:
        return None
    remaining = (wd - date.today()).days
    if remaining < 0:
        return {"phase": "D-day 지남", "label": "결혼식 완료", "days_remaining": remaining, "tasks": []}
    current_phase = None
    for phase, days in sorted(_PHASE_DAYS.items(), key=lambda x: x[1], reverse=True):
        if remaining <= days:
            current_phase = phase
    if not current_phase:
        current_phase = "D-180"
    phase_data = WEDDING_TIMELINE.get(current_phase, {})
    return {
        "phase": current_phase,
        "label": phase_data.get("label", ""),
        "days_remaining": remaining,
        "tasks": phase_data.get("tasks", []),
    }


def get_full_timeline(wedding_date: str) -> str:
    wd = _parse_date(wedding_date)
    if not wd:
        return "결혼식 날짜를 YYYY-MM-DD 형식으로 알려주세요."
    remaining = (wd - date.today()).days
    lines = [f"결혼식: {wedding_date} (D-{remaining}일)"]
    lines.append("")
    for phase, days in sorted(_PHASE_DAYS.items(), key=lambda x: x[1], reverse=True):
        phase_date = wd - timedelta(days=days)
        data = WEDDING_TIMELINE[phase]
        status = "지남" if date.today() > phase_date else "예정"
        marker = "(현재)" if status == "예정" and remaining <= days else ""
        lines.append(f"[{data['label']}] {phase_date.isoformat()} {marker}")
        for task in data["tasks"]:
            pri = "필수" if task["priority"] == 1 else "권장"
            lines.append(f"  - [{pri}] {task['title']}")
        lines.append("")
    return "\n".join(lines)


def get_category_deadline(wedding_date: str, category: str) -> str:
    wd = _parse_date(wedding_date)
    if not wd:
        return "결혼식 날짜를 알려주세요."
    phase = CATEGORY_DEADLINE.get(category)
    if not phase:
        return f"{category} 카테고리의 마감일 정보가 없습니다."
    days = _PHASE_DAYS[phase]
    deadline = wd - timedelta(days=days)
    remaining = (deadline - date.today()).days
    label = WEDDING_TIMELINE[phase]["label"]
    if remaining < 0:
        return f"{category} 예약 권장 시기({label}, {deadline.isoformat()})가 {abs(remaining)}일 지났습니다. 빨리 진행하세요!"
    return f"{category} 예약 권장 시기: {label} ({deadline.isoformat()}, {remaining}일 남음)"


def get_monthly_tasks(wedding_date: str) -> str:
    wd = _parse_date(wedding_date)
    if not wd:
        return "결혼식 날짜를 알려주세요."
    today = date.today()
    month_end = date(today.year, today.month + 1, 1) - timedelta(days=1) if today.month < 12 else date(today.year, 12, 31)
    tasks = []
    for phase, days in _PHASE_DAYS.items():
        phase_date = wd - timedelta(days=days)
        if today <= phase_date <= month_end:
            data = WEDDING_TIMELINE[phase]
            for task in data["tasks"]:
                tasks.append(f"- [{data['label']}] {task['title']} (마감: {phase_date.isoformat()})")
    if not tasks:
        remaining = (wd - today).days
        return f"이번 달에 해당하는 준비 항목이 없습니다. (결혼식 D-{remaining}일)"
    return f"이번 달 준비 항목:\n" + "\n".join(tasks)


def generate_checklist(wedding_date: str, completed: list[str] | None = None) -> str:
    wd = _parse_date(wedding_date)
    if not wd:
        return "결혼식 날짜를 알려주세요."
    completed_set = set(completed or [])
    remaining = (wd - date.today()).days
    lines = [f"결혼 준비 체크리스트 (D-{remaining}일)"]
    lines.append("")
    total = 0
    done = 0
    for phase, days in sorted(_PHASE_DAYS.items(), key=lambda x: x[1], reverse=True):
        phase_date = wd - timedelta(days=days)
        data = WEDDING_TIMELINE[phase]
        lines.append(f"[{data['label']}] ~{phase_date.isoformat()}")
        for task in data["tasks"]:
            total += 1
            is_done = task["title"] in completed_set
            if is_done:
                done += 1
            check = "V" if is_done else " "
            lines.append(f"  [{check}] {task['title']}")
        lines.append("")
    lines.insert(1, f"진행률: {done}/{total} ({done * 100 // max(total, 1)}%)")
    return "\n".join(lines)
