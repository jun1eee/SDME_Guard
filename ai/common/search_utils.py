"""검색 파이프라인 공통 유틸리티"""
from math import radians, cos, sin, asin, sqrt


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """두 벡터의 cosine similarity 계산 (numpy 의존 없음)"""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 좌표 간 거리(km) -- Haversine 공식"""
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = (sin(dlat / 2) ** 2
         + cos(radians(lat1)) * cos(radians(lat2))
         * sin(dlng / 2) ** 2)
    return R * 2 * asin(sqrt(a))


def expand_tags(driver, tags: list[str], category: str, min_count: int = 3) -> list[str]:
    """CO_OCCURS 관계로 태그 확장. 원본 태그 + 연관 태그 반환."""
    if not tags or not driver:
        return tags or []
    with driver.session() as session:
        # 양방향 CO_OCCURS 탐색
        result = session.run("""
            MATCH (t1:Tag {category: $category})-[co:CO_OCCURS]-(t2:Tag {category: $category})
            WHERE t1.name IN $tags AND co.count >= $min_count
            RETURN DISTINCT t2.name AS related_tag
        """, category=category, tags=tags, min_count=min_count)
        related = [r["related_tag"] for r in result]
    return list(dict.fromkeys(tags + related))


def rerank_by_similarity(records: list[dict], query_embedding: list[float],
                         embedding_key: str = "embedding", limit: int = 10) -> list[dict]:
    """records를 query_embedding과의 cosine similarity로 재정렬"""
    if not query_embedding:
        return records[:limit]
    scored = []
    for rec in records:
        emb = rec.get(embedding_key)
        sim = cosine_similarity(query_embedding, emb) if emb else 0.0
        scored.append((sim, rec))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [rec for _, rec in scored[:limit]]
