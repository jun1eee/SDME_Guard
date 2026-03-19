import json
import re
from typing import Any

from config import Settings
from schemas import ChatPayload, ChatRequest, RecommendationCard
from sdm.graphrag import SdmGraphRagEngine
from sdm.prompts import CATEGORY_LABELS, SYSTEM_PROMPT
from sdm.tools import TOOLS_SCHEMA, SdmToolRegistry
from session_store import InMemorySessionStore, SessionState


class SdmChatService:
    def __init__(
        self,
        settings: Settings,
        engine: SdmGraphRagEngine,
        session_store: InMemorySessionStore,
    ) -> None:
        self.settings = settings
        self.engine = engine
        self.session_store = session_store
        self.tools = SdmToolRegistry(engine)

    def chat(self, request: ChatRequest, trace_id: str) -> ChatPayload:
        session = self.session_store.get_or_create(request.session_id)
        message = request.message.strip()
        couple_id = self._resolve_couple_id(request)
        log_lines = [f"[input] {message}"]
        log_lines.append(
            f"[history] {len(session.history)} stored, {min(len(session.history), self.settings.session_history_limit)} sent to model"
        )

        try:
            messages = self._build_messages(session, message)
            response = self.engine.run_chat_completion(
                messages=messages,
                tools=TOOLS_SCHEMA,
                tool_choice="auto",
                temperature=0,
            )
        except Exception as exc:
            answer = f"죄송합니다. SDM 챗봇 초기화 또는 호출 중 오류가 발생했습니다. ({exc})"
            self._append_turns(session, message, answer)
            return ChatPayload(
                session_id=session.session_id,
                answer=answer,
                route_used="sdm:error",
                trace_id=trace_id,
                debug_log="\n".join(log_lines) if request.debug else None,
            )

        choice = response.choices[0]
        if response.usage:
            log_lines.append(
                f"[tokens] prompt={response.usage.prompt_tokens}, completion={response.usage.completion_tokens}"
            )

        all_vendors: list[str] = []
        route_used = "sdm:direct"
        requested_count = self._extract_requested_count(message)

        if choice.message.tool_calls:
            route_used = "sdm:tool"
            messages_for_followup = list(messages)
            messages_for_followup.append(
                {
                    "role": "assistant",
                    "content": choice.message.content or "",
                    "tool_calls": [
                        {
                            "id": tool_call.id,
                            "type": "function",
                            "function": {
                                "name": tool_call.function.name,
                                "arguments": tool_call.function.arguments,
                            },
                        }
                        for tool_call in choice.message.tool_calls
                    ],
                }
            )
            tool_results = []
            is_new_search = False

            for tool_call in choice.message.tool_calls:
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)

                if tool_name == "search_structured" and "query" in tool_args:
                    tool_args["query"] = message
                if "category" in tool_args and not tool_args.get("category") and session.category:
                    tool_args["category"] = session.category
                if tool_name in ("search_structured", "search_semantic"):
                    is_new_search = True

                log_lines.append(
                    f"[tool] {tool_name} {json.dumps(tool_args, ensure_ascii=False)[:160]}"
                )

                try:
                    tool_result = self.tools.execute(
                        tool_name=tool_name,
                        couple_id=couple_id,
                        **tool_args,
                    )
                except Exception as exc:
                    log_lines.append(f"[tool_error] {tool_name}: {exc}")
                    messages_for_followup.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": f"오류: {exc}",
                        }
                    )
                    continue

                tool_results.append((tool_call, tool_args, tool_result))
                all_vendors.extend(tool_result.vendors)
                messages_for_followup.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": tool_result.data,
                    }
                )

            answer = self._build_answer_from_tools(messages_for_followup, tool_results, log_lines)

            if not all_vendors:
                for _, tool_args, _ in tool_results:
                    if "vendor_names" in tool_args:
                        all_vendors = tool_args["vendor_names"]
                        break

            self._update_session_from_tools(
                session=session,
                tool_results=tool_results,
                all_vendors=all_vendors,
                is_new_search=is_new_search,
            )
        else:
            answer = choice.message.content or "스드메 관련 질문을 해주세요."

        recommendations = self._build_recommendations(all_vendors, limit=requested_count)
        self._append_turns(session, message, answer)

        return ChatPayload(
            session_id=session.session_id,
            answer=answer,
            route_used=route_used,
            trace_id=trace_id,
            vendors=list(dict.fromkeys(all_vendors)),
            recommendations=recommendations,
            debug_log="\n".join(log_lines) if request.debug else None,
        )

    def _build_messages(self, session: SessionState, message: str) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": self._build_dynamic_system_prompt(session)}
        ]
        history_limit = self.settings.session_history_limit
        messages.extend(session.history[-history_limit:])
        messages.append({"role": "user", "content": message})
        return messages

    def _build_dynamic_system_prompt(self, session: SessionState) -> str:
        state_lines: list[str] = []
        if session.category:
            label = CATEGORY_LABELS.get(session.category, session.category)
            state_lines.append(f"현재 카테고리: {label}")
        if session.vendors:
            state_lines.append(f"추천 업체 목록: {', '.join(session.vendors[:10])}")
        if session.last_mentioned and session.last_mentioned != session.vendors:
            state_lines.append(f"직전 언급 업체: {', '.join(session.last_mentioned[:5])}")
        for category, vendors in session.vendor_history.items():
            if category != session.category and vendors:
                label = CATEGORY_LABELS.get(category, category)
                state_lines.append(f"이전 {label} 추천: {', '.join(vendors[:5])}")

        if not state_lines:
            return SYSTEM_PROMPT
        return SYSTEM_PROMPT + "\n\n[현재 대화 상태]\n" + "\n".join(state_lines)

    def _build_answer_from_tools(
        self,
        messages: list[dict[str, Any]],
        tool_results: list[tuple[Any, dict[str, Any], Any]],
        log_lines: list[str],
    ) -> str:
        if len(tool_results) == 1 and tool_results[0][2].result_type in {"direct", "graphrag"}:
            return tool_results[0][2].data

        try:
            final = self.engine.run_chat_completion(
                messages=messages,
                temperature=0,
            )
            if final.usage:
                log_lines.append(
                    f"[tokens2] prompt={final.usage.prompt_tokens}, completion={final.usage.completion_tokens}"
                )
            return final.choices[0].message.content or "답변을 생성하지 못했습니다."
        except Exception as exc:
            log_lines.append(f"[followup_error] {exc}")
            return "죄송합니다. 답변 생성 중 오류가 발생했습니다."

    def _update_session_from_tools(
        self,
        session: SessionState,
        tool_results: list[tuple[Any, dict[str, Any], Any]],
        all_vendors: list[str],
        is_new_search: bool,
    ) -> None:
        unique_vendors = list(dict.fromkeys(all_vendors))
        if not unique_vendors:
            return

        session.turn += 1
        session.last_mentioned = unique_vendors
        if is_new_search:
            session.vendors = unique_vendors

        for _, tool_args, _ in tool_results:
            category = tool_args.get("category")
            if category:
                session.category = category
                session.vendor_history[category] = unique_vendors
                break

    def _append_turns(self, session: SessionState, user_message: str, answer: str) -> None:
        self.session_store.append_history(session.session_id, "user", user_message)
        self.session_store.append_history(session.session_id, "assistant", answer)

    def _resolve_couple_id(self, request: ChatRequest) -> int:
        if request.context and request.context.couple_id:
            return request.context.couple_id
        return self.settings.default_couple_id

    @staticmethod
    def _extract_requested_count(message: str) -> int | None:
        match = re.search(r"(\d{1,2})\s*개", message)
        if not match:
            return None
        return max(1, min(int(match.group(1)), 20))

    def _build_recommendations(
        self,
        vendor_names: list[str],
        limit: int | None = None,
    ) -> list[RecommendationCard]:
        unique_names = list(dict.fromkeys(vendor_names))
        if not unique_names:
            return []

        records = self.engine.query_vendors_by_names(unique_names)
        if limit:
            records = records[:limit]

        recommendations: list[RecommendationCard] = []
        for record in records:
            recommendations.append(
                RecommendationCard(
                    id=str(record.get("sourceId") or record.get("name")),
                    source="sdm",
                    category=self._map_category(record.get("category")),
                    title=record.get("name") or "추천 업체",
                    subtitle=record.get("region"),
                    description=self._build_description(record),
                    price_label=self._format_price(record.get("price")),
                    rating=self._to_float(record.get("avgReviewScore") or record.get("rating")),
                    review_count=self._to_int(record.get("reviewCount") or record.get("reviewCnt")),
                    address=record.get("address"),
                    image_url=record.get("imageUrl"),
                    link_url=None,
                    tags=list(record.get("tags") or [])[:4],
                )
            )
        return recommendations

    @staticmethod
    def _map_category(category: Any) -> str:
        mapping = {
            "studio": "studio",
            "dress": "dress",
            "makeup": "makeup",
            "hall": "venue",
            "venue": "venue",
            "STUDIO": "studio",
            "DRESS": "dress",
            "MAKEUP": "makeup",
            "HALL": "venue",
        }
        return mapping.get(str(category), "studio")

    @staticmethod
    def _build_description(record: dict[str, Any]) -> str | None:
        tags = list(record.get("tags") or [])[:3]
        packages = record.get("packages") or []
        parts: list[str] = []
        if tags:
            parts.append(", ".join(tags))
        package_titles = [package.get("title") for package in packages if package.get("title")]
        if package_titles:
            parts.append("패키지 " + ", ".join(package_titles[:2]))
        return " / ".join(parts) if parts else None

    @staticmethod
    def _format_price(price: Any) -> str | None:
        value = SdmChatService._to_int(price)
        if value is None:
            return None
        return f"{value:,}원"

    @staticmethod
    def _to_int(value: Any) -> int | None:
        if value in (None, ""):
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _to_float(value: Any) -> float | None:
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
