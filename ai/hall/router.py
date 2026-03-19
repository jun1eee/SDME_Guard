import json
import re
from fastapi import APIRouter, Depends, Request

from deps import get_hall_service
from hall.service import HallChatService
from schemas.chat import ApiResponse, ChatRequest

router = APIRouter(prefix="/api/chat", tags=["hall"])

_latest_hall_graph = {"nodes": [], "edges": [], "query": "", "matched_keywords": []}


@router.post("/hall", response_model=ApiResponse)
async def chat_hall(
    payload: ChatRequest,
    request: Request,
    service: HallChatService = Depends(get_hall_service),
):
    result = service.chat(payload, trace_id=request.state.trace_id)
    return ApiResponse(data=result)


@router.post("/hall/graph")
async def get_hall_graph(
    req: dict,
    service: HallChatService = Depends(get_hall_service),
):
    """웨딩홀 그래프 데이터 반환"""
    hall_names = req.get("vendor_names", [])
    if not hall_names:
        return {"nodes": [], "edges": []}

    driver = service.engine.driver
    if not driver:
        return {"nodes": [], "edges": []}

    with driver.session() as session:
        records = session.run("""
            MATCH (h:Hall)
            WHERE any(name IN $names WHERE h.name = name)
            WITH h
            OPTIONAL MATCH (h)-[:IN_REGION]->(r:Region)
            OPTIONAL MATCH (h)-[:IN_DISTRICT]->(d:District)
            OPTIONAL MATCH (h)-[:HAS_TAG]->(t:Tag)
            OPTIONAL MATCH (h)-[:HAS_STYLE_FILTER]->(sf:StyleFilter)
            OPTIONAL MATCH (h)-[:HAS_BENEFIT]->(b:Benefit)
            RETURN h.name AS hall, h.region AS region, h.typeName AS typeName,
                   h.rating AS rating,
                   r.name AS regionName, d.name AS district,
                   collect(DISTINCT t.name) AS tags,
                   collect(DISTINCT sf.name) AS styles,
                   collect(DISTINCT b.title)[..5] AS benefits
        """, names=hall_names).data()

    nodes, edges, seen = [], [], set()

    for rec in records:
        hall = rec["hall"]
        if hall not in seen:
            nodes.append({"id": hall, "label": hall, "group": "vendor",
                          "title": f"{rec.get('typeName', '웨딩홀')} | 평점 {rec.get('rating', '-')}"})
            seen.add(hall)

        region = rec.get("regionName")
        if region and region not in seen:
            nodes.append({"id": f"r_{region}", "label": region, "group": "region"})
            seen.add(region)
        if region:
            edges.append({"from": hall, "to": f"r_{region}", "label": "IN_REGION"})

        district = rec.get("district")
        if district:
            did = f"d_{district}"
            if did not in seen:
                nodes.append({"id": did, "label": district, "group": "district"})
                seen.add(did)
            edges.append({"from": hall, "to": did, "label": "IN_DISTRICT"})

        for tag in rec.get("tags", []):
            if not tag:
                continue
            tid = f"t_{tag}"
            if tid not in seen:
                nodes.append({"id": tid, "label": tag, "group": "tag"})
                seen.add(tid)
            eid = f"{hall}__{tid}"
            if eid not in seen:
                edges.append({"from": hall, "to": tid, "label": "HAS_TAG"})
                seen.add(eid)

        for style in rec.get("styles", []):
            if not style:
                continue
            sid = f"s_{style}"
            if sid not in seen:
                nodes.append({"id": sid, "label": style, "group": "style"})
                seen.add(sid)
            edges.append({"from": hall, "to": sid, "label": "HAS_STYLE"})

        for benefit in rec.get("benefits", []):
            if not benefit:
                continue
            bid = f"b_{benefit[:15]}"
            if bid not in seen:
                nodes.append({"id": bid, "label": benefit[:20], "group": "package"})
                seen.add(bid)
            edges.append({"from": hall, "to": bid, "label": "HAS_BENEFIT"})

    query = req.get("query", "")
    matched = []
    if query:
        keywords = re.findall(r"[가-힣]{2,}", query)
        stopwords = {"추천", "해줘", "알려", "웨딩홀", "웨딩", "가능한"}
        keywords = [kw for kw in keywords if kw not in stopwords]
        for n in nodes:
            for kw in keywords:
                if (kw in n["label"] or n["label"] in kw) and n["label"] not in matched:
                    matched.append(n["label"])

    result = {"nodes": nodes, "edges": edges, "query": query, "matched_keywords": matched}
    _latest_hall_graph.update(result)
    try:
        from main import update_shared_graph
        update_shared_graph(result)
    except Exception:
        pass
    return result
