"""Gradio 채팅 UI — 스드메 + 웨딩홀 통합 (자동 라우팅)"""
import json
import time
import uuid
import re
import requests
import gradio as gr

BASE_URL = "http://localhost:8000"
SDM_API = f"{BASE_URL}/api/chat/sdm"
HALL_API = f"{BASE_URL}/api/chat/hall"
SDM_GRAPH_URL = f"{BASE_URL}/api/chat/sdm/graph"
HALL_GRAPH_URL = f"{BASE_URL}/api/chat/hall/graph"
GRAPH_VIEW_URL = "/api/graph/view"

session_id = str(uuid.uuid4())

EMPTY_GRAPH = '<div style="height:500px;display:flex;align-items:center;justify-content:center;color:#666;font-size:16px;background:#1a1a2e;border-radius:8px;">질문하면 관련 업체의 그래프가 여기에 표시됩니다.</div>'


def make_graph_iframe():
    ts = int(time.time() * 1000)
    return f'<iframe src="{GRAPH_VIEW_URL}?t={ts}" style="width:100%;height:500px;border:none;border-radius:8px;"></iframe>'


def _detect_route(message: str) -> str:
    """메시지에서 sdm/hall 자동 판별. 마지막 키워드 우선."""
    hall_keywords = ["웨딩홀", "홀", "예식장", "하객", "식대", "뷔페", "채플", "호텔웨딩", "컨벤션"]
    sdm_keywords = ["스튜디오", "드레스", "메이크업", "촬영", "헤어", "본식", "리허설", "벌"]

    msg = message.lower()
    # 마지막에 등장하는 키워드 기준으로 판별 (의도가 더 명확)
    last_hall = max((msg.rfind(kw) for kw in hall_keywords), default=-1)
    last_sdm = max((msg.rfind(kw) for kw in sdm_keywords), default=-1)

    if last_sdm > last_hall:
        return "sdm"
    if last_hall > last_sdm:
        return "hall"
    return "unknown"


# 마지막 라우팅 기억 (맥락 유지)
_last_route = {"value": "sdm"}


def chat_fn(message, chat_history, debug_log):
    chat_history = chat_history or []
    msg = message.strip()
    if not msg:
        return "", chat_history, debug_log, EMPTY_GRAPH

    log_lines = [f"[입력] {msg}"]
    graph_html = EMPTY_GRAPH

    # 라우팅
    route = _detect_route(msg)
    if route == "unknown":
        route = _last_route["value"]
    _last_route["value"] = route

    api_url = HALL_API if route == "hall" else SDM_API
    graph_url = HALL_GRAPH_URL if route == "hall" else SDM_GRAPH_URL
    log_lines.append(f"[라우팅] {route}")

    try:
        resp = requests.post(api_url, json={
            "message": msg, "session_id": session_id,
            "context": {"couple_id": 1}, "debug": True,
        }, timeout=60)
        raw = resp.json()
        data = raw.get("data", raw) if raw.get("success") else raw
    except requests.ConnectionError:
        log_lines.append("[오류] 서버 연결 실패")
        chat_history.append({"role": "user", "content": msg})
        chat_history.append({"role": "assistant", "content": "서버 연결 실패."})
        new_log = "\n".join(log_lines)
        full_log = f"{debug_log}\n{'─'*40}\n{new_log}" if debug_log else new_log
        return "", chat_history, full_log, graph_html
    except Exception as e:
        log_lines.append(f"[오류] {e}")
        chat_history.append({"role": "user", "content": msg})
        chat_history.append({"role": "assistant", "content": f"오류: {e}"})
        new_log = "\n".join(log_lines)
        full_log = f"{debug_log}\n{'─'*40}\n{new_log}" if debug_log else new_log
        return "", chat_history, full_log, graph_html

    if resp.status_code == 200 and data.get("answer"):
        answer = data["answer"]
        route_used = data.get("route_used", "")
        vendors = data.get("vendors", [])
        server_log = data.get("debug_log", "")

        log_lines.append(f"[route] {route_used}")
        if vendors:
            log_lines.append(f"[vendors] {', '.join(vendors[:10])}")
        if server_log:
            log_lines.append(server_log)
        log_lines.append(f"[답변 길이] {len(answer)}자")

        if vendors:
            try:
                gr_resp = requests.post(graph_url, json={"vendor_names": vendors[:6], "query": msg}, timeout=10)
                gd = gr_resp.json()
                graph_html = make_graph_iframe()
                log_lines.append(f"[그래프] 노드 {len(gd.get('nodes', []))}개, 엣지 {len(gd.get('edges', []))}개")
            except Exception as e:
                log_lines.append(f"[그래프 오류] {e}")
    else:
        answer = f"오류: {data.get('message', resp.text)}"
        log_lines.append(f"[오류] {resp.status_code}")

    chat_history.append({"role": "user", "content": msg})
    chat_history.append({"role": "assistant", "content": answer})

    new_log = "\n".join(log_lines)
    full_log = f"{debug_log}\n{'─'*40}\n{new_log}" if debug_log else new_log
    return "", chat_history, full_log, graph_html


with gr.Blocks(title="웨딩 AI 챗봇") as demo:
    gr.Markdown("# 웨딩 AI 챗봇\n스드메 + 웨딩홀 통합 추천 (자동 라우팅)")

    with gr.Row():
        with gr.Column(scale=2):
            gr.Markdown("### 처리 흐름")
            debug_box = gr.Textbox(label="", lines=22, max_lines=50, interactive=False)
            gr.Button("로그 초기화", size="sm").click(lambda: "", outputs=[debug_box])

        with gr.Column(scale=5):
            chatbot = gr.Chatbot(height=380)
            with gr.Row():
                msg = gr.Textbox(placeholder="스튜디오, 드레스, 메이크업, 웨딩홀 뭐든 물어보세요!", show_label=False, scale=9)
                send_btn = gr.Button("전송", scale=1)
            with gr.Row():
                gr.Button("스튜디오 추천").click(lambda: "스튜디오 추천해줘", outputs=[msg])
                gr.Button("드레스 추천").click(lambda: "드레스 추천해줘", outputs=[msg])
                gr.Button("메이크업 추천").click(lambda: "메이크업 추천해줘", outputs=[msg])
                gr.Button("웨딩홀 추천").click(lambda: "강남 웨딩홀 추천해줘", outputs=[msg])

    gr.Markdown("### Neo4j 그래프")
    graph_display = gr.HTML(value=EMPTY_GRAPH)

    msg.submit(chat_fn, [msg, chatbot, debug_box], [msg, chatbot, debug_box, graph_display])
    send_btn.click(chat_fn, [msg, chatbot, debug_box], [msg, chatbot, debug_box, graph_display])

if __name__ == "__main__":
    print("FastAPI와 함께: uvicorn main:app --reload --port 8000 → http://localhost:8000/ui")
    demo.launch()
