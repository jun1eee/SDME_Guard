"""Gradio 채팅 UI + 디버그 패널 + Neo4j 그래프 시각화 (vis.js iframe)"""
import json
import time
import uuid
import requests
import gradio as gr

API_URL = "http://localhost:8000/api/chat/sdm"
GRAPH_URL = "http://localhost:8000/api/chat/sdm/graph"
GRAPH_VIEW_URL = "http://localhost:8000/api/chat/sdm/graph/view"
session_id = str(uuid.uuid4())

EMPTY_GRAPH = '<div style="height:550px;display:flex;align-items:center;justify-content:center;color:#666;font-size:16px;background:#1a1a2e;border-radius:8px;">질문하면 관련 업체의 그래프가 여기에 표시됩니다.</div>'


def make_graph_iframe():
    """vis.js 그래프를 iframe으로 표시 (캐시 방지용 timestamp)"""
    ts = int(time.time() * 1000)
    return f'<iframe src="{GRAPH_VIEW_URL}?t={ts}" style="width:100%;height:550px;border:none;border-radius:8px;"></iframe>'


def response_fn(message, chat_history, debug_log):
    chat_history = chat_history or []
    msg = message.strip()
    if not msg:
        return "", chat_history, debug_log, EMPTY_GRAPH

    log_lines = [f"[입력] {msg}"]
    graph_html = EMPTY_GRAPH

    try:
        resp = requests.post(API_URL, json={
            "message": msg, "session_id": session_id, "couple_id": 1,
        }, timeout=60)
        data = resp.json()
    except requests.ConnectionError:
        log_lines.append("[오류] FastAPI 서버 연결 실패")
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

    if resp.status_code == 200 and data.get("success"):
        answer = data["answer"]
        tool_used = data.get("tool_used", "없음")
        category = data.get("category", "없음")
        vendors = data.get("vendors", [])
        elapsed = data.get("elapsed_seconds", 0)
        debug_info = data.get("debug", {})

        log_lines.append(f"[tool] {tool_used}")
        log_lines.append(f"[category] {category}")
        if vendors:
            log_lines.append(f"[vendors] {', '.join(vendors[:10])}")
        log_lines.append(f"[소요시간] {elapsed}초")

        if debug_info:
            log_lines.append("[debug 상세]")
            for k, v in debug_info.items():
                if isinstance(v, (dict, list)):
                    log_lines.append(f"  {k}: {json.dumps(v, ensure_ascii=False)}")
                else:
                    log_lines.append(f"  {k}: {v}")

        log_lines.append(f"[답변 길이] {len(answer)}자")

        # 그래프 데이터 전송 → vis.js iframe 로드
        if vendors:
            try:
                graph_resp = requests.post(GRAPH_URL, json={
                    "vendor_names": vendors[:6], "query": msg,
                }, timeout=10)
                graph_data = graph_resp.json()
                graph_html = make_graph_iframe()
                log_lines.append(f"[그래프] 노드 {len(graph_data.get('nodes', []))}개, "
                                 f"엣지 {len(graph_data.get('edges', []))}개, "
                                 f"매칭: {graph_data.get('matched_keywords', [])}")
            except Exception as e:
                log_lines.append(f"[그래프 오류] {e}")
    else:
        answer = f"오류: {data.get('message', resp.text)}"
        log_lines.append(f"[오류] HTTP {resp.status_code}: {data.get('message', '')}")

    chat_history.append({"role": "user", "content": msg})
    chat_history.append({"role": "assistant", "content": answer})

    new_log = "\n".join(log_lines)
    full_log = f"{debug_log}\n{'─'*40}\n{new_log}" if debug_log else new_log
    return "", chat_history, full_log, graph_html


with gr.Blocks(title="웨딩 스드메 추천 챗봇") as demo:
    gr.Markdown("# 웨딩 스드메 추천 챗봇\n스튜디오 / 드레스 / 메이크업 추천 + Neo4j 그래프 시각화")

    with gr.Row():
        with gr.Column(scale=2):
            gr.Markdown("### 처리 흐름")
            debug_box = gr.Textbox(label="", lines=25, max_lines=50, interactive=False)
            clear_debug_btn = gr.Button("로그 초기화", size="sm")
            clear_debug_btn.click(lambda: "", outputs=[debug_box])

        with gr.Column(scale=5):
            chatbot = gr.Chatbot(height=400)
            with gr.Row():
                msg = gr.Textbox(placeholder="예: 200만원 이하 야외씬 스튜디오 추천해줘", show_label=False, scale=9)
                send_btn = gr.Button("전송", scale=1)
            with gr.Row():
                gr.Button("스튜디오 추천").click(lambda: "스튜디오 추천해줘", outputs=[msg])
                gr.Button("드레스 추천").click(lambda: "드레스 추천해줘", outputs=[msg])
                gr.Button("메이크업 추천").click(lambda: "메이크업 추천해줘", outputs=[msg])
                gr.Button("야외씬 잘 찍는곳").click(lambda: "야외씬 잘 찍는곳 추천해줘", outputs=[msg])

    gr.Markdown("### Neo4j 그래프 — 호버: 연결 강조 | 클릭: 상세정보 | ★: 쿼리 매칭")
    graph_display = gr.HTML(value=EMPTY_GRAPH)

    msg.submit(response_fn, [msg, chatbot, debug_box], [msg, chatbot, debug_box, graph_display])
    send_btn.click(response_fn, [msg, chatbot, debug_box], [msg, chatbot, debug_box, graph_display])

if __name__ == "__main__":
    demo.launch()
