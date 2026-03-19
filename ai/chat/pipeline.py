"""
Function Calling 공통 파이프라인.

sdm/hall 모두 이 파이프라인을 통해 대화를 처리.
도메인별 차이(prompts, tools)는 파라미터로 주입.
"""
import json
import re
import time

from deps import get_openai


def _extract_vendors_from_bold(answer: str) -> list:
    """답변의 **볼드** 텍스트에서 업체명 추출 (pipeline-level fallback)"""
    bold_names = re.findall(r"\*\*([^*]{2,30})\*\*", answer)
    skip = {"가격", "평점", "특징", "주소", "웹사이트", "링크", "리뷰", "참고"}
    vendors = []
    for name in bold_names:
        name = name.strip()
        if name in skip or any(s in name for s in skip):
            continue
        if 2 <= len(name) <= 30 and name not in vendors:
            vendors.append(name)
    return vendors


def build_dynamic_system_prompt(base_prompt: str, session: dict) -> str:
    """session_state를 포함한 동적 시스템 프롬프트 생성"""
    cat_kr = {"studio": "스튜디오", "dress": "드레스", "makeup": "메이크업"}

    state_lines = []
    cat = session.get("category")
    if cat:
        state_lines.append(f"현재 카테고리: {cat_kr.get(cat, cat)}")
    vendors = session.get("vendors", [])
    if vendors:
        state_lines.append(f"추천 업체 목록: {', '.join(vendors[:10])}")
    last = session.get("last_mentioned", [])
    if last and last != vendors:
        state_lines.append(f"직전 언급 업체: {', '.join(last[:5])}")
    history = session.get("vendor_history", {})
    for hcat, hvendors in history.items():
        if hcat != cat and hvendors:
            state_lines.append(f"이전 {cat_kr.get(hcat, hcat)} 추천: {', '.join(hvendors[:5])}")

    if state_lines:
        return base_prompt + "\n[현재 대화 상태]\n" + "\n".join(state_lines)
    return base_prompt


async def run_pipeline(
    message: str,
    session: dict,
    system_prompt: str,
    tools_schema: list,
    tool_map: dict,
    couple_id: int = 0,
) -> dict:
    """
    Function Calling 공통 파이프라인.

    Args:
        message: 사용자 메시지 원문
        session: 세션 상태 (session_store에서 가져온 dict)
        system_prompt: 도메인별 SYSTEM_PROMPT
        tools_schema: 도메인별 TOOLS_SCHEMA
        tool_map: 도메인별 TOOL_MAP (tool_name -> function)
        couple_id: 사용자 ID

    Returns:
        dict: answer, vendors, category, tool_used, elapsed_seconds, debug
    """
    client = get_openai()
    debug = {}
    t_start = time.time()

    # -- 1단계: 동적 시스템 프롬프트 + 대화 히스토리 구성 --
    dynamic_prompt = build_dynamic_system_prompt(system_prompt, session)
    messages = [{"role": "system", "content": dynamic_prompt}]

    chat_history = session.get("chat_history", [])
    for m in chat_history[-6:]:
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": message})

    # 디버그: 세션 상태 기록
    debug["session_state"] = {
        "category": session.get("category"),
        "vendors": session.get("vendors", [])[:5],
        "last_mentioned": session.get("last_mentioned", [])[:5],
        "chat_history_count": len(chat_history),
        "turn": session.get("turn", 0),
    }

    # -- 2단계: GPT tool 선택 --
    try:
        t0 = time.time()
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools_schema,
            tool_choice="auto",
            temperature=0,
        )
        debug["tool_select_time"] = round(time.time() - t0, 1)
        if response.usage:
            debug["tokens"] = {
                "prompt": response.usage.prompt_tokens,
                "completion": response.usage.completion_tokens,
            }
    except Exception as e:
        return {
            "answer": "죄송합니다. 처리 중 오류가 발생했습니다.",
            "vendors": [],
            "category": session.get("category"),
            "tool_used": None,
            "elapsed_seconds": round(time.time() - t_start, 1),
            "debug": {"error": f"Tool 선택 실패: {e}"},
        }

    choice = response.choices[0]
    all_vendors = []
    is_new_search = False
    tool_used = None

    # -- 3단계: Tool 실행 --
    if choice.message.tool_calls:
        tool_results = []
        debug["tool_calls"] = len(choice.message.tool_calls)

        for tc in choice.message.tool_calls:
            tool_name = tc.function.name
            tool_args = json.loads(tc.function.arguments)
            tool_used = tool_name

            # query 교체: search_structured만 원문 강제
            if "query" in tool_args and tool_name == "search_structured":
                tool_args["query"] = message

            if tool_name in ("search_structured", "search_semantic"):
                is_new_search = True

            # category 보완: 빈 값이면 세션에서 채움
            if "category" in tool_args and not tool_args.get("category"):
                if session.get("category"):
                    tool_args["category"] = session["category"]

            # category 교정: 사용자 메시지 키워드와 GPT 선택이 충돌하면 교정
            if "category" in tool_args:
                _kw_map = {
                    "dress": ["드레스", "드레스샵", "벌"],
                    "makeup": ["메이크업", "메이크업샵", "헤어"],
                    "studio": ["스튜디오", "촬영"],
                }
                _matched_cats = set()
                for _cat, _keywords in _kw_map.items():
                    if any(kw in message for kw in _keywords):
                        _matched_cats.add(_cat)
                # 키워드가 정확히 1개 카테고리만 가리키고, GPT 선택과 다르면 교정
                if len(_matched_cats) == 1:
                    correct_cat = _matched_cats.pop()
                    if tool_args["category"] != correct_cat:
                        debug["category_corrected"] = {
                            "from": tool_args["category"],
                            "to": correct_cat,
                        }
                        tool_args["category"] = correct_cat

            # couple_id 주입
            tool_args["couple_id"] = couple_id

            tool_fn = tool_map.get(tool_name)
            if not tool_fn:
                tool_results.append((tc, "error", f"알 수 없는 tool: {tool_name}", []))
                continue

            try:
                t0 = time.time()
                result_type, data, vendors = tool_fn(**tool_args)
                debug[f"tool_{tool_name}_time"] = round(time.time() - t0, 1)
                debug[f"tool_{tool_name}_vendors"] = vendors[:5] if vendors else []
                # 답변 텍스트 앞부분 기록 (vendor 추출 디버깅)
                if result_type == "graphrag" and not vendors:
                    debug[f"tool_{tool_name}_answer_preview"] = data[:300] if isinstance(data, str) else ""

                if vendors:
                    all_vendors.extend(vendors)
                tool_results.append((tc, result_type, data, vendors))
            except Exception as e:
                tool_results.append((tc, "error", str(e), []))

        # 결과 처리
        if len(tool_results) == 1:
            tc, result_type, data, vendors = tool_results[0]

            if result_type == "direct":
                answer = data
            elif result_type == "graphrag":
                answer = data
            elif result_type == "raw":
                # raw 데이터 -> GPT에게 답변 생성 요청
                messages.append(choice.message)
                messages.append({"role": "tool", "content": data, "tool_call_id": tc.id})
                try:
                    t0 = time.time()
                    final = client.chat.completions.create(
                        model="gpt-4o", messages=messages, temperature=0,
                    )
                    debug["answer_gen_time"] = round(time.time() - t0, 1)
                    answer = final.choices[0].message.content
                except Exception as e2:
                    answer = "죄송합니다. 답변 생성 중 오류가 발생했습니다."
            else:
                answer = "죄송합니다. 처리 중 오류가 발생했습니다."
        else:
            # 복수 tool_call
            messages.append(choice.message)
            for tc, result_type, data, vendors in tool_results:
                content = data if result_type != "error" else f"오류: {data}"
                messages.append({"role": "tool", "content": content, "tool_call_id": tc.id})
            try:
                t0 = time.time()
                final = client.chat.completions.create(
                    model="gpt-4o", messages=messages, temperature=0,
                )
                debug["answer_gen_time"] = round(time.time() - t0, 1)
                answer = final.choices[0].message.content
            except Exception as e2:
                answer = "죄송합니다. 답변 생성 중 오류가 발생했습니다."
    else:
        # tool 미호출 - 직접 답변
        answer = choice.message.content or "웨딩 스드메 관련 질문을 해주세요."

    # -- 4단계: session_state 업데이트 --
    # fallback 1: tool args에서 vendor_names 추출
    if not all_vendors and choice.message.tool_calls:
        for tc in choice.message.tool_calls:
            args = json.loads(tc.function.arguments)
            if "vendor_names" in args:
                all_vendors = args["vendor_names"]
                break

    # fallback 2: 답변 텍스트의 **볼드** 업체명 추출
    if not all_vendors and answer:
        all_vendors = _extract_vendors_from_bold(answer)
        if all_vendors:
            debug["vendors_from_bold"] = all_vendors[:5]

    # 중복 제거
    seen = set()
    unique_vendors = []
    for v in all_vendors:
        if v not in seen:
            seen.add(v)
            unique_vendors.append(v)
    all_vendors = unique_vendors

    category = session.get("category")
    if all_vendors:
        session["turn"] += 1
        session["last_mentioned"] = all_vendors
        if is_new_search:
            session["vendors"] = all_vendors
            if choice.message.tool_calls:
                for tc in choice.message.tool_calls:
                    cat = json.loads(tc.function.arguments).get("category")
                    if cat:
                        session["category"] = cat
                        session["vendor_history"][cat] = all_vendors
                        category = cat
                        break

    # chat_history 업데이트
    session.setdefault("chat_history", [])
    session["chat_history"].append({"role": "user", "content": message})
    session["chat_history"].append({"role": "assistant", "content": answer})

    return {
        "answer": answer,
        "vendors": all_vendors,
        "category": category,
        "tool_used": tool_used,
        "elapsed_seconds": round(time.time() - t_start, 1),
        "debug": debug,
    }
