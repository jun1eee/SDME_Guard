"""스드메 도메인 프롬프트, Tool 스키마, RAG 템플릿, Few-shot 예시"""

CATEGORY_LABELS = {"studio": "스튜디오", "dress": "드레스", "makeup": "메이크업"}

SYSTEM_PROMPT = """당신은 웨딩 스드메(스튜디오/드레스/메이크업) 전문 추천 챗봇입니다.
서울/경기 지역의 웨딩 스튜디오, 드레스, 메이크업 업체를 추천합니다.

[핵심 원칙]
- 웨딩 스드메 관련 질문에는 반드시 tool을 호출하세요. 되묻지 마세요.
- 조건이 부족해도 있는 조건으로 일단 검색하세요. "어떤 지역?" "예산은?" 되묻기 금지.
- 카테고리를 모르면 [현재 대화 상태]에서 확인하세요.
- 웨딩 스드메와 무관한 질문에만 tool 없이 직접 답변하세요.

[카테고리 판별 — 최우선 적용]
- "드레스", "드레스샵", "벌" → category: dress
- "메이크업", "메이크업샵", "헤어" → category: makeup
- "스튜디오", "촬영" → category: studio
- 질문에 카테고리 키워드가 있으면 반드시 해당 카테고리로 설정. [현재 대화 상태]의 카테고리보다 우선.

[tool 선택 기준]
- 가격/지역/태그/벌수 등 구체적 조건 → search_structured
- 스타일/분위기/느낌 등 추상적 표현 → search_semantic
- "~와 어울리는", "~에 맞는", "~과 잘맞는" + 다른 카테고리 → search_related (반드시)
- 둘 다 있으면 → search_semantic (의미 검색이 구조 조건도 소프트 점수로 처리)
- 이전 결과 필터/비교 → filter_previous / compare_vendors

[답변 규칙]
- 업체명, 가격(만원 단위), 평점, 특징을 포함해 구체적으로 답변.
- 여러 업체를 추천할 때는 번호를 매겨 정리.
- 동일 업체가 가격만 다르면 하나로 합쳐서 가격 범위로 표시.
- 데이터가 없으면 "해당 조건의 업체를 찾지 못했습니다"라고 답변. 단, 위치 검색 결과가 없을 때는 가장 가까운 조건의 업체를 대신 추천.

[검색 가능한 태그 — 이 키워드가 있으면 search_structured 사용]
스튜디오: 인물중심, 인물+배경, 캐쥬얼씬, 한복씬, 로드씬, 야외, 가든, 옥상씬, 흑백씬, 프라이빗촬영, 리허설촬영, 반려동물씬, 하이엔드, 프리미엄, 단독촬영, 야간, 하프데이, 커스터마이징, N들러리씬
드레스: A라인, 머메이드라인, 실크, 레이스, 촬영+본식, 본식만, 리허설+본식, 국내, 국내+수입, 심플, 화려, 유니크한, 러블리한, 우아한, 베이직, 하이엔드, 금액할인, 지정예약, 4벌, 5벌, 대여
메이크업: 내추럴, 러블리, 스모키, 깨끗/화사, 과즙/색조, 윤곽/음영, 피부메이크업, 색조메이크업, 실장, 원장, 부원장, 단독룸, 촬영+본식, 본식만, 촬영만, 하이엔드, 프라이빗, 연예인 이용

[주의사항]
- tool의 query 파라미터에는 사용자의 원문을 그대로 전달하세요. 축약 금지.
- "여기서", "이중에", "그거" 등 맥락 참조 시 [현재 대화 상태]의 업체명을 사용하세요.
- "촬영"이 카테고리인지 조건인지 문맥에서 판단하세요.
- "100만원에 가까운" = 약 70만~130만원 범위로 해석하세요.
- 사용자 질문에 위 태그와 일치하는 키워드가 있으면 반드시 search_structured를 사용하세요.
"""

RAG_TEMPLATE = """당신은 웨딩 스드메(스튜디오/드레스/메이크업) 전문 추천 챗봇입니다.

아래 검색 결과를 기반으로 답변하세요.

[답변 규칙]
1. 검색 결과에 있는 데이터만 사용. 없는 내용을 만들지 마세요.
2. 추천 시 업체명, 가격, 평점, 특징을 포함해 구체적으로 답변.
3. 가격은 만원 단위로 표시 (예: 163만원).
4. 여러 업체를 추천할 때는 번호를 매겨 정리.
5. 비교 질문에는 항목별로 나눠서 비교.
6. 동일 업체가 가격만 다르게 여러 개 있으면 하나로 합쳐서 가격 범위로 표시.
7. 데이터가 없으면 "해당 조건의 업체를 찾지 못했습니다"라고 솔직하게 답변.

검색 결과:
{context}

사용자 질문: {query_text}

답변:"""

TOOLS_SCHEMA = [
    {"type": "function", "function": {
        "name": "search_structured",
        "description": "구조적 조건으로 웨딩 업체 검색. 가격, 지역, 태그, 정렬 조건이 있을 때 사용. 조건이 부족해도 되묻지 말고 있는 조건으로 검색.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "사용자 원문 그대로 전달. 축약 금지."},
            "category": {"type": "string", "enum": ["studio", "dress", "makeup"]},
        }, "required": ["query", "category"]}
    }},
    {"type": "function", "function": {
        "name": "search_semantic",
        "description": "스타일/분위기/느낌 등 추상적 표현으로 검색. 의미 유사도 매칭. 가격/지역 병행 가능.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "사용자 원문 그대로 전달. 축약 금지."},
            "category": {"type": "string", "enum": ["studio", "dress", "makeup"]},
            "region": {"type": "string", "description": "지역명 (선택)"},
            "max_price": {"type": "integer", "description": "최대 가격 원 단위 (선택)"},
            "min_price": {"type": "integer", "description": "최소 가격 원 단위 (선택)"},
        }, "required": ["query", "category"]}
    }},
    {"type": "function", "function": {
        "name": "compare_vendors",
        "description": "이전에 추천된 업체들을 비교. 대화 맥락에서 업체명을 파악하여 호출.",
        "parameters": {"type": "object", "properties": {
            "vendor_names": {"type": "array", "items": {"type": "string"}},
            "criteria": {"type": "string", "description": "비교 기준"},
        }, "required": ["vendor_names"]}
    }},
    {"type": "function", "function": {
        "name": "filter_previous",
        "description": "이전 추천 결과에서 필터링/정렬. '이중에서', '평점순', '가까운 곳' 등에 사용.",
        "parameters": {"type": "object", "properties": {
            "vendor_names": {"type": "array", "items": {"type": "string"}},
            "condition": {"type": "string"},
            "count": {"type": "integer"},
        }, "required": ["vendor_names", "condition"]}
    }},
    {"type": "function", "function": {
        "name": "get_vendor_detail",
        "description": "특정 업체 상세 정보 조회 (패키지, 리뷰, 태그, 가격, 주소, 휴무일).",
        "parameters": {"type": "object", "properties": {
            "vendor_name": {"type": "string"},
        }, "required": ["vendor_name"]}
    }},
    {"type": "function", "function": {
        "name": "get_user_preference",
        "description": "사용자 취향/선호 정보 조회.",
        "parameters": {"type": "object", "properties": {}}
    }},
    {"type": "function", "function": {
        "name": "get_user_likes",
        "description": "사용자 좋아요/찜 목록 조회.",
        "parameters": {"type": "object", "properties": {}}
    }},
]

FEWSHOT_EXAMPLES = [
    # 스튜디오
    "USER INPUT: '스튜디오 추천해줘'\nQUERY:\nMATCH (v:Vendor {category:'studio'}) WHERE v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC, v.reviewCnt DESC LIMIT 10",
    "USER INPUT: '200만원 이하 스튜디오'\nQUERY:\nMATCH (v:Vendor {category:'studio'}) WHERE v.salePrice <= 2000000 AND v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '야외씬 잘 찍는곳'\nQUERY:\nMATCH (v:Vendor {category:'studio'})-[:HAS_TAG]->(t:Tag)\nWHERE t.name CONTAINS '야외' OR t.name CONTAINS '로드' OR t.name CONTAINS '가든'\nRETURN DISTINCT v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '강남 스튜디오 150만원 이하'\nQUERY:\nMATCH (v:Vendor {category:'studio'})-[:IN_REGION]->(r:Region)\nWHERE r.name CONTAINS '강남' AND v.salePrice <= 1500000 AND v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '역삼역 근처 스튜디오'\nQUERY:\nMATCH (v:Vendor {category:'studio'})\nWHERE v.address CONTAINS '역삼'\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '줄리의정원 가격이랑 패키지 알려줘'\nQUERY:\nMATCH (v:Vendor {category:'studio'}) WHERE v.name CONTAINS '줄리의정원'\nOPTIONAL MATCH (v)-[:HAS_TAG]->(t:Tag)\nOPTIONAL MATCH (v)-[:HAS_PACKAGE]->(p:Package)\nRETURN v.name AS name, v.salePrice AS salePrice, v.productPrice AS originalPrice, v.rating AS rating, v.address AS address, collect(DISTINCT t.name) AS tags, collect(DISTINCT {title: p.title, value: p.value}) AS packages",
    "USER INPUT: '줄리의정원과 비슷한 스타일'\nQUERY:\nMATCH (v1:Vendor {category:'studio'})-[:HAS_TAG]->(t:Tag)<-[:HAS_TAG]-(v2:Vendor {category:'studio'})\nWHERE v1.name CONTAINS '줄리의정원' AND v1 <> v2\nWITH v2, collect(DISTINCT t.name) AS sharedTags, count(t) AS cnt\nRETURN v2.name AS name, v2.salePrice AS price, v2.rating AS rating, v2.address AS address, sharedTags\nORDER BY cnt DESC, v2.rating DESC LIMIT 5",
    "USER INPUT: '리뷰 좋은 강남 스튜디오'\nQUERY:\nMATCH (v:Vendor {category:'studio'})-[:IN_REGION]->(r:Region)\nWHERE r.name CONTAINS '강남'\nMATCH (v)-[:HAS_REVIEW]->(rv:Review)\nWITH v, avg(rv.score) AS avgScore, count(rv) AS revCnt\nWHERE revCnt >= 3\nRETURN v.name AS name, v.salePrice AS price, v.address AS address, round(avgScore, 1) AS avgScore, revCnt\nORDER BY avgScore DESC LIMIT 10",
    # 드레스
    "USER INPUT: '드레스 추천해줘'\nQUERY:\nMATCH (v:Vendor {category:'dress'}) WHERE v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC, v.reviewCnt DESC LIMIT 10",
    "USER INPUT: '200만원 이하 드레스'\nQUERY:\nMATCH (v:Vendor {category:'dress'}) WHERE v.salePrice <= 2000000 AND v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '촬영+본식 드레스 4벌 이상'\nQUERY:\nMATCH (v:Vendor {category:'dress'})-[:HAS_TAG]->(t:Tag)\nWHERE t.name CONTAINS '4벌' OR t.name CONTAINS '5벌'\nRETURN DISTINCT v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    # 메이크업
    "USER INPUT: '메이크업 추천해줘'\nQUERY:\nMATCH (v:Vendor {category:'makeup'}) WHERE v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC, v.reviewCnt DESC LIMIT 10",
    "USER INPUT: '50만원 이하 메이크업'\nQUERY:\nMATCH (v:Vendor {category:'makeup'}) WHERE v.salePrice <= 500000 AND v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '내추럴 메이크업 추천'\nQUERY:\nMATCH (v:Vendor {category:'makeup'})-[:HAS_TAG]->(t:Tag)\nWHERE t.name CONTAINS '내추럴' OR t.name CONTAINS '깨끗'\nRETURN DISTINCT v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '실장급 메이크업'\nQUERY:\nMATCH (v:Vendor {category:'makeup'})-[:HAS_TAG]->(t:Tag)\nWHERE t.name CONTAINS '실장'\nRETURN DISTINCT v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    # 공통
    "USER INPUT: '요즘 인기있는 곳'\nQUERY:\nMATCH (v:Vendor) WHERE v.orderCnt > 0\nRETURN v.partnerId AS id, v.name AS name, v.category AS category, v.salePrice AS price, v.rating AS rating, v.address AS address, v.orderCnt AS orders, v.profileUrl AS url\nORDER BY v.orderCnt DESC LIMIT 10",
    "USER INPUT: '가장 저렴한 곳 5개'\nQUERY:\nMATCH (v:Vendor) WHERE v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.category AS category, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.salePrice ASC LIMIT 5",
    # 동적 LIMIT
    "USER INPUT: '스튜디오 15개 추천해줘'\nQUERY:\nMATCH (v:Vendor {category:'studio'}) WHERE v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC, v.reviewCnt DESC LIMIT 15",
    "USER INPUT: '드레스 20개 보여줘'\nQUERY:\nMATCH (v:Vendor {category:'dress'}) WHERE v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC, v.reviewCnt DESC LIMIT 20",
    # District(동) 기반 검색 — 청담, 논현, 역삼 등 동네 단위
    "USER INPUT: '청담 드레스샵 추천해줘'\nQUERY:\nMATCH (v:Vendor {category:'dress'})-[:IN_DISTRICT]->(d:District)\nWHERE d.name CONTAINS '청담'\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '논현동 메이크업샵'\nQUERY:\nMATCH (v:Vendor {category:'makeup'})-[:IN_DISTRICT]->(d:District)\nWHERE d.name CONTAINS '논현'\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '잠실 근처 스튜디오'\nQUERY:\nMATCH (v:Vendor {category:'studio'})-[:IN_DISTRICT]->(d:District)\nWHERE d.name CONTAINS '잠실' OR d.name CONTAINS '송파'\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '신사동 드레스샵 추천'\nQUERY:\nMATCH (v:Vendor {category:'dress'})-[:IN_DISTRICT]->(d:District)\nWHERE d.name CONTAINS '신사'\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '청담 근처 다른 동네 드레스샵도 보여줘'\nQUERY:\nMATCH (d1:District)-[:PART_OF]->(r:Region)<-[:PART_OF]-(d2:District)\nWHERE d1.name CONTAINS '청담'\nMATCH (v:Vendor {category:'dress'})-[:IN_DISTRICT]->(d2)\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, d2.name AS district\nORDER BY v.rating DESC LIMIT 10",
]
