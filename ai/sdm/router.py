"""스드메 챗봇 라우터"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse

from schemas.chat import ApiResponse, ChatRequest
from deps import get_sdm_service, get_session_store
from sdm.service import SdmChatService
from session_store import InMemorySessionStore

router = APIRouter(tags=["sdm"])

# 최신 그래프 데이터 저장 (vis.js HTML 서빙용)
_latest_graph = {"nodes": [], "edges": [], "query": "", "matched_keywords": []}

_GRAPH_HTML_TEMPLATE = """<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Neo4j Graph - __QUERY__</title>
<script src="/static/vis-network.min.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; }
  #graph { width:100%; height:calc(100vh - 50px); }
  #bar {
    height:50px; display:flex; align-items:center; justify-content:space-between;
    padding:0 20px; background:#16213e; border-bottom:1px solid #333;
  }
  #bar .q { color:#e94560; font-weight:bold; }
  #bar .legend span { margin:0 6px; font-size:12px; }
  .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:3px; vertical-align:middle; }
  #detail {
    display:none; position:fixed; right:0; top:50px; width:320px; height:calc(100vh - 50px);
    background:rgba(22,33,62,0.97); border-left:2px solid #e94560;
    padding:20px; overflow-y:auto; z-index:200;
  }
  #detail .close { position:absolute; top:10px; right:14px; cursor:pointer; font-size:20px; color:#888; }
  #detail .close:hover { color:#e94560; }
  #detail h2 { color:#e94560; font-size:18px; margin-bottom:12px; }
  #detail .group-badge {
    display:inline-block; padding:2px 10px; border-radius:12px; font-size:11px;
    margin-bottom:10px; color:#fff;
  }
  #detail .info-row { margin:6px 0; font-size:13px; }
  #detail .connections { margin-top:14px; }
  #detail .connections h3 { font-size:14px; color:#aaa; margin-bottom:8px; }
  #detail .conn-item {
    padding:4px 8px; margin:3px 0; border-radius:4px; font-size:12px;
    background:rgba(255,255,255,0.05); cursor:pointer;
  }
  #detail .conn-item:hover { background:rgba(233,69,96,0.2); }
</style>
</head><body>
<div id="bar">
  <div><span class="q">Query: __QUERY__</span></div>
  <div class="legend">
    <span><span class="dot" style="background:#e94560"></span>업체</span>
    <span><span class="dot" style="background:#3498db"></span>지역</span>
    <span><span class="dot" style="background:#00bcd4"></span>동</span>
    <span><span class="dot" style="background:#2ecc71"></span>태그</span>
    <span><span class="dot" style="background:#9b59b6"></span>스타일</span>
    <span><span class="dot" style="background:#f39c12"></span>리뷰</span>
    <span><span class="dot" style="background:#1abc9c"></span>패키지</span>
    <span style="color:#ff6b6b">&#9733; 쿼리매칭</span>
    <span style="color:#888;margin-left:16px">호버: 연결 강조 | 클릭: 상세정보</span>
  </div>
</div>
<div id="graph"></div>
<div id="detail"><span class="close" onclick="closeDetail()">&times;</span><div id="detail-body"></div></div>

<script>
fetch('/api/chat/sdm/graph/data')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    var el = document.createElement('script');
    el.type = 'application/json';
    el.id = 'graph-data';
    el.textContent = JSON.stringify(data);
    document.body.appendChild(el);
    var s = document.createElement('script');
    s.src = '/static/graph.js';
    document.body.appendChild(s);
  });
</script>
</body></html>"""


@router.post("/sdm", response_model=ApiResponse)
async def chat_sdm(
    payload: ChatRequest,
    request: Request,
    service: SdmChatService = Depends(get_sdm_service),
):
    result = service.chat(payload, trace_id=request.state.trace_id)
    return ApiResponse(data=result)


@router.get("/sdm/session/{session_id}")
async def get_sdm_session(
    session_id: str,
    store: InMemorySessionStore = Depends(get_session_store),
):
    """디버그용: 세션 상태 확인"""
    session = store.get_or_create(session_id)
    return {
        "session_id": session_id,
        "category": session.category,
        "vendors": session.vendors,
        "last_mentioned": session.last_mentioned,
        "chat_history_count": len(session.history),
        "turn": session.turn,
    }


@router.post("/sdm/graph")
async def get_vendor_graph(
    req: dict,
    service: SdmChatService = Depends(get_sdm_service),
):
    """검색 결과 업체들의 그래프 데이터 반환 (시각화용)"""
    vendor_names = req.get("vendor_names", [])
    if not vendor_names:
        return {"nodes": [], "edges": []}

    driver = service.engine.driver
    with driver.session() as session:
        records = session.run("""
            MATCH (v:Vendor)
            WHERE any(name IN $names WHERE v.name = name)
            WITH v
            OPTIONAL MATCH (v)-[:IN_REGION]->(r:Region)
            OPTIONAL MATCH (v)-[:IN_DISTRICT]->(dist:District)
            OPTIONAL MATCH (v)-[:HAS_TAG]->(t:Tag)
            OPTIONAL MATCH (v)-[:HAS_STYLE]->(s:StyleFilter)
            OPTIONAL MATCH (v)-[:HAS_REVIEW]->(rv:Review)
            OPTIONAL MATCH (v)-[:HAS_PACKAGE]->(p:Package)
            OPTIONAL MATCH (t)-[co:CO_OCCURS]-(t2:Tag)
            WHERE t2 IS NOT NULL
            WITH v, r, dist, t, s, rv, p, t2, co
            RETURN
                v.name AS vendor, v.category AS category,
                v.salePrice AS price, v.rating AS rating,
                r.name AS region, dist.name AS district,
                collect(DISTINCT {name: t.name, type: t.typeName}) AS tags,
                collect(DISTINCT s.name) AS styles,
                count(DISTINCT rv) AS reviewCount,
                collect(DISTINCT {title: p.title})[..3] AS packages,
                collect(DISTINCT {from: t.name, to: t2.name, count: co.count})[..10] AS cooccurs
        """, names=vendor_names).data()

    nodes = []
    edges = []
    seen_nodes = set()

    for rec in records:
        vendor = rec["vendor"]
        # Vendor 노드
        if vendor not in seen_nodes:
            cat_label = {"studio": "스튜디오", "dress": "드레스", "makeup": "메이크업"}.get(rec["category"], "")
            price_str = f"{rec['price']//10000}만원" if rec.get("price") and rec["price"] > 0 else ""
            nodes.append({
                "id": vendor, "label": vendor,
                "group": "vendor",
                "title": f"{cat_label} | {price_str} | 평점 {rec.get('rating', '-')}",
            })
            seen_nodes.add(vendor)

        # Region 노드
        region = rec.get("region")
        if region and region not in seen_nodes:
            nodes.append({"id": f"r_{region}", "label": region, "group": "region"})
            seen_nodes.add(region)
        if region:
            edges.append({"from": vendor, "to": f"r_{region}", "label": "IN_REGION"})

        # District 노드 (동)
        district = rec.get("district")
        if district:
            dist_id = f"d_{district}"
            if dist_id not in seen_nodes:
                nodes.append({"id": dist_id, "label": district, "group": "district"})
                seen_nodes.add(dist_id)
            edges.append({"from": vendor, "to": dist_id, "label": "IN_DISTRICT"})
            if region:
                part_of_id = f"{dist_id}__{region}"
                if part_of_id not in seen_nodes:
                    edges.append({"from": dist_id, "to": f"r_{region}", "label": "PART_OF", "dashes": True})
                    seen_nodes.add(part_of_id)

        # Tag 노드
        for tag in rec.get("tags", []):
            if not tag.get("name"):
                continue
            tag_id = f"t_{tag['name']}"
            if tag_id not in seen_nodes:
                nodes.append({
                    "id": tag_id, "label": tag["name"], "group": "tag",
                    "title": tag.get("type", ""),
                })
                seen_nodes.add(tag_id)
            edges.append({"from": vendor, "to": tag_id, "label": "HAS_TAG"})

        # Style 노드
        for style in rec.get("styles", []):
            if not style:
                continue
            style_id = f"s_{style}"
            if style_id not in seen_nodes:
                nodes.append({"id": style_id, "label": style, "group": "style"})
                seen_nodes.add(style_id)
            edges.append({"from": vendor, "to": style_id, "label": "HAS_STYLE"})

        # Review 카운트 (개별 노드 대신 요약)
        rev_cnt = rec.get("reviewCount", 0)
        if rev_cnt > 0:
            rev_id = f"rv_{vendor}"
            if rev_id not in seen_nodes:
                nodes.append({"id": rev_id, "label": f"리뷰 {rev_cnt}건", "group": "review"})
                seen_nodes.add(rev_id)
                edges.append({"from": vendor, "to": rev_id, "label": "HAS_REVIEW"})

        # Package
        for pkg in rec.get("packages", []):
            if not pkg.get("title"):
                continue
            pkg_id = f"p_{vendor}_{pkg['title'][:10]}"
            if pkg_id not in seen_nodes:
                nodes.append({"id": pkg_id, "label": pkg["title"][:15], "group": "package"})
                seen_nodes.add(pkg_id)
                edges.append({"from": vendor, "to": pkg_id, "label": "HAS_PACKAGE"})

        # Tag CO_OCCURS
        for co in rec.get("cooccurs", []):
            if not co.get("from") or not co.get("to"):
                continue
            from_id = f"t_{co['from']}"
            to_id = f"t_{co['to']}"
            if to_id not in seen_nodes:
                nodes.append({"id": to_id, "label": co["to"], "group": "tag"})
                seen_nodes.add(to_id)
            edge_id = f"{from_id}_{to_id}"
            reverse_id = f"{to_id}_{from_id}"
            if edge_id not in seen_nodes and reverse_id not in seen_nodes:
                edges.append({"from": from_id, "to": to_id, "label": "CO_OCCURS", "dashes": True})
                seen_nodes.add(edge_id)

    # 쿼리 키워드 매칭 (양방향 부분 포함)
    query = req.get("query", "")
    matched_keywords = []
    if query:
        import re as _re
        keywords = _re.findall(r"[가-힣]{2,}", query)
        # 불용어 제거
        stopwords = {"추천", "해줘", "찾아", "알려", "이하", "이상", "만원", "근처", "군데", "잘하는곳"}
        keywords = [kw for kw in keywords if kw not in stopwords]
        for n in nodes:
            label = n["label"]
            for kw in keywords:
                # 쿼리 키워드가 노드 라벨에 포함 OR 노드 라벨이 쿼리 키워드에 포함
                if (kw in label or label in kw) and label not in matched_keywords:
                    matched_keywords.append(label)

    result = {"nodes": nodes, "edges": edges, "query": query, "matched_keywords": matched_keywords}
    _latest_graph.update(result)
    return result


@router.get("/sdm/graph/data")
async def graph_data():
    """최신 그래프 데이터 반환 (JS에서 fetch)"""
    return {
        "nodes": _latest_graph.get("nodes", []),
        "edges": _latest_graph.get("edges", []),
        "matched": _latest_graph.get("matched_keywords", []),
        "query": _latest_graph.get("query", ""),
    }


@router.get("/sdm/graph/view", response_class=HTMLResponse)
async def graph_view():
    """vis.js 그래프 시각화 HTML 페이지"""
    query = _latest_graph.get("query", "") or "-"
    return _GRAPH_HTML_TEMPLATE.replace("__QUERY__", query)


@router.post("/sdm/reset")
async def reset_sdm_session(
    req: dict,
    store: InMemorySessionStore = Depends(get_session_store),
):
    session_id = req.get("session_id", "")
    store.clear(session_id)
    return {"success": True, "session_id": session_id}
