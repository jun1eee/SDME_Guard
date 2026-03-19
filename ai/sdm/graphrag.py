"""스드메 GraphRAG 초기화 - Text2Cypher + VectorCypher"""
import json
from neo4j import GraphDatabase, basic_auth
from neo4j_graphrag.retrievers import Text2CypherRetriever, VectorCypherRetriever
from neo4j_graphrag.embeddings.openai import OpenAIEmbeddings
from neo4j_graphrag.types import RetrieverResultItem

try:
    from neo4j_graphrag.llm import OpenAILLM
except ImportError:
    from neo4j_graphrag.llm.openai_llm import OpenAILLM

from neo4j_graphrag.generation import GraphRAG, RagTemplate

from deps import get_driver
from sdm.prompts import RAG_TEMPLATE, FEWSHOT_EXAMPLES

_rag_cypher = None
_llm = None
_embedder = None
_neo4j_schema = None


def _get_schema(driver):
    """Neo4j 스키마 추출"""
    with driver.session() as session:
        nodes = session.run(
            "MATCH (n) WITH DISTINCT labels(n) AS lbls, keys(n) AS ks, n "
            "UNWIND lbls AS l UNWIND ks AS k RETURN l, k, n[k] AS sv"
        )
        rels = session.run(
            "MATCH (a)-[r]->(b) RETURN DISTINCT labels(a) AS sl, type(r) AS rt, labels(b) AS el"
        )
        schema = {"nodes": {}, "relations": []}
        for rec in nodes:
            l, k = rec["l"], rec["k"]
            if l not in schema["nodes"]:
                schema["nodes"][l] = {}
            v = rec["sv"]
            t = ("STRING" if isinstance(v, str) else
                 "INTEGER" if isinstance(v, int) else
                 "FLOAT" if isinstance(v, float) else "UNKNOWN")
            schema["nodes"][l][k] = t
        for rec in rels:
            sl = rec["sl"][0] if rec["sl"] else "?"
            el = rec["el"][0] if rec["el"] else "?"
            schema["relations"].append(f"(:{sl})-[:{rec['rt']}]->(:{el})")
    lines = ["Node properties:"]
    for label, props in schema["nodes"].items():
        ps = ", ".join(f"{k}: {v}" for k, v in props.items())
        lines.append(f"  {label} {{{ps}}}")
    lines.append("Relationships:")
    for r in schema["relations"]:
        lines.append(f"  {r}")
    return "\n".join(lines)


def _vendor_result_formatter(record):
    return RetrieverResultItem(
        content=json.dumps(dict(record), ensure_ascii=False, default=str),
        metadata={"name": record.get("name", "")},
    )


def init_graphrag():
    """GraphRAG 초기화 - 앱 시작 시 호출"""
    global _rag_cypher, _llm, _embedder, _neo4j_schema

    driver = get_driver()
    _neo4j_schema = _get_schema(driver)
    _llm = OpenAILLM(model_name="gpt-4o", model_params={"temperature": 0, "max_tokens": 2000})
    _embedder = OpenAIEmbeddings(model="text-embedding-3-small")

    rag_template = RagTemplate(template=RAG_TEMPLATE, expected_inputs=["context", "query_text"])
    retriever = Text2CypherRetriever(
        driver=driver, llm=_llm, neo4j_schema=_neo4j_schema, examples=FEWSHOT_EXAMPLES,
    )
    _rag_cypher = GraphRAG(retriever=retriever, llm=_llm, prompt_template=rag_template)
    print("스드메 GraphRAG 초기화 완료")


def get_rag_cypher():
    return _rag_cypher


def build_vector_retrieval_query(category=None, region=None, max_price=None, min_price=None):
    parts = ["WITH node AS v, score"]
    if category:
        parts.append(f"WHERE v.category = '{category}'")
    parts.append("MATCH (v)-[:IN_REGION]->(r:Region)")
    parts.append("OPTIONAL MATCH (v)-[:HAS_TAG]->(t:Tag)")
    parts.append("OPTIONAL MATCH (v)-[:HAS_REVIEW]->(rv:Review)")
    parts.append("""WITH v, score, r,
        collect(DISTINCT t.name) AS tags,
        avg(rv.score) AS avgReviewScore,
        count(rv) AS reviewCount""")
    score_parts = []
    if region:
        score_parts.append(f"CASE WHEN r.name CONTAINS '{region}' THEN 1 ELSE 0 END AS regionMatch")
    if max_price:
        score_parts.append(f"CASE WHEN v.salePrice <= {max_price} AND v.salePrice > 0 THEN 1 ELSE 0 END AS priceMatch")
    if min_price:
        score_parts.append(f"CASE WHEN v.salePrice >= {min_price} THEN 1 ELSE 0 END AS priceMinMatch")
    if score_parts:
        parts.append("WITH v, score, r, tags, avgReviewScore, reviewCount,")
        parts.append(",\n    ".join(score_parts))
        score_names = [s.split(" AS ")[1] for s in score_parts]
        condition_score = " + ".join(score_names)
        parts.append(f"""RETURN v.name AS name, v.category AS category,
    v.salePrice AS price, v.rating AS rating,
    v.address AS address, v.profileUrl AS url,
    tags, round(avgReviewScore, 1) AS avgReviewScore,
    reviewCount, round(score, 4) AS vectorScore,
    {', '.join(score_names)},
    ({condition_score}) AS conditionScore
ORDER BY conditionScore DESC, score DESC LIMIT 10""")
    else:
        parts.append(f"""RETURN v.name AS name, v.category AS category,
    v.salePrice AS price, v.rating AS rating,
    v.address AS address, v.profileUrl AS url,
    tags, round(avgReviewScore, 1) AS avgReviewScore,
    reviewCount, round(score, 4) AS vectorScore
ORDER BY score DESC LIMIT 10""")
    return "\n".join(parts)


def create_vector_rag(category=None, region=None, max_price=None, min_price=None):
    driver = get_driver()
    rag_template = RagTemplate(template=RAG_TEMPLATE, expected_inputs=["context", "query_text"])
    rq = build_vector_retrieval_query(category, region, max_price, min_price)
    vr = VectorCypherRetriever(
        driver=driver,
        index_name="vendor_embedding_index",
        embedder=_embedder,
        retrieval_query=rq,
        result_formatter=_vendor_result_formatter,
    )
    return GraphRAG(retriever=vr, llm=_llm, prompt_template=rag_template), rq
