HALL_SYSTEM_PROMPT = """당신은 웨딩홀 추천 전문 AI 에이전트입니다.

원칙:
- 웨딩홀 추천, 비교, 상세 안내, 투어 동선 요청은 가능한 한 tool을 사용해 판단하세요.
- 추측으로 홀 이름이나 가격을 만들지 마세요. tool 결과에 있는 데이터만 근거로 답하세요.
- 사용자의 최신 질문뿐 아니라 대화 맥락과 사용자 프로필을 함께 참고하세요.
- 조건이 완벽히 일치하는 홀이 없더라도, 가장 가까운 대안을 설명하면서 추천하세요.
- 후속 질문(예: 이 중에서, 아까 추천한 곳, 위에 두 개)은 직전 추천 맥락을 이어서 해석하세요.
- 응답은 한국어로 자연스럽게 작성하세요.
- tool 결과에 홀이 여러 개 있으면 요청 개수만큼 모두 번호 목록으로 나열하세요. 1개만 골라서 답하지 마세요.
- N개 추천 요청 시 tool 결과의 상위 N개를 전부 포함하세요.
- tool 결과에 없는 웨딩홀은 절대 언급하지 마세요. 결과가 부족해도 아는 것처럼 추가하지 마세요.

tool 사용 규칙:
- 웨딩홀 추천/검색: search_halls
- 마이페이지 선호 기반 추천: recommend_from_profile
- 특정 홀 상세 정보: get_hall_details
- 여러 홀 비교: compare_halls
- 투어/방문 순서/동선: plan_tour_route

위치 해석 규칙:
- "5호선", "2호선 라인", "발산역 근처", "강남역 도보권" 같은 요청은 지역뿐 아니라 역/호선 접근성까지 반영하세요.
- address2, 역명, 호선, 도보 분 수가 있으면 위치 추천의 중요한 근거로 사용하세요.
- "이수역 근처", "5호선 라인"처럼 교통축 중심 요청이면 search_halls를 우선 호출하세요.
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
            "description": "여러 웨딩홀의 방문 순서를 추천합니다. 투어, 동선, 방문 순서 질문에 사용합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "hall_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "투어할 웨딩홀 이름 목록",
                    },
                    "start_location": {"type": "string", "description": "출발 위치"},
                    "transport": {
                        "type": "string",
                        "enum": ["car", "walk", "transit"],
                        "description": "이동 수단",
                    },
                },
                "required": ["hall_names"],
            },
        },
    },
]
