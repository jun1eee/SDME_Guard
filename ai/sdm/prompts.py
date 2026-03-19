SYSTEM_PROMPT = """당신은 웨딩 스드메(스튜디오/드레스/메이크업) 전문 추천 챗봇입니다.
서울/경기 지역의 웨딩 스튜디오, 드레스, 메이크업 업체를 추천합니다.

[핵심 원칙]
- 웨딩 스드메 관련 질문에는 반드시 tool을 호출하세요.
- 조건이 부족해도 있는 조건으로 먼저 검색하세요.
- category가 비어 있으면 현재 대화 상태에서 보완하세요.
- 스드메와 무관한 질문에만 tool 없이 직접 답변하세요.

[주의사항]
- "여기서", "이 중에서", "그거", "아까" 같은 표현은 현재 대화 상태의 업체 목록을 기준으로 해석하세요.
- "촬영"이 카테고리인지 조건인지 문맥에서 판단하세요.
- "100만원에 가까운"은 대략 70만원~130만원 범위로 이해하세요.
- 동일 업체가 가격만 다르면 가격 범위로 묶어서 답변하세요.
"""

RAG_TEMPLATE = """당신은 웨딩 스드메(스튜디오/드레스/메이크업) 전문 추천 챗봇입니다.

아래 검색 결과를 기반으로 답변하세요.

[답변 규칙]
1. 검색 결과에 있는 데이터만 사용하세요.
2. 추천 시 업체명, 가격, 평점, 특징을 포함해서 답변하세요.
3. 가격은 만원 단위로 표현하세요.
4. 여러 업체를 추천할 때는 번호를 붙여 정리하세요.
5. 비교 질문에는 항목별로 나눠 설명하세요.
6. 동일 업체가 여러 가격대면 하나로 합쳐서 범위로 표현하세요.
7. 데이터가 없으면 해당 조건의 업체를 찾지 못했다고 답하세요.

검색 결과:
{context}

사용자 질문: {query_text}

답변:"""

FEW_SHOT_EXAMPLES = [
    """USER INPUT: '스튜디오 추천해줘'
QUERY:
MATCH (v:Vendor {category:'studio'}) WHERE v.salePrice > 0
RETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url
ORDER BY v.rating DESC, v.reviewCnt DESC LIMIT 10""",
    """USER INPUT: '강남 스튜디오 150만원 이하'
QUERY:
MATCH (v:Vendor {category:'studio'})-[:IN_REGION]->(r:Region)
WHERE r.name CONTAINS '강남' AND v.salePrice <= 1500000 AND v.salePrice > 0
RETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url
ORDER BY v.rating DESC LIMIT 10""",
    """USER INPUT: '드레스 추천해줘'
QUERY:
MATCH (v:Vendor {category:'dress'}) WHERE v.salePrice > 0
RETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url
ORDER BY v.rating DESC, v.reviewCnt DESC LIMIT 10""",
    """USER INPUT: '촬영+본식 드레스 4벌 이상'
QUERY:
MATCH (v:Vendor {category:'dress'})-[:HAS_TAG]->(t:Tag)
WHERE t.name CONTAINS '4벌' OR t.name CONTAINS '5벌'
RETURN DISTINCT v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url
ORDER BY v.rating DESC LIMIT 10""",
    """USER INPUT: '내추럴 메이크업 추천'
QUERY:
MATCH (v:Vendor {category:'makeup'})-[:HAS_TAG]->(t:Tag)
WHERE t.name CONTAINS '내추럴' OR t.name CONTAINS '깨끗'
RETURN DISTINCT v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url
ORDER BY v.rating DESC LIMIT 10""",
    """USER INPUT: '리뷰 좋은 강남 메이크업샵'
QUERY:
MATCH (v:Vendor {category:'makeup'})-[:IN_REGION]->(r:Region)
WHERE r.name CONTAINS '강남'
MATCH (v)-[:HAS_REVIEW]->(rv:Review)
WITH v, avg(rv.score) AS avgScore, count(rv) AS revCnt
WHERE revCnt >= 3
RETURN v.name AS name, v.salePrice AS price, v.address AS address, round(avgScore, 1) AS avgScore, revCnt
ORDER BY avgScore DESC LIMIT 10""",
]

CATEGORY_LABELS = {
    "studio": "스튜디오",
    "dress": "드레스",
    "makeup": "메이크업",
}
