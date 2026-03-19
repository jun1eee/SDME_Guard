"""스드메 챗봇 라우터"""
import json
from typing import List
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from schemas.chat import ChatRequest, ChatResponse
from session_store import get_session, reset_session
from sdm.service import process_message
from deps import get_driver

router = APIRouter(tags=["sdm"])

# 최신 그래프 데이터 저장 (vis.js HTML 서빙용)
_latest_graph = {"nodes": [], "edges": [], "query": "", "matched_keywords": []}


@router.post("/sdm", response_model=ChatResponse)
async def chat_sdm(req: ChatRequest):
    session = get_session(req.session_id)
    result = await process_message(req.message, session, req.couple_id)
    return ChatResponse(session_id=req.session_id, **result)


@router.get("/sdm/session/{session_id}")
async def get_sdm_session(session_id: str):
    """디버그용: 세션 상태 확인"""
    session = get_session(session_id)
    return {
        "session_id": session_id,
        "category": session.get("category"),
        "vendors": session.get("vendors", []),
        "last_mentioned": session.get("last_mentioned", []),
        "chat_history_count": len(session.get("chat_history", [])),
        "turn": session.get("turn", 0),
    }


@router.post("/sdm/graph")
async def get_vendor_graph(req: dict):
    """검색 결과 업체들의 그래프 데이터 반환 (시각화용)"""
    vendor_names = req.get("vendor_names", [])
    if not vendor_names:
        return {"nodes": [], "edges": []}

    driver = get_driver()
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


@router.get("/sdm/graph/view", response_class=HTMLResponse)
async def graph_view():
    """vis.js 그래프 시각화 HTML 페이지"""
    nodes_json = json.dumps(_latest_graph.get("nodes", []), ensure_ascii=False)
    edges_json = json.dumps(_latest_graph.get("edges", []), ensure_ascii=False)
    query = _latest_graph.get("query", "")
    matched_json = json.dumps(_latest_graph.get("matched_keywords", []), ensure_ascii=False)

    return f"""<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Neo4j Graph</title>
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; }}
  #graph {{ width:100%; height:calc(100vh - 50px); }}
  #info-bar {{
    height:50px; display:flex; align-items:center; justify-content:space-between;
    padding:0 20px; background:#16213e; border-bottom:1px solid #333;
  }}
  #info-bar .query {{ color:#e94560; font-weight:bold; }}
  #info-bar .legend span {{ margin:0 8px; font-size:13px; }}
  #tooltip {{
    display:none; position:absolute; background:rgba(22,33,62,0.95);
    border:1px solid #e94560; border-radius:8px; padding:12px 16px;
    font-size:13px; max-width:300px; z-index:100; color:#eee;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  }}
  #tooltip .title {{ font-size:15px; font-weight:bold; color:#e94560; margin-bottom:6px; }}
  #tooltip .type {{ color:#888; font-size:11px; margin-bottom:4px; }}
  .dot {{ display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:4px; vertical-align:middle; }}
</style>
</head><body>
<div id="info-bar">
  <div>
    <span class="query">Query: {query or "(없음)"}</span>
  </div>
  <div class="legend">
    <span><span class="dot" style="background:#e94560"></span>업체</span>
    <span><span class="dot" style="background:#3498db"></span>지역</span>
    <span><span class="dot" style="background:#2ecc71"></span>태그</span>
    <span><span class="dot" style="background:#9b59b6"></span>스타일</span>
    <span><span class="dot" style="background:#f39c12"></span>리뷰</span>
    <span><span class="dot" style="background:#1abc9c"></span>패키지</span>
    <span style="color:#ff6b6b">&#9733; = 쿼리 매칭</span>
  </div>
</div>
<div id="graph"></div>
<div id="tooltip"></div>

<script>
var matchedKeywords = {matched_json};

var colorMap = {{
  vendor: '#e94560', region: '#3498db', tag: '#2ecc71',
  style: '#9b59b6', review: '#f39c12', 'package': '#1abc9c'
}};
var shapeMap = {{
  vendor: 'dot', region: 'diamond', tag: 'dot',
  style: 'triangle', review: 'square', 'package': 'star'
}};

var rawNodes = {nodes_json};
var rawEdges = {edges_json};

// 쿼리 매칭 여부 확인
function isMatched(label) {{
  for (var i = 0; i < matchedKeywords.length; i++) {{
    if (label.indexOf(matchedKeywords[i]) >= 0) return true;
  }}
  return false;
}}

// 노드 생성
var visNodes = rawNodes.map(function(n) {{
  var g = n.group || 'tag';
  var matched = isMatched(n.label);
  var size = g === 'vendor' ? 35 : (matched ? 20 : 13);
  var node = {{
    id: n.id,
    label: n.label,
    group: g,
    color: {{
      background: colorMap[g] || '#95a5a6',
      border: matched ? '#ff6b6b' : (colorMap[g] || '#95a5a6'),
      highlight: {{ background: '#ff6b6b', border: '#ff0000' }},
      hover: {{ background: colorMap[g] || '#95a5a6', border: '#fff' }}
    }},
    shape: shapeMap[g] || 'dot',
    size: size,
    borderWidth: matched ? 4 : (g === 'vendor' ? 3 : 1),
    font: {{
      size: g === 'vendor' ? 16 : (matched ? 14 : 11),
      color: '#eee',
      strokeWidth: 3,
      strokeColor: '#1a1a2e'
    }},
    shadow: matched ? {{ enabled: true, color: '#ff6b6b', size: 15, x: 0, y: 0 }} : false,
    title: n.title || n.label,
    _group: g,
    _matched: matched
  }};
  return node;
}});

// 엣지 생성
var visEdges = rawEdges.map(function(e) {{
  return {{
    from: e.from, to: e.to,
    label: e.label || '',
    dashes: e.dashes || false,
    font: {{ size: 9, color: '#666', strokeWidth: 0 }},
    arrows: {{ to: {{ enabled: true, scaleFactor: 0.5 }} }},
    color: {{ color: '#444', highlight: '#e94560', hover: '#888' }},
    smooth: {{ type: 'continuous' }}
  }};
}});

var nodes = new vis.DataSet(visNodes);
var edges = new vis.DataSet(visEdges);

var container = document.getElementById('graph');
var network = new vis.Network(container, {{ nodes: nodes, edges: edges }}, {{
  physics: {{
    solver: 'forceAtlas2Based',
    forceAtlas2Based: {{ gravitationalConstant: -50, centralGravity: 0.008, springLength: 140 }},
    stabilization: {{ iterations: 150 }},
  }},
  interaction: {{
    hover: true,
    tooltipDelay: 100,
    zoomView: true,
    dragView: true,
    hideEdgesOnDrag: true,
    hideEdgesOnZoom: true
  }},
  layout: {{ improvedLayout: true }}
}});

// 호버 시 연결된 노드 하이라이트, 나머지 흐리게
var allNodeIds = nodes.getIds();
var allEdgeIds = edges.getIds();

network.on('hoverNode', function(params) {{
  var hoveredId = params.node;
  var connectedNodes = network.getConnectedNodes(hoveredId);
  var connectedEdges = network.getConnectedEdges(hoveredId);
  connectedNodes.push(hoveredId);

  // 연결 안 된 노드 흐리게
  var updates = [];
  allNodeIds.forEach(function(id) {{
    if (connectedNodes.indexOf(id) === -1) {{
      updates.push({{ id: id, opacity: 0.15, font: {{ color: 'rgba(255,255,255,0.1)' }} }});
    }} else {{
      var n = nodes.get(id);
      updates.push({{ id: id, opacity: 1.0, font: {{ color: '#eee', size: n._group === 'vendor' ? 16 : 13, strokeWidth: 3, strokeColor: '#1a1a2e' }} }});
    }}
  }});
  nodes.update(updates);

  // 연결 안 된 엣지 흐리게
  var edgeUpdates = [];
  allEdgeIds.forEach(function(id) {{
    if (connectedEdges.indexOf(id) === -1) {{
      edgeUpdates.push({{ id: id, color: {{ color: 'rgba(68,68,68,0.1)' }}, font: {{ color: 'transparent' }} }});
    }} else {{
      edgeUpdates.push({{ id: id, color: {{ color: '#e94560' }}, font: {{ color: '#e94560', size: 11 }}, width: 2 }});
    }}
  }});
  edges.update(edgeUpdates);

  // 커스텀 툴팁
  var node = nodes.get(hoveredId);
  if (node) {{
    var groupLabel = {{
      vendor: '업체', region: '지역', tag: '태그',
      style: '스타일', review: '리뷰', 'package': '패키지'
    }};
    var tooltip = document.getElementById('tooltip');
    var matchStr = node._matched ? ' <span style="color:#ff6b6b">&#9733; 쿼리 매칭</span>' : '';
    tooltip.innerHTML = '<div class="type">' + (groupLabel[node._group] || '') + matchStr + '</div>'
      + '<div class="title">' + node.label + '</div>'
      + (node.title && node.title !== node.label ? '<div>' + node.title + '</div>' : '');
    tooltip.style.display = 'block';
    var pos = params.event.center || params.pointer.DOM;
    tooltip.style.left = (pos.x + 15) + 'px';
    tooltip.style.top = (pos.y + 15) + 'px';
  }}
}});

network.on('blurNode', function() {{
  // 모든 노드/엣지 원래대로
  var updates = [];
  allNodeIds.forEach(function(id) {{
    var n = nodes.get(id);
    updates.push({{ id: id, opacity: 1.0, font: {{
      color: '#eee',
      size: n._group === 'vendor' ? 16 : (n._matched ? 14 : 11),
      strokeWidth: 3, strokeColor: '#1a1a2e'
    }} }});
  }});
  nodes.update(updates);

  var edgeUpdates = [];
  allEdgeIds.forEach(function(id) {{
    edgeUpdates.push({{ id: id, color: {{ color: '#444' }}, font: {{ color: '#666', size: 9 }}, width: 1 }});
  }});
  edges.update(edgeUpdates);

  document.getElementById('tooltip').style.display = 'none';
}});

network.on('click', function(params) {{
  if (params.nodes.length > 0) {{
    network.focus(params.nodes[0], {{ scale: 1.5, animation: true }});
  }}
}});
</script>
</body></html>"""


@router.post("/sdm/reset")
async def reset_sdm_session(req: dict):
    session_id = req.get("session_id", "")
    reset_session(session_id)
    return {"success": True, "session_id": session_id}
