import json
import re
from typing import Any

import mysql.connector
from neo4j import GraphDatabase, basic_auth
from openai import OpenAI

from config import Settings
from sdm.prompts import FEWSHOT_EXAMPLES, RAG_TEMPLATE

NO_RESULT_PHRASES = [
    "찾지 못했습니다", "없습니다", "검색 결과가 없",
    "포함되어 있지 않습니다", "정보가 없", "찾을 수 없",
    "데이터에 포함", "제공되지 않", "존재하지 않",
]


class SdmGraphRagEngine:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.driver = None
        self.mysql_conn = None
        self.startup_error: str | None = None
        self.openai_client = (
            OpenAI(api_key=settings.openai_api_key)
            if settings.openai_api_key
            else OpenAI()
        )
        self.llm = None
        self.embedder = None
        self.rag_cypher = None
        self._vector_retriever_cls = None
        self._graph_rag_cls = None
        self._rag_template_cls = None
        self._retriever_item_cls = None

    def startup(self) -> None:
        self.startup_error = None
        self.mysql_conn = self._connect_mysql()

        if not self.settings.neo4j_password:
            self.startup_error = "NEO4J_PW is not configured."
            return

        try:
            from neo4j_graphrag.embeddings.openai import OpenAIEmbeddings
            from neo4j_graphrag.generation import GraphRAG, RagTemplate
            try:
                from neo4j_graphrag.llm import OpenAILLM
            except ImportError:
                from neo4j_graphrag.llm.openai_llm import OpenAILLM
            from neo4j_graphrag.retrievers import Text2CypherRetriever, VectorCypherRetriever
            from neo4j_graphrag.types import RetrieverResultItem

            self.driver = GraphDatabase.driver(
                self.settings.neo4j_uri,
                auth=basic_auth(self.settings.neo4j_user, self.settings.neo4j_password),
            )
            schema = self._get_schema()
            neo4j_schema = self._format_schema(schema)
            prompt_template = RagTemplate(
                template=RAG_TEMPLATE,
                expected_inputs=["context", "query_text"],
            )

            self._vector_retriever_cls = VectorCypherRetriever
            self._graph_rag_cls = GraphRAG
            self._rag_template_cls = RagTemplate
            self._retriever_item_cls = RetrieverResultItem
            self.llm = OpenAILLM(
                model_name=self.settings.openai_chat_model,
                model_params={"temperature": 0, "max_tokens": 2000},
            )
            self.embedder = OpenAIEmbeddings(model=self.settings.openai_embedding_model)

            text2cypher_retriever = Text2CypherRetriever(
                driver=self.driver, llm=self.llm,
                neo4j_schema=neo4j_schema, examples=FEWSHOT_EXAMPLES,
            )
            self.rag_cypher = GraphRAG(
                retriever=text2cypher_retriever, llm=self.llm, prompt_template=prompt_template,
            )
        except Exception as exc:
            self.startup_error = str(exc)
            self.shutdown()

    def shutdown(self) -> None:
        if self.mysql_conn:
            self.mysql_conn.close()
        if self.driver:
            self.driver.close()

    def ready(self) -> bool:
        return bool(
            self.driver and self.rag_cypher and self.llm and self.embedder
            and self._vector_retriever_cls and self._graph_rag_cls
            and self._rag_template_cls and self._retriever_item_cls
        )

    def run_chat_completion(self, messages: list[dict[str, Any]], **kwargs: Any) -> Any:
        return self.openai_client.chat.completions.create(
            model=self.settings.openai_chat_model, messages=messages, **kwargs,
        )

    # ── MySQL (사용자 데이터) ──

    def get_user_preference(self, couple_id: int) -> dict[str, Any]:
        fallback = {"region": "서울", "sub_region": "강남구",
                    "studio_style": "인물중심", "dress_style": "클래식", "makeup_style": "내추럴"}
        if not self.mysql_conn:
            return fallback
        try:
            cur = self.mysql_conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM couple_preferences WHERE couple_id = %s", (couple_id,))
            row = cur.fetchone()
            cur.close()
            return row or fallback
        except Exception:
            return fallback

    def get_user_likes(self, couple_id: int) -> list[dict[str, Any]]:
        fallback = [{"name": "더미업체", "category": "스튜디오"}]
        if not self.mysql_conn:
            return fallback
        try:
            cur = self.mysql_conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM couple_venue_likes WHERE couple_id = %s", (couple_id,))
            rows = cur.fetchall()
            cur.close()
            return rows or fallback
        except Exception:
            return fallback

    # ── GraphRAG 검색 ──

    def search_structured(self, query: str, category: str) -> tuple[str, list[str]]:
        self._ensure_ready()
        result = self.rag_cypher.search(query_text=query)
        vendors = self.extract_vendors_from_retriever(result)
        answer = result.answer
        if not vendors:
            vendors = self.extract_vendors_from_answer(answer)
        if not vendors:
            vendors = self._extract_vendors_from_bold(answer)
        if not vendors:
            vendors = self._extract_vendors_from_list(answer)
        if answer and any(phrase in answer for phrase in NO_RESULT_PHRASES):
            return self.search_semantic(query=query, category=category)
        return answer, vendors

    def search_semantic(
        self, query: str, category: str,
        region: str | None = None, max_price: int | None = None, min_price: int | None = None,
    ) -> tuple[str, list[str]]:
        self._ensure_ready()
        rag, _ = self.create_vector_rag(
            category=category, region=region, max_price=max_price, min_price=min_price,
        )
        result = rag.search(query_text=query)
        vendors = self.extract_vendors_from_retriever(result)
        answer = result.answer
        if not vendors:
            vendors = self.extract_vendors_from_answer(answer)
        if not vendors:
            vendors = self._extract_vendors_from_bold(answer)
        if not vendors:
            vendors = self._extract_vendors_from_list(answer)
        # semantic 실패 시 structured 교차 시도
        if answer and any(p in answer for p in NO_RESULT_PHRASES):
            result2 = self.rag_cypher.search(query_text=query)
            vendors2 = self.extract_vendors_from_retriever(result2)
            if not vendors2:
                vendors2 = self._extract_vendors_from_bold(result2.answer)
            if not vendors2:
                vendors2 = self._extract_vendors_from_list(result2.answer)
            if vendors2:
                return result2.answer, vendors2
        return answer, vendors

    def query_vendors_by_names(self, vendor_names: list[str]) -> list[dict[str, Any]]:
        self._ensure_driver()
        with self.driver.session() as session:
            return session.run("""
                MATCH (v:Vendor)
                WHERE any(name IN $names WHERE v.name = name)
                WITH v
                OPTIONAL MATCH (v)-[:HAS_TAG]->(t:Tag)
                WITH v, collect(DISTINCT t.name) AS tags
                OPTIONAL MATCH (v)-[:HAS_PACKAGE]->(p:Package)
                WITH v, tags, collect(DISTINCT {title: p.title, value: p.value})[..3] AS packages
                OPTIONAL MATCH (v)-[:HAS_REVIEW]->(rv:Review)
                WITH v, tags, packages,
                     round(avg(rv.score), 1) AS avgReviewScore,
                     count(rv) AS reviewCount,
                     collect(rv.contents)[..2] AS recentReviews
                RETURN v.partnerId AS sourceId,
                       v.name AS name, v.category AS category,
                       v.salePrice AS price, v.rating AS rating,
                       v.address AS address, v.region AS region,
                       v.profileUrl AS url, v.coverUrl AS imageUrl,
                       v.holiday AS holiday, v.reviewCnt AS reviewCnt,
                       tags, packages, avgReviewScore,
                       reviewCount, recentReviews
                ORDER BY v.rating DESC
            """, names=vendor_names).data()

    # ── Vendor 추출 ──

    def extract_vendors_from_retriever(self, result: Any) -> list[str]:
        vendors: list[str] = []
        retriever_result = getattr(result, "retriever_result", None)
        if not retriever_result:
            return vendors
        for item in getattr(retriever_result, "items", []):
            name = None
            if getattr(item, "metadata", None) and isinstance(item.metadata, dict):
                name = item.metadata.get("name")
            if not name and getattr(item, "content", None):
                content = item.content
                if isinstance(content, str):
                    for pattern in (
                        r'"name":\s*"([^"]+)"',
                        r"name='([^']+)'",
                        r"name[=:]\s*['\"]?([^'\",\n\}]+)",
                    ):
                        match = re.search(pattern, content)
                        if match:
                            name = match.group(1).strip()
                            break
            if name and 2 <= len(name) <= 30 and name not in vendors:
                vendors.append(name)
        return vendors

    def extract_vendors_from_answer(self, answer: str) -> list[str]:
        vendors: list[str] = []
        lines = answer.splitlines()
        for index, line in enumerate(lines[:-1]):
            current = line.strip()
            next_line = lines[index + 1].strip().lstrip("- ")
            # 볼드 마커도 제거하여 "**가격**:" 패턴 매칭
            next_clean = re.sub(r"\*+", "", next_line)
            if not current or not next_clean.startswith("가격"):
                continue
            name = re.sub(r"^\d+[.)]\s*", "", current).strip("*# ").strip()
            if name and 2 <= len(name) <= 30 and name not in vendors:
                vendors.append(name)
        return vendors

    @staticmethod
    def _extract_vendors_from_bold(answer: str) -> list[str]:
        """답변의 **볼드** 텍스트에서 업체명 추출 (fallback)"""
        bold_names = re.findall(r"\*\*([^*]{2,30})\*\*", answer)
        skip = {"가격", "평점", "특징", "주소", "웹사이트", "링크", "리뷰", "참고",
                "촬영시간", "소요시간", "위치", "연락처", "식대", "총예산", "분위기"}
        vendors = []
        for name in bold_names:
            name = name.strip()
            if name in skip or any(s in name for s in skip):
                continue
            if 2 <= len(name) <= 30 and name not in vendors:
                vendors.append(name)
        return vendors

    @staticmethod
    def _extract_vendors_from_list(answer: str) -> list[str]:
        """답변의 번호 목록(1. 업체명) 또는 불릿(- 업체명)에서 추출"""
        vendors = []
        for line in answer.splitlines():
            line = line.strip()
            # "1. 로이스튜디오" or "1. 로이스튜디오 - 설명" or "1) 로이스튜디오: 설명"
            m = re.match(r"^(?:\d+[.)]\s*)([\w가-힣()（）._·\s]{2,30}?)(?:\s*[-\u2013:]|$)", line)
            if m:
                name = m.group(1).strip()
                if name and name not in vendors:
                    vendors.append(name)
                continue
            # bullet point: "- 업체명" or "* 업체명"
            m = re.match(r"^[-*]\s+([\w가-힣()（）._·\s]{2,30}?)(?:\s*[-\u2013:]|$)", line)
            if m:
                name = m.group(1).strip()
                if name and name not in vendors:
                    vendors.append(name)
        return vendors

    # ── 벡터 검색 ──

    def create_vector_rag(self, category=None, region=None, max_price=None, min_price=None):
        self._ensure_ready()
        retrieval_query = self.build_vector_retrieval_query(
            category=category, region=region, max_price=max_price, min_price=min_price,
        )
        retriever = self._vector_retriever_cls(
            driver=self.driver, index_name="vendor_embedding_index",
            embedder=self.embedder, retrieval_query=retrieval_query,
            result_formatter=self._vendor_result_formatter,
        )
        rag = self._graph_rag_cls(
            retriever=retriever, llm=self.llm,
            prompt_template=self._rag_template_cls(
                template=RAG_TEMPLATE, expected_inputs=["context", "query_text"],
            ),
        )
        return rag, retrieval_query

    def build_vector_retrieval_query(self, category=None, region=None, max_price=None, min_price=None) -> str:
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
            score_names = [p.split(" AS ")[1] for p in score_parts]
            parts.append(f"""RETURN v.name AS name, v.category AS category,
    v.salePrice AS price, v.rating AS rating,
    v.address AS address, v.profileUrl AS url,
    tags, round(avgReviewScore, 1) AS avgReviewScore,
    reviewCount, round(score, 4) AS vectorScore,
    {', '.join(score_names)},
    ({' + '.join(score_names)}) AS conditionScore
ORDER BY conditionScore DESC, score DESC LIMIT 10""")
        else:
            parts.append("""RETURN v.name AS name, v.category AS category,
    v.salePrice AS price, v.rating AS rating,
    v.address AS address, v.profileUrl AS url,
    tags, round(avgReviewScore, 1) AS avgReviewScore,
    reviewCount, round(score, 4) AS vectorScore
ORDER BY score DESC LIMIT 10""")
        return "\n".join(parts)

    # ── 내부 ──

    def _get_schema(self) -> dict[str, Any]:
        self._ensure_driver()
        with self.driver.session() as session:
            nodes = session.run(
                "MATCH (n) WITH DISTINCT labels(n) AS lbls, keys(n) AS ks, n "
                "UNWIND lbls AS l UNWIND ks AS k RETURN l, k, n[k] AS sv"
            )
            rels = session.run(
                "MATCH (a)-[r]->(b) RETURN DISTINCT labels(a) AS sl, type(r) AS rt, labels(b) AS el"
            )
            schema = {"nodes": {}, "relations": []}
            for rec in nodes:
                label, key = rec["l"], rec["k"]
                schema["nodes"].setdefault(label, {})
                v = rec["sv"]
                t = ("STRING" if isinstance(v, str) else "INTEGER" if isinstance(v, int)
                     else "FLOAT" if isinstance(v, float) else "UNKNOWN")
                schema["nodes"][label][key] = t
            for rec in rels:
                sl = rec["sl"][0] if rec["sl"] else "?"
                el = rec["el"][0] if rec["el"] else "?"
                schema["relations"].append(f"(:{sl})-[:{rec['rt']}]->(:{el})")
            return schema

    def _format_schema(self, schema: dict[str, Any]) -> str:
        lines = ["Node properties:"]
        for label, props in schema["nodes"].items():
            joined = ", ".join(f"{k}: {v}" for k, v in props.items())
            lines.append(f"  {label} {{{joined}}}")
        lines.append("Relationships:")
        for r in schema["relations"]:
            lines.append(f"  {r}")
        return "\n".join(lines)

    def _vendor_result_formatter(self, record: Any) -> Any:
        return self._retriever_item_cls(
            content=json.dumps(dict(record), ensure_ascii=False, default=str),
            metadata={"name": record.get("name", "")},
        )

    def _connect_mysql(self):
        if not all([self.settings.mysql_host, self.settings.mysql_user,
                    self.settings.mysql_password, self.settings.mysql_db]):
            return None
        try:
            return mysql.connector.connect(
                host=self.settings.mysql_host, user=self.settings.mysql_user,
                password=self.settings.mysql_password, database=self.settings.mysql_db,
                port=self.settings.mysql_port,
            )
        except Exception:
            return None

    def _ensure_driver(self) -> None:
        if not self.driver:
            raise RuntimeError("Neo4j is not configured.")

    def _ensure_ready(self) -> None:
        if not self.ready():
            raise RuntimeError(
                "SDM GraphRAG is not ready. "
                + (self.startup_error or "Check OPENAI/Neo4j settings.")
            )
