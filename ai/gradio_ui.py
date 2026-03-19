"""Gradio 채팅 UI + 디버그 패널 + Neo4j 그래프 시각화 (plotly)"""
import json
import uuid
import requests
import gradio as gr
import networkx as nx
import plotly.graph_objects as go

API_URL = "http://localhost:8000/api/chat/sdm"
GRAPH_URL = "http://localhost:8000/api/chat/sdm/graph"
session_id = str(uuid.uuid4())

COLOR_MAP = {
    "vendor": "#e74c3c", "region": "#3498db", "district": "#00bcd4",
    "tag": "#2ecc71", "style": "#9b59b6", "review": "#f39c12", "package": "#1abc9c",
}
LABEL_MAP = {
    "vendor": "업체", "region": "지역", "district": "동",
    "tag": "태그", "style": "스타일", "review": "리뷰", "package": "패키지",
}


def build_empty_figure():
    fig = go.Figure()
    fig.update_layout(
        xaxis=dict(visible=False), yaxis=dict(visible=False),
        plot_bgcolor="#1a1a2e", paper_bgcolor="#1a1a2e", height=550,
        annotations=[dict(text="질문하면 관련 업체의 그래프가 여기에 표시됩니다.",
                          xref="paper", yref="paper", x=0.5, y=0.5,
                          showarrow=False, font=dict(size=16, color="#666"))],
    )
    return fig


def build_graph_figure(graph_data):
    nodes = graph_data.get("nodes", [])
    edges = graph_data.get("edges", [])
    matched = set(graph_data.get("matched_keywords", []))

    if not nodes:
        return build_empty_figure()

    G = nx.Graph()
    for n in nodes:
        G.add_node(n["id"], label=n["label"], group=n.get("group", "tag"),
                   title=n.get("title", ""), matched=n["label"] in matched)
    for e in edges:
        G.add_edge(e["from"], e["to"], label=e.get("label", ""))

    pos = nx.spring_layout(G, k=2.5, iterations=60, seed=42)
    fig = go.Figure()

    # 엣지
    for e in edges:
        if e["from"] not in pos or e["to"] not in pos:
            continue
        x0, y0 = pos[e["from"]]
        x1, y1 = pos[e["to"]]
        dash = "dash" if e.get("dashes") else "solid"
        fig.add_trace(go.Scatter(
            x=[x0, x1, None], y=[y0, y1, None], mode="lines",
            line=dict(width=1, color="rgba(255,255,255,0.15)", dash=dash),
            hoverinfo="none", showlegend=False,
        ))
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        fig.add_annotation(x=mx, y=my, text=e.get("label", ""),
                           showarrow=False, font=dict(size=7, color="rgba(255,255,255,0.3)"))

    # 노드 (그룹별)
    groups = {}
    for n in nodes:
        g = n.get("group", "tag")
        groups.setdefault(g, []).append(n)

    for group, group_nodes in groups.items():
        x_vals, y_vals, texts, hovers, sizes, borders = [], [], [], [], [], []
        for n in group_nodes:
            if n["id"] not in pos:
                continue
            x, y = pos[n["id"]]
            is_matched = n["label"] in matched
            x_vals.append(x)
            y_vals.append(y)
            label = n["label"]
            if is_matched:
                label = f"★ {label}"
            texts.append(label)
            hovers.append(n.get("title", n["label"]))
            sizes.append(30 if group == "vendor" else (18 if is_matched else 10))
            borders.append(3 if is_matched else (2 if group == "vendor" else 0.5))

        fig.add_trace(go.Scatter(
            x=x_vals, y=y_vals, mode="markers+text",
            marker=dict(
                size=sizes, color=COLOR_MAP.get(group, "#95a5a6"),
                line=dict(width=borders, color="white" if group == "vendor" else COLOR_MAP.get(group, "#95a5a6")),
            ),
            text=texts, textposition="top center",
            textfont=dict(size=12 if group == "vendor" else 9, color="white"),
            hovertext=hovers, hoverinfo="text",
            name=LABEL_MAP.get(group, group),
        ))

    fig.update_layout(
        showlegend=True,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1,
                    font=dict(color="white")),
        xaxis=dict(visible=False), yaxis=dict(visible=False),
        plot_bgcolor="#1a1a2e", paper_bgcolor="#1a1a2e",
        height=550, margin=dict(l=10, r=10, t=40, b=10),
        hoverlabel=dict(bgcolor="#16213e", font_size=12, font_color="white",
                        bordercolor="#e94560"),
    )
    return fig


def response_fn(message, chat_history, debug_log):
    chat_history = chat_history or []
    msg = message.strip()
    if not msg:
        return "", chat_history, debug_log, build_empty_figure()

    log_lines = [f"[입력] {msg}"]
    graph_fig = build_empty_figure()

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
        return "", chat_history, full_log, graph_fig
    except Exception as e:
        log_lines.append(f"[오류] {e}")
        chat_history.append({"role": "user", "content": msg})
        chat_history.append({"role": "assistant", "content": f"오류: {e}"})
        new_log = "\n".join(log_lines)
        full_log = f"{debug_log}\n{'─'*40}\n{new_log}" if debug_log else new_log
        return "", chat_history, full_log, graph_fig

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

        # 그래프
        if vendors:
            try:
                graph_resp = requests.post(GRAPH_URL, json={
                    "vendor_names": vendors[:6], "query": msg,
                }, timeout=10)
                graph_data = graph_resp.json()
                graph_fig = build_graph_figure(graph_data)
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
    return "", chat_history, full_log, graph_fig


with gr.Blocks(title="웨딩 스드메 추천 챗봇", theme=gr.themes.Base(primary_hue="red")) as demo:
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

    with gr.Row():
        gr.Markdown("### Neo4j 그래프 — ★: 쿼리 매칭 노드")
        graph_btn = gr.Button("인터랙티브 그래프 열기 (새 탭)", size="sm", scale=0)

    graph_plot = gr.Plot(value=build_empty_figure())

    # 새 탭으로 vis.js 그래프 열기 (호버 하이라이트 + 클릭 상세정보)
    graph_btn.click(
        fn=None,
        js="() => { window.open('http://localhost:8000/api/chat/sdm/graph/view', '_blank'); }",
    )

    msg.submit(response_fn, [msg, chatbot, debug_box], [msg, chatbot, debug_box, graph_plot])
    send_btn.click(response_fn, [msg, chatbot, debug_box], [msg, chatbot, debug_box, graph_plot])

if __name__ == "__main__":
    demo.launch()
