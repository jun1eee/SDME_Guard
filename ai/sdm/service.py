"""통합 웨딩 챗봇 서비스"""
import json
import re
from typing import Any

from config import Settings
from schemas.chat import ChatPayload, ChatRequest, RecommendationCard
from sdm.graphrag import SdmGraphRagEngine
from sdm.prompts import CATEGORY_LABELS, SYSTEM_PROMPT
from sdm.tools import TOOLS_SCHEMA, ToolRegistry
from session_store import InMemorySessionStore, SessionState


class SdmChatService:
    def __init__(
        self, settings: Settings, engine: SdmGraphRagEngine,
        session_store: InMemorySessionStore, hall_engine=None,
    ) -> None:
        self.settings = settings
        self.engine = engine
        self.session_store = session_store
        self.tools = ToolRegistry(engine, hall_engine=hall_engine)

    def chat(self, request: ChatRequest, trace_id: str) -> ChatPayload:
        session = self.session_store.get_or_create(request.session_id)
        message = request.message.strip()
        couple_id = self._resolve_couple_id(request)
        log_lines = [f"[input] {message}"]

        try:
            messages = self._build_messages(session, message)
            response = self.engine.run_chat_completion(
                messages=messages, tools=TOOLS_SCHEMA, tool_choice="auto", temperature=0,
            )
        except Exception as exc:
            answer = f"죄송합니다. 처리 중 오류가 발생했습니다. ({exc})"
            self._append_turns(session, message, answer)
            return ChatPayload(
                session_id=session.session_id, answer=answer,
                route_used="error", trace_id=trace_id,
                debug_log="\n".join(log_lines) if request.debug else None,
            )

        choice = response.choices[0]
        if response.usage:
            log_lines.append(f"[tokens] prompt={response.usage.prompt_tokens}, completion={response.usage.completion_tokens}")

        all_vendors: list[str] = []
        route_used = "direct"
        requested_count = self._extract_requested_count(message)

        if choice.message.tool_calls:
            route_used = "tool"
            messages_for_followup = list(messages)
            messages_for_followup.append({
                "role": "assistant", "content": choice.message.content or "",
                "tool_calls": [
                    {"id": tc.id, "type": "function",
                     "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                    for tc in choice.message.tool_calls
                ],
            })
            tool_results = []
            is_new_search = False

            for tool_call in choice.message.tool_calls:
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)

                # search는 원문 강제
                if tool_name == "search" and "query" in tool_args:
                    tool_args["query"] = message

                # category 보완
                if "category" in tool_args and not tool_args.get("category") and session.category:
                    tool_args["category"] = session.category

                # 카테고리 키워드 교정
                if "category" in tool_args:
                    corrected = self._correct_category(message, tool_args.get("category"))
                    if corrected and corrected != tool_args.get("category"):
                        log_lines.append(f"[category_corrected] {tool_args.get('category')} -> {corrected}")
                        tool_args["category"] = corrected

                if tool_name in ("search", "search_style", "search_nearby"):
                    is_new_search = True

                log_lines.append(f"[tool] {tool_name} {json.dumps(tool_args, ensure_ascii=False)[:160]}")

                try:
                    tool_result = self.tools.execute(tool_name=tool_name, couple_id=couple_id, **tool_args)
                except Exception as exc:
                    log_lines.append(f"[tool_error] {tool_name}: {exc}")
                    messages_for_followup.append({"role": "tool", "tool_call_id": tool_call.id, "content": f"오류: {exc}"})
                    continue

                tool_results.append((tool_call, tool_args, tool_result))
                all_vendors.extend(tool_result.vendors)
                messages_for_followup.append({"role": "tool", "tool_call_id": tool_call.id, "content": tool_result.data})

            answer = self._build_answer_from_tools(messages_for_followup, tool_results, log_lines)

            # vendor fallback
            if not all_vendors:
                for _, tool_args, _ in tool_results:
                    if "names" in tool_args:
                        all_vendors = tool_args["names"]
                        break
            if not all_vendors and answer:
                all_vendors = self.engine._extract_vendors_from_bold(answer)

            self._update_session_from_tools(
                session=session, tool_results=tool_results,
                all_vendors=all_vendors, is_new_search=is_new_search,
            )
        else:
            answer = choice.message.content or "웨딩 관련 질문을 해주세요."

        recommendations = self._build_recommendations(all_vendors, limit=requested_count)
        self._append_turns(session, message, answer)

        return ChatPayload(
            session_id=session.session_id, answer=answer,
            route_used=route_used, trace_id=trace_id,
            vendors=list(dict.fromkeys(all_vendors)),
            recommendations=recommendations,
            debug_log="\n".join(log_lines) if request.debug else None,
        )

    # ── 카테고리 교정 ──

    @staticmethod
    def _correct_category(message: str, current: str | None) -> str | None:
        kw_map = {
            "hall": ["웨딩홀", "예식장", "하객", "식대", "뷔페", "채플", "호텔웨딩", "컨벤션"],
            "dress": ["드레스", "드레스샵", "벌"],
            "makeup": ["메이크업", "메이크업샵", "헤어"],
            "studio": ["스튜디오", "촬영"],
        }
        matched = set()
        for cat, keywords in kw_map.items():
            if any(kw in message for kw in keywords):
                matched.add(cat)
        if len(matched) == 1:
            return matched.pop()
        return current

    # ── 내부 ──

    def _build_messages(self, session: SessionState, message: str) -> list[dict[str, Any]]:
        messages = [{"role": "system", "content": self._build_dynamic_system_prompt(session)}]
        messages.extend(session.history[-self.settings.session_history_limit:])
        messages.append({"role": "user", "content": message})
        return messages

    def _build_dynamic_system_prompt(self, session: SessionState) -> str:
        state_lines: list[str] = []
        if session.category:
            state_lines.append(f"현재 카테고리: {CATEGORY_LABELS.get(session.category, session.category)}")
        if session.vendors:
            state_lines.append(f"추천 업체 목록: {', '.join(session.vendors[:10])}")
        if session.last_mentioned and session.last_mentioned != session.vendors:
            state_lines.append(f"직전 언급 업체: {', '.join(session.last_mentioned[:5])}")
        for cat, vendors in session.vendor_history.items():
            if cat != session.category and vendors:
                state_lines.append(f"이전 {CATEGORY_LABELS.get(cat, cat)} 추천: {', '.join(vendors[:5])}")
        if not state_lines:
            return SYSTEM_PROMPT
        return SYSTEM_PROMPT + "\n\n[현재 대화 상태]\n" + "\n".join(state_lines)

    def _build_answer_from_tools(self, messages, tool_results, log_lines) -> str:
        if len(tool_results) == 1 and tool_results[0][2].result_type in {"direct", "graphrag"}:
            return tool_results[0][2].data
        try:
            final = self.engine.run_chat_completion(messages=messages, temperature=0)
            if final.usage:
                log_lines.append(f"[tokens2] prompt={final.usage.prompt_tokens}, completion={final.usage.completion_tokens}")
            return final.choices[0].message.content or "답변을 생성하지 못했습니다."
        except Exception as exc:
            log_lines.append(f"[followup_error] {exc}")
            return "죄송합니다. 답변 생성 중 오류가 발생했습니다."

    def _update_session_from_tools(self, session, tool_results, all_vendors, is_new_search) -> None:
        unique = list(dict.fromkeys(all_vendors))
        if not unique:
            return
        session.turn += 1
        session.last_mentioned = unique
        if is_new_search:
            session.vendors = unique
        for _, tool_args, _ in tool_results:
            cat = tool_args.get("category") or tool_args.get("target_category")
            if cat:
                session.category = cat
                session.vendor_history[cat] = unique
                break

    def _append_turns(self, session, user_message, answer) -> None:
        self.session_store.append_history(session.session_id, "user", user_message)
        self.session_store.append_history(session.session_id, "assistant", answer)

    def _resolve_couple_id(self, request: ChatRequest) -> int:
        if request.context and request.context.couple_id:
            return request.context.couple_id
        return self.settings.default_couple_id

    @staticmethod
    def _extract_requested_count(message: str) -> int | None:
        match = re.search(r"(\d{1,2})\s*(?:개|곳|군데)", message)
        return max(1, min(int(match.group(1)), 20)) if match else None

    def _build_recommendations(self, vendor_names, limit=None) -> list[RecommendationCard]:
        unique = list(dict.fromkeys(vendor_names))
        if not unique:
            return []
        records = self.engine.query_vendors_by_names(unique)
        if limit:
            records = records[:limit]
        return [
            RecommendationCard(
                id=str(r.get("sourceId") or r.get("name")),
                source="wedding",
                category=self._map_category(r.get("category")),
                title=r.get("name") or "추천 업체",
                subtitle=r.get("region"),
                description=self._build_description(r),
                price_label=f"{r['price']:,}원" if r.get("price") else None,
                rating=r.get("avgReviewScore") or r.get("rating"),
                review_count=r.get("reviewCount") or r.get("reviewCnt"),
                address=r.get("address"),
                image_url=r.get("imageUrl"),
                tags=list(r.get("tags") or [])[:4],
            )
            for r in records
        ]

    @staticmethod
    def _map_category(cat) -> str:
        return {"studio": "studio", "dress": "dress", "makeup": "makeup",
                "hall": "venue"}.get(str(cat), "studio")

    @staticmethod
    def _build_description(record) -> str | None:
        parts = []
        tags = list(record.get("tags") or [])[:3]
        if tags:
            parts.append(", ".join(tags))
        pkgs = [p.get("title") for p in (record.get("packages") or []) if p.get("title")]
        if pkgs:
            parts.append("패키지 " + ", ".join(pkgs[:2]))
        return " / ".join(parts) if parts else None
