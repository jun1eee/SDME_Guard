"""웨딩 챗봇 프롬프트, RAG 템플릿, Few-shot 예시"""

CATEGORY_LABELS = {
    "studio": "스튜디오", "dress": "드레스", "makeup": "메이크업", "hall": "웨딩홀",
}

SYSTEM_PROMPT = """당신은 웨딩 전문 추천 챗봇입니다.
스튜디오, 드레스, 메이크업, 웨딩홀/예식장을 모두 추천합니다.

[핵심 원칙]
- 웨딩 관련 질문에는 반드시 tool을 호출하세요. 직접 답변하지 마세요.
- 조건이 부족해도 있는 조건으로 일단 검색하세요. 되묻기 금지.
- 웨딩과 무관한 질문에만 tool 없이 직접 답변하세요.

[tool 선택 기준]
- 업체/홀 검색 (가격, 지역, 태그, 조건) → search (category로 구분)
- 스타일/분위기/느낌 기반 검색 → search_style
- 특정 위치 근처 검색 (~역 근처, ~동 주변) → search_nearby
- 다른 카테고리 연관 추천 (~와 어울리는, ~에 맞는) → search_related
- 특정 업체/홀 상세 조회 → get_detail
- 업체 비교 → compare
- 이전 결과 필터/정렬 → filter_sort
- 사용자 취향/찜 조회 → get_user_info

[category 판별]
- 웨딩홀, 홀, 예식장, 하객, 식대, 뷔페, 채플 → hall
- 스튜디오, 촬영 → studio
- 드레스, 드레스샵, 벌 → dress
- 메이크업, 헤어 → makeup
- 질문에 카테고리 키워드가 있으면 반드시 해당 카테고리로 설정.

[답변 규칙]
- 업체명, 가격(만원 단위), 평점, 특징을 포함해 구체적으로 답변.
- 여러 업체 추천 시 번호를 매겨 정리.
- 연락처(tel)가 있으면 포함. 외부 사이트 링크(profileUrl)는 포함하지 마세요.
- 태그(tags) 데이터로 촬영 가능 여부 판단. 태그에 없으면 "태그에 해당 정보가 없습니다"와 연락처 안내.
- [현재 대화 상태]의 업체명으로 맥락 참조 ("여기서", "이중에", "그거").
- 검색 결과에 없는 정보(주차, 교통, 하객 수용 등)를 물으면 "해당 정보가 데이터에 없습니다"라고 솔직히 답변. 모든 업체를 다시 나열하지 마세요.
- 이전 추천 결과에서 필터링 시, 조건에 맞는 것만 답변. 조건을 판단할 데이터가 없으면 "해당 조건으로 필터링할 데이터가 없습니다"라고 답변.
"""

RAG_TEMPLATE = """당신은 웨딩 전문 추천 챗봇입니다.

아래 검색 결과를 기반으로 답변하세요.

[답변 규칙]
1. 검색 결과에 있는 데이터만 사용. 없는 내용을 만들지 마세요.
2. 업체명, 가격, 평점, 특징을 포함해 구체적으로 답변.
3. 가격은 만원 단위로 표시.
4. 여러 업체 추천 시 번호를 매겨 정리.
5. 비교 질문에는 항목별로 나눠서 비교.
6. 동일 업체가 가격만 다르면 가격 범위로 표시.
7. 연락처(tel)가 있으면 포함. 외부 사이트 링크는 포함하지 마세요.
8. 데이터가 없으면 솔직하게 답변.

검색 결과:
{context}

사용자 질문: {query_text}

답변:"""

FEWSHOT_EXAMPLES = [
    # 스튜디오
    "USER INPUT: '스튜디오 추천해줘'\nQUERY:\nMATCH (v:Vendor {category:'studio'}) WHERE v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC, v.reviewCnt DESC LIMIT 10",
    "USER INPUT: '200만원 이하 스튜디오'\nQUERY:\nMATCH (v:Vendor {category:'studio'}) WHERE v.salePrice <= 2000000 AND v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '야외씬 잘 찍는곳'\nQUERY:\nMATCH (v:Vendor {category:'studio'})-[:HAS_TAG]->(t:Tag)\nWHERE t.name CONTAINS '야외' OR t.name CONTAINS '로드' OR t.name CONTAINS '가든'\nRETURN DISTINCT v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '강남 스튜디오 150만원 이하'\nQUERY:\nMATCH (v:Vendor {category:'studio'})-[:IN_REGION]->(r:Region)\nWHERE r.name CONTAINS '강남' AND v.salePrice <= 1500000 AND v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '줄리의정원 가격이랑 패키지 알려줘'\nQUERY:\nMATCH (v:Vendor {category:'studio'}) WHERE v.name CONTAINS '줄리의정원'\nOPTIONAL MATCH (v)-[:HAS_TAG]->(t:Tag)\nOPTIONAL MATCH (v)-[:HAS_PACKAGE]->(p:Package)\nRETURN v.name AS name, v.salePrice AS salePrice, v.productPrice AS originalPrice, v.rating AS rating, v.address AS address, collect(DISTINCT t.name) AS tags, collect(DISTINCT {title: p.title, value: p.value}) AS packages",
    "USER INPUT: '줄리의정원과 비슷한 스타일'\nQUERY:\nMATCH (v1:Vendor {category:'studio'})-[:HAS_TAG]->(t:Tag)<-[:HAS_TAG]-(v2:Vendor {category:'studio'})\nWHERE v1.name CONTAINS '줄리의정원' AND v1 <> v2\nWITH v2, collect(DISTINCT t.name) AS sharedTags, count(t) AS cnt\nRETURN v2.name AS name, v2.salePrice AS price, v2.rating AS rating, v2.address AS address, sharedTags\nORDER BY cnt DESC, v2.rating DESC LIMIT 5",
    "USER INPUT: '리뷰 좋은 강남 스튜디오'\nQUERY:\nMATCH (v:Vendor {category:'studio'})-[:IN_REGION]->(r:Region)\nWHERE r.name CONTAINS '강남'\nMATCH (v)-[:HAS_REVIEW]->(rv:Review)\nWITH v, avg(rv.score) AS avgScore, count(rv) AS revCnt\nWHERE revCnt >= 3\nRETURN v.name AS name, v.salePrice AS price, v.address AS address, round(avgScore, 1) AS avgScore, revCnt\nORDER BY avgScore DESC LIMIT 10",
    # 드레스
    "USER INPUT: '드레스 추천해줘'\nQUERY:\nMATCH (v:Vendor {category:'dress'}) WHERE v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC, v.reviewCnt DESC LIMIT 10",
    "USER INPUT: '촬영+본식 드레스 4벌 이상'\nQUERY:\nMATCH (v:Vendor {category:'dress'})-[:HAS_TAG]->(t:Tag)\nWHERE t.name CONTAINS '4벌' OR t.name CONTAINS '5벌'\nRETURN DISTINCT v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    # 메이크업
    "USER INPUT: '메이크업 추천해줘'\nQUERY:\nMATCH (v:Vendor {category:'makeup'}) WHERE v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC, v.reviewCnt DESC LIMIT 10",
    "USER INPUT: '내추럴 메이크업 추천'\nQUERY:\nMATCH (v:Vendor {category:'makeup'})-[:HAS_TAG]->(t:Tag)\nWHERE t.name CONTAINS '내추럴' OR t.name CONTAINS '깨끗'\nRETURN DISTINCT v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    # 동적 LIMIT
    "USER INPUT: '스튜디오 15개 추천해줘'\nQUERY:\nMATCH (v:Vendor {category:'studio'}) WHERE v.salePrice > 0\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC, v.reviewCnt DESC LIMIT 15",
    # District 검색
    "USER INPUT: '청담 드레스샵 추천해줘'\nQUERY:\nMATCH (v:Vendor {category:'dress'})-[:IN_DISTRICT]->(d:District)\nWHERE d.name CONTAINS '청담'\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.reviewCnt AS reviewCnt, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
    "USER INPUT: '논현동 메이크업샵'\nQUERY:\nMATCH (v:Vendor {category:'makeup'})-[:IN_DISTRICT]->(d:District)\nWHERE d.name CONTAINS '논현'\nRETURN v.partnerId AS id, v.name AS name, v.salePrice AS price, v.rating AS rating, v.address AS address, v.profileUrl AS url\nORDER BY v.rating DESC LIMIT 10",
]
