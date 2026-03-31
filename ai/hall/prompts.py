HALL_SYSTEM_PROMPT = """당신은 웨딩홀 추천 전문 AI 에이전트입니다.

원칙:
- 웨딩홀 추천, 비교, 상세 안내, 투어 동선 요청은 가능한 한 tool을 사용해 판단하세요.
- 추측으로 홀 이름이나 가격을 만들지 마세요. tool 결과에 있는 데이터만 근거로 답하세요.
- 사용자의 최신 질문뿐 아니라 대화 맥락과 사용자 프로필을 함께 참고하세요.
- 조건이 완벽히 일치하는 홀이 없더라도, 가장 가까운 대안을 설명하면서 추천하세요.
- 후속 질문(예: 이 중에서, 아까 추천한 곳, 위에 두 개)은 직전 추천 맥락을 이어서 해석하세요.
- 응답은 한국어로 자연스럽게 작성하세요.
- tool 결과에 홀이 여러 개 있으면 요청 개수만큼 모두 포함하세요. 1개만 골라서 답하지 마세요.
- tool 결과의 번호, 포맷을 그대로 유지하세요. 번호를 바꾸거나 재정렬하지 마세요.
- [커플 취향 정보]가 주어진 경우, 각 홀별로 왜 이 커플에게 적합한지 한 줄 추천 이유를 포함하세요.
- recommend_from_profile 결과에도 각 홀의 추천 이유를 포함하세요.

tool 선택 예시:
- "웨딩홀 추천해줘", "강남 웨딩홀", "예산 300만원" → search_halls
- "내 취향에 맞는 웨딩홀", "여자친구 취향 맞는 웨딩홀", "우리 둘 다 좋아할 곳", "취향 기반 추천" → recommend_from_profile
- "나랑 여자친구 취향 정리해줘", "취향 비교해줘" → [커플 대화 모드]의 상담 요약을 참고하여 직접 답변

tool 사용 규칙:
- 웨딩홀 추천/검색: search_halls
- 취향/선호/프로필 기반 추천: recommend_from_profile
- 특정 홀 상세 정보: get_hall_details
- 여러 홀 비교: compare_halls
- 투어/방문 순서/동선: plan_tour_route (출발지와 교통수단만 확인한 후 호출. 방문 목적은 묻지 말 것)
- 투어 동선 수정(순서 변경, 홀 추가/제거/교체): modify_tour_route
- 투어/동선 관련 요청이 포함되면 반드시 plan_tour_route tool을 호출하세요. 직접 동선을 텍스트로 만들지 마세요.
- "찾아서 투어 짜줘" 같은 복합 요청은 먼저 search_halls로 검색 후, 이어서 plan_tour_route를 호출하세요.

투어 응답 규칙:
- 시간표(schedule)는 시간대별로 정리하여 안내하세요.
- 점심 시간이 포함되면 점심 시간 안내를 포함하세요.
- 지도 링크(map_links)가 있으면 각 구간 길찾기 링크를 안내하세요.
- 휴무일 경고(warnings)가 있으면 반드시 사용자에게 알려주세요.
- 동선 수정 요청은 modify_tour_route를 사용하세요.

위치 해석 규칙:
- "5호선", "2호선 라인", "발산역 근처", "강남역 도보권" 같은 요청은 지역뿐 아니라 역/호선 접근성까지 반영하세요.
- address2, 역명, 호선, 도보 분 수가 있으면 위치 추천의 중요한 근거로 사용하세요.
- "이수역 근처", "5호선 라인"처럼 교통축 중심 요청이면 search_halls를 우선 호출하세요.
"""


HALL_COUPLE_CONTEXT_TEMPLATE = """
[커플 대화 모드]
두 분의 상담 내용을 참고하여 웨딩홀을 추천하세요.

[신랑 상담 요약]
{groom_summary}
관심 업체: {groom_vendors}

[신부 상담 요약]
{bride_summary}
관심 업체: {bride_vendors}

두 분의 취향을 모두 고려하여 추천해주세요. 겹치는 선호는 강조하고, 다른 취향은 절충안을 제시하세요.
"""

HALL_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_halls",
            "description": "자연어 조건으로 웨딩홀을 추천합니다. 지역, 예산, 식대, 분위기, 시설, 개수, 후속 필터 질문에 사용합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "사용자 요청을 그대로 담은 검색 문장"},
                    "count": {"type": "integer", "description": "원하는 추천 개수"},
                    "sort_by": {
                        "type": "string",
                        "enum": ["match", "rating", "review", "price_asc", "price_desc"],
                        "description": "정렬 기준",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "recommend_from_profile",
            "description": "사용자 프로필과 선호 정보를 기반으로 웨딩홀을 추천합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "count": {"type": "integer", "description": "원하는 추천 개수"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_halls",
            "description": "여러 웨딩홀의 가격, 평점, 특징을 비교합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "hall_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "비교할 웨딩홀 이름 목록",
                    }
                },
                "required": ["hall_names"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_hall_details",
            "description": "특정 웨딩홀의 상세 정보와 특징을 조회합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "hall_name": {"type": "string", "description": "조회할 웨딩홀 이름"},
                },
                "required": ["hall_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "plan_tour_route",
            "description": "여러 웨딩홀의 방문 순서와 일정을 계획합니다. '투어', '동선', '방문 순서', '견학', '일정 짜줘', '투어 잡아줘' 등 방문 계획 관련 질문에 사용합니다. 출발지와 교통수단만 확인한 후 호출하세요. 방문 목적은 묻지 마세요.",
            "parameters": {
                "type": "object",
                "properties": {
                    "hall_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "투어할 웨딩홀 이름 목록",
                    },
                    "start_location": {
                        "type": "string",
                        "description": "출발 위치 (예: 강남역, 잠실역, 집 주소). 사용자에게 반드시 확인.",
                    },
                    "transport": {
                        "type": "string",
                        "enum": ["car", "walk", "transit"],
                        "description": "이동 수단. car=자동차, transit=대중교통, walk=도보. 사용자에게 반드시 확인.",
                    },
                    "start_time": {
                        "type": "string",
                        "description": "HH:MM 형식, 예: 10:00. 미지정 시 오전 10시 기본.",
                    },
                    "visit_date": {
                        "type": "string",
                        "description": "YYYY-MM-DD 형식. 휴무일 확인에 사용.",
                    },
                    "visit_duration": {
                        "type": "integer",
                        "description": "홀당 방문 소요 시간(분). 미지정 시 60분 기본.",
                    },
                },
                "required": ["hall_names", "start_location", "transport"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "modify_tour_route",
            "description": "이전에 계획한 투어 동선을 수정합니다. 순서 변경, 홀 추가/제거/교체에 사용합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["swap", "remove", "add", "reorder"],
                        "description": "수정 유형. swap=두 홀 위치 교환, remove=홀 제거, add=홀 추가, reorder=전체 순서 변경.",
                    },
                    "index_a": {
                        "type": "integer",
                        "description": "swap 시 교환할 첫 번째 홀 인덱스 (0부터 시작).",
                    },
                    "index_b": {
                        "type": "integer",
                        "description": "swap 시 교환할 두 번째 홀 인덱스 (0부터 시작).",
                    },
                    "index": {
                        "type": "integer",
                        "description": "remove 시 제거할 홀 인덱스 (0부터 시작).",
                    },
                    "hall_name": {
                        "type": "string",
                        "description": "add 시 추가할 웨딩홀 이름.",
                    },
                    "position": {
                        "type": "integer",
                        "description": "add 시 삽입할 위치 인덱스 (0부터 시작). 미지정 시 맨 뒤에 추가.",
                    },
                    "new_order": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "reorder 시 새로운 순서 (기존 인덱스 배열, 0부터 시작).",
                    },
                },
                "required": ["action"],
            },
        },
    },
]
