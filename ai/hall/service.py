import json
from typing import Any

from openai import OpenAI

from config import Settings
from hall.graphrag import HallCriteria, HallGraphRagEngine, HallRecord
from hall.prompts import HALL_SYSTEM_PROMPT, HALL_TOOLS
from schemas.chat import ChatPayload, ChatRequest, RecommendationCard
from session_store import InMemorySessionStore, SessionState


class HallChatService:
    def __init__(
        self,
        settings: Settings,
        session_store: InMemorySessionStore,
        engine: HallGraphRagEngine,
    ) -> None:
        self.settings = settings
        self.session_store = session_store
        self.engine = engine
        self.openai_client = (
            OpenAI(api_key=settings.openai_api_key)
            if settings.openai_api_key
            else OpenAI()
        )
        self.tool_map = {
            "search_halls": self._tool_search_halls,
            "recommend_from_profile": self._tool_recommend_from_profile,
            "compare_halls": self._tool_compare_halls,
            "get_hall_details": self._tool_get_hall_details,
            "plan_tour_route": self._tool_plan_tour_route,
            "modify_tour_route": self._tool_modify_tour_route,
        }

    def chat(self, request: ChatRequest, trace_id: str) -> ChatPayload:
        session = self.session_store.get_or_create(request.session_id)
        message = request.message.strip()
        self._merge_request_metadata(session, request)
        log_lines = [f"[input] {message}"]

        preferences = request.context.preferences if request.context else None

        try:
            messages = self._build_messages(session, message, couple_context=request.couple_context, preferences=preferences)
            response = self._run_chat_completion(messages=messages, tools=HALL_TOOLS)
        except Exception as exc:
            fallback = self._fallback_search(message)
            answer = (
                "AI 판단 경로에서 오류가 발생해 우선 검색 결과 기준으로 안내드릴게요.\n\n"
                f"{fallback[0]}\n\n(오류: {exc})"
            )
            recommendations = [self._to_recommendation(hall) for hall in fallback[1]]
            self._append_turns(session, message, answer)
            return ChatPayload(
                session_id=session.session_id,
                answer=answer,
                route_used="hall:fallback",
                trace_id=trace_id,
                vendors=[hall.name for hall in fallback[1]],
                recommendations=recommendations,
                debug_log="\n".join(log_lines) if request.debug else None,
            )

        route_used = "hall:direct"
        tool_halls: list[HallRecord] = []
        latest_tool_payload: dict[str, Any] | None = None
        answer = ""
        messages_for_followup = list(messages)

        for _ in range(4):
            choice = response.choices[0]
            message_obj = choice.message
            if response.usage:
                log_lines.append(
                    f"[tokens] prompt={response.usage.prompt_tokens}, completion={response.usage.completion_tokens}"
                )

            if not message_obj.tool_calls:
                answer = message_obj.content or self._build_empty_answer()
                break

            route_used = "hall:tool"
            messages_for_followup.append(
                {
                    "role": "assistant",
                    "content": message_obj.content or "",
                    "tool_calls": [
                        {
                            "id": tool_call.id,
                            "type": "function",
                            "function": {
                                "name": tool_call.function.name,
                                "arguments": tool_call.function.arguments,
                            },
                        }
                        for tool_call in message_obj.tool_calls
                    ],
                }
            )

            for tool_call in message_obj.tool_calls:
                tool_name = tool_call.function.name
                try:
                    tool_args = json.loads(tool_call.function.arguments or "{}")
                except json.JSONDecodeError:
                    tool_args = {}

                log_lines.append(
                    f"[tool] {tool_name} {json.dumps(tool_args, ensure_ascii=False)[:200]}"
                )
                tool_payload = self._execute_tool(tool_name, tool_args, session, message)
                latest_tool_payload = tool_payload
                halls = tool_payload.get("hall_records", [])
                tool_halls.extend(halls)
                self._remember_halls(session, halls)
                # 코드에서 포맷팅 + 취향 있으면 LLM 추천 이유 삽입
                tool_content = self._format_tool_content(tool_payload["public_result"])
                hall_names = [h.get("name", "") for h in (tool_payload["public_result"].get("halls") or [])]
                if preferences and hall_names:
                    tool_content = self._insert_hall_reasons(tool_content, hall_names, preferences, log_lines)

                # 홀 목록이 있으면 코드 포맷을 그대로 사용 (LLM 재작성 안 함)
                if tool_payload["public_result"].get("halls"):
                    answer = tool_content
                else:
                    messages_for_followup.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": tool_content,
                        }
                    )

            # 홀 목록 결과가 아닌 경우만 LLM 호출 (비교, 투어 등)
            if not answer:
                response = self._run_chat_completion(messages=messages_for_followup, tools=HALL_TOOLS)

        if not answer:
            answer = self._build_answer_from_tool_payload(latest_tool_payload)

        unique_halls = list({hall.partner_id: hall for hall in tool_halls}.values())
        recommendations = [self._to_recommendation(hall) for hall in unique_halls]
        self._append_turns(session, message, answer)

        return ChatPayload(
            session_id=session.session_id,
            answer=answer,
            route_used=route_used,
            trace_id=trace_id,
            vendors=[hall.name for hall in unique_halls],
            recommendations=recommendations,
            debug_log="\n".join(log_lines) if request.debug else None,
        )

    def _run_chat_completion(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> Any:
        return self.openai_client.chat.completions.create(
            model=self.settings.openai_chat_model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0,
        )

    def _build_messages(self, session: SessionState, message: str,
                        couple_context=None, preferences: dict | None = None) -> list[dict[str, Any]]:
        system_prompt = self._build_system_prompt(session)
        if couple_context:
            from hall.prompts import HALL_COUPLE_CONTEXT_TEMPLATE
            couple_block = HALL_COUPLE_CONTEXT_TEMPLATE.format(
                groom_summary=couple_context.groom_summary or "없음",
                groom_vendors=couple_context.groom_vendors or "없음",
                bride_summary=couple_context.bride_summary or "없음",
                bride_vendors=couple_context.bride_vendors or "없음",
            )
            system_prompt = couple_block + "\n" + system_prompt
        if preferences:
            pref_lines = ["[커플 취향 정보]"]
            for role_key, label in [("groom", "신랑"), ("bride", "신부")]:
                prefs = preferences.get(role_key)
                if not prefs:
                    continue
                parts = []
                if prefs.get("styles"): parts.append(f"선호 스타일: {', '.join(prefs['styles'])}")
                if prefs.get("colors"): parts.append(f"선호 색상: {', '.join(prefs['colors'])}")
                if prefs.get("moods"): parts.append(f"선호 분위기: {', '.join(prefs['moods'])}")
                if prefs.get("foods"): parts.append(f"선호 음식: {', '.join(prefs['foods'])}")
                if parts:
                    pref_lines.append(f"[{label}] " + " / ".join(parts))
            if len(pref_lines) > 1:
                system_prompt = "\n".join(pref_lines) + "\n\n" + system_prompt
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt}
        ]
        history_limit = self.settings.session_history_limit
        messages.extend(session.history[-history_limit:])
        messages.append({"role": "user", "content": message})
        return messages

    def _build_system_prompt(self, session: SessionState) -> str:
        lines = [HALL_SYSTEM_PROMPT]
        profile = session.metadata.get("hall_profile") or {}
        if profile:
            lines.append("\n[사용자 프로필]")
            lines.append(json.dumps(profile, ensure_ascii=False))
        last_results = session.metadata.get("hall_last_results") or []
        if last_results:
            lines.append("\n[최근 추천 홀]")
            lines.append(", ".join(last_results[:10]))
        return "\n".join(lines)

    def _execute_tool(
        self,
        tool_name: str,
        tool_args: dict[str, Any],
        session: SessionState,
        user_message: str,
    ) -> dict[str, Any]:
        handler = self.tool_map.get(tool_name)
        if not handler:
            return {
                "public_result": {"error": f"Unknown tool: {tool_name}"},
                "hall_records": [],
            }
        return handler(tool_args, session, user_message)

    def _tool_search_halls(
        self,
        tool_args: dict[str, Any],
        session: SessionState,
        user_message: str,
    ) -> dict[str, Any]:
        query = str(tool_args.get("query") or user_message)
        count = self._normalize_count(tool_args.get("count")) or 5
        sort_by = str(tool_args.get("sort_by") or "match")

        previous = self._deserialize_criteria(session.metadata.get("hall_criteria"))
        criteria = self.engine.extract_criteria(query, previous=previous)
        halls = self.engine.search(query=query, criteria=criteria, limit=max(count * 3, 12))
        halls = self._sort_halls(halls, sort_by=sort_by)[:count]
        session.metadata["hall_criteria"] = self._serialize_criteria(criteria)

        return {
            "public_result": {
                "query": query,
                "sort_by": sort_by,
                "criteria": self._serialize_criteria(criteria),
                "halls": [self.engine.serialize_hall(hall) for hall in halls],
            },
            "hall_records": halls,
        }

    def _tool_recommend_from_profile(
        self,
        tool_args: dict[str, Any],
        session: SessionState,
        user_message: str,
    ) -> dict[str, Any]:
        count = self._normalize_count(tool_args.get("count")) or 5
        profile = dict(session.metadata.get("hall_profile") or {})
        halls = self.engine.recommend_from_profile(profile=profile, count=count)
        return {
            "public_result": {
                "profile_used": profile,
                "halls": [self.engine.serialize_hall(hall) for hall in halls],
            },
            "hall_records": halls,
        }

    def _tool_compare_halls(
        self,
        tool_args: dict[str, Any],
        session: SessionState,
        user_message: str,
    ) -> dict[str, Any]:
        hall_names = [str(name) for name in tool_args.get("hall_names") or [] if str(name).strip()]
        if not hall_names:
            hall_names = list(session.metadata.get("hall_last_results") or [])[:3]

        halls = self.engine.compare_halls(hall_names)
        return {
            "public_result": {
                "requested_halls": hall_names,
                "halls": [self.engine.serialize_hall(hall) for hall in halls],
            },
            "hall_records": halls,
        }

    def _tool_get_hall_details(
        self,
        tool_args: dict[str, Any],
        session: SessionState,
        user_message: str,
    ) -> dict[str, Any]:
        hall_name = str(tool_args.get("hall_name") or "").strip()
        if not hall_name:
            hall_name = next(iter(session.metadata.get("hall_last_results") or []), "")

        hall = self.engine.get_hall_details(hall_name) if hall_name else None
        halls = [hall] if hall else []
        return {
            "public_result": {
                "requested_hall": hall_name,
                "halls": [self.engine.serialize_hall(item) for item in halls],
            },
            "hall_records": halls,
        }

    def _tool_plan_tour_route(
        self,
        tool_args: dict[str, Any],
        session: SessionState,
        user_message: str,
    ) -> dict[str, Any]:
        hall_names = [str(name) for name in tool_args.get("hall_names") or [] if str(name).strip()]
        if not hall_names:
            hall_names = list(session.metadata.get("hall_last_results") or [])[:4]
        result = self.engine.plan_tour(
            hall_names=hall_names,
            start_location=tool_args.get("start_location"),
            transport=str(tool_args.get("transport") or "car"),
            start_time=tool_args.get("start_time"),
            visit_date=tool_args.get("visit_date"),
            visit_duration=self._safe_int_arg(tool_args.get("visit_duration")),
        )
        ordered_halls = [
            self.engine.get_hall_details(str(hall["name"]))
            for hall in result.get("ordered_halls", [])
        ]
        session.metadata["hall_last_tour"] = {
            "hall_names": [str(hall["name"]) for hall in result.get("ordered_halls", [])],
            "start_location": tool_args.get("start_location"),
            "transport": str(tool_args.get("transport") or "car"),
            "start_time": tool_args.get("start_time"),
            "visit_date": tool_args.get("visit_date"),
            "visit_duration": self._safe_int_arg(tool_args.get("visit_duration")),
        }
        return {
            "public_result": result,
            "hall_records": [hall for hall in ordered_halls if hall],
        }

    def _tool_modify_tour_route(
        self,
        tool_args: dict[str, Any],
        session: SessionState,
        user_message: str,
    ) -> dict[str, Any]:
        last_tour = session.metadata.get("hall_last_tour")
        if not last_tour:
            return {
                "public_result": {"error": "이전 투어 계획이 없습니다. 먼저 plan_tour_route로 투어를 계획해주세요."},
                "hall_records": [],
            }

        hall_names = list(last_tour.get("hall_names") or [])
        action = str(tool_args.get("action") or "")

        if action == "swap":
            index_a = tool_args.get("index_a")
            index_b = tool_args.get("index_b")
            if index_a is not None and index_b is not None:
                a, b = int(index_a), int(index_b)
                if 0 <= a < len(hall_names) and 0 <= b < len(hall_names):
                    hall_names[a], hall_names[b] = hall_names[b], hall_names[a]
        elif action == "remove":
            index = tool_args.get("index")
            if index is not None:
                idx = int(index)
                if 0 <= idx < len(hall_names):
                    hall_names.pop(idx)
        elif action == "add":
            hall_name = str(tool_args.get("hall_name") or "").strip()
            if hall_name:
                position = tool_args.get("position")
                if position is not None:
                    pos = int(position)
                    pos = max(0, min(pos, len(hall_names)))
                    hall_names.insert(pos, hall_name)
                else:
                    hall_names.append(hall_name)
        elif action == "reorder":
            new_order = tool_args.get("new_order")
            if isinstance(new_order, list) and len(new_order) == len(hall_names):
                try:
                    reordered = [hall_names[int(i)] for i in new_order]
                    hall_names = reordered
                except (IndexError, TypeError, ValueError):
                    pass
        else:
            return {
                "public_result": {"error": f"지원하지 않는 action입니다: {action}"},
                "hall_records": [],
            }

        if not hall_names:
            return {
                "public_result": {"error": "수정 후 투어할 웨딩홀이 없습니다."},
                "hall_records": [],
            }

        result = self.engine.plan_tour(
            hall_names=hall_names,
            start_location=last_tour.get("start_location"),
            transport=str(last_tour.get("transport") or "car"),
            start_time=last_tour.get("start_time"),
            visit_date=last_tour.get("visit_date"),
            visit_duration=last_tour.get("visit_duration"),
            preserve_order=True,
        )
        ordered_halls = [
            self.engine.get_hall_details(str(hall["name"]))
            for hall in result.get("ordered_halls", [])
        ]
        session.metadata["hall_last_tour"] = {
            "hall_names": [str(hall["name"]) for hall in result.get("ordered_halls", [])],
            "start_location": last_tour.get("start_location"),
            "transport": last_tour.get("transport"),
            "start_time": last_tour.get("start_time"),
            "visit_date": last_tour.get("visit_date"),
            "visit_duration": last_tour.get("visit_duration"),
        }
        return {
            "public_result": result,
            "hall_records": [hall for hall in ordered_halls if hall],
        }

    @staticmethod
    def _safe_int_arg(value: Any) -> int | None:
        if value in (None, ""):
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _merge_request_metadata(self, session: SessionState, request: ChatRequest) -> None:
        metadata = (request.context.metadata if request.context else None) or {}
        hall_profile = dict(session.metadata.get("hall_profile") or {})

        preferences = metadata.get("preferences")
        if isinstance(preferences, dict):
            preferred_regions = preferences.get("preferredRegions") or []
            hall_profile.update(
                {
                    "hall_budget": preferences.get("hallBudget"),
                    "total_budget": preferences.get("totalBudget"),
                    "guest_count": preferences.get("guestCount"),
                    "hall_style": preferences.get("hallStyle"),
                    "preferred_regions": preferred_regions,
                    "styles": preferences.get("styles"),
                    "colors": preferences.get("colors"),
                    "moods": preferences.get("moods"),
                    "foods": preferences.get("foods"),
                }
            )

        liked_halls = metadata.get("liked_halls")
        if isinstance(liked_halls, list):
            hall_profile["liked_halls"] = [str(name) for name in liked_halls if str(name).strip()]

        session.metadata["hall_profile"] = hall_profile

    def _remember_halls(self, session: SessionState, halls: list[HallRecord]) -> None:
        if not halls:
            return
        session.metadata["hall_last_results"] = [hall.name for hall in halls]

    def _append_turns(self, session: SessionState, user_message: str, answer: str) -> None:
        self.session_store.append_history(session.session_id, "user", user_message)
        self.session_store.append_history(session.session_id, "assistant", answer)

    def _insert_hall_reasons(self, formatted_text: str, hall_names: list[str],
                            preferences: dict, log_lines: list[str]) -> str:
        """LLM에 추천 이유만 요청하고 코드 포맷에 삽입"""
        pref_summary = []
        for role_key, label in [("groom", "신랑"), ("bride", "신부")]:
            prefs = preferences.get(role_key)
            if not prefs:
                continue
            parts = []
            if prefs.get("styles"): parts.append(f"스타일: {', '.join(prefs['styles'])}")
            if prefs.get("colors"): parts.append(f"색상: {', '.join(prefs['colors'])}")
            if prefs.get("moods"): parts.append(f"분위기: {', '.join(prefs['moods'])}")
            if prefs.get("foods"): parts.append(f"음식: {', '.join(prefs['foods'])}")
            if parts:
                pref_summary.append(f"{label} - {' / '.join(parts)}")

        if not pref_summary:
            return formatted_text

        hall_list = "\n".join(f"{i+1}. {n}" for i, n in enumerate(hall_names))
        prompt = (
            f"커플 취향:\n{chr(10).join(pref_summary)}\n\n"
            f"추천 웨딩홀:\n{hall_list}\n\n"
            f"각 웨딩홀이 이 커플에게 왜 적합한지 한 줄씩 이유를 작성하세요.\n"
            f"형식: 홀이름: 이유\n"
            f"홀이름만 쓰고 번호는 쓰지 마세요."
        )
        try:
            resp = self._run_chat_completion(
                messages=[{"role": "user", "content": prompt}],
            )
            reasons_text = resp.choices[0].message.content or ""
            if resp.usage:
                log_lines.append(f"[tokens_reason] prompt={resp.usage.prompt_tokens}, completion={resp.usage.completion_tokens}")

            reason_map: dict[str, str] = {}
            for line in reasons_text.strip().splitlines():
                if ":" in line:
                    name, reason = line.split(":", 1)
                    name = name.strip().lstrip("0123456789.) ")
                    reason_map[name.strip()] = reason.strip()

            for hall_name in hall_names:
                reason = reason_map.get(hall_name)
                if reason:
                    formatted_text = formatted_text.replace(
                        f"**{hall_name}**",
                        f"**{hall_name}**\n  → {reason}",
                    )
        except Exception as exc:
            log_lines.append(f"[reason_error] {exc}")

        return formatted_text

    def _format_tool_content(self, public_result: dict[str, Any]) -> str:
        """tool 결과를 LLM에 전달할 포맷팅된 텍스트로 변환"""
        halls = public_result.get("halls") or []
        if not halls:
            return json.dumps(public_result, ensure_ascii=False, default=str)

        lines = []
        for i, hall in enumerate(halls, 1):
            name = hall.get("name", "")
            region = hall.get("region", "")
            sub_region = hall.get("subRegion", "")
            address = hall.get("address", "")
            meal_min = hall.get("minMealPrice")
            hall_min = hall.get("minHallPrice")
            hall_max = hall.get("maxHallPrice")
            rating = hall.get("rating", 0)
            tags = hall.get("tags") or []
            styles = hall.get("styleFilters") or []
            memo = (hall.get("memo") or "")[:200]

            line = f"**{i}. {name}**\n"
            if address:
                line += f"- 위치: {address}\n"
            elif region or sub_region:
                line += f"- 위치: {region} {sub_region}\n".strip() + "\n"
            if meal_min:
                line += f"- 식대: {meal_min:,}원\n"
            if hall_min:
                price_str = f"- 홀 대관료: {hall_min // 10000}만원"
                if hall_max and hall_max != hall_min:
                    price_str += f"~{hall_max // 10000}만원"
                line += price_str + "\n"
            if rating:
                line += f"- 평점: {rating}\n"
            if tags:
                line += f"- 태그: {', '.join(tags[:5])}\n"
            lines.append(line.rstrip())

        return "\n\n".join(lines)

    def _build_answer_from_tool_payload(self, payload: dict[str, Any] | None) -> str:
        if not payload:
            return self._build_empty_answer()
        public_result = payload.get("public_result") or {}
        halls = public_result.get("halls") or []
        if not halls:
            return self._build_empty_answer()

        lines = ["조건에 맞는 웨딩홀 후보를 정리해드릴게요."]
        for index, hall in enumerate(halls[:5], start=1):
            name = hall.get("name", "웨딩홀")
            rating = hall.get("rating")
            address = hall.get("address") or hall.get("region") or ""
            lines.append(f"{index}. {name} | 평점 {rating} | {address}")
        lines.append("원하시면 여기서 바로 비교나 상세 조건으로 더 좁혀드릴게요.")
        return "\n".join(lines)

    def _build_empty_answer(self) -> str:
        return (
            "조건에 맞는 웨딩홀을 바로 좁히지 못했습니다. "
            "지역, 예산, 식대, 하객 수, 원하는 분위기 중 하나만 더 알려주시면 다시 추천드릴게요."
        )

    def _fallback_search(self, message: str) -> tuple[str, list[HallRecord]]:
        criteria = self.engine.extract_criteria(message)
        halls = self.engine.search(query=message, criteria=criteria, limit=3)
        if not halls:
            return (self._build_empty_answer(), [])
        answer = self._build_answer_from_tool_payload(
            {
                "public_result": {
                    "halls": [self.engine.serialize_hall(hall) for hall in halls],
                }
            }
        )
        return answer, halls

    def _sort_halls(self, halls: list[HallRecord], sort_by: str) -> list[HallRecord]:
        if sort_by == "rating":
            return sorted(halls, key=lambda hall: (-(hall.rating or 0), -(hall.review_count or 0)))
        if sort_by == "review":
            return sorted(halls, key=lambda hall: (-(hall.review_count or 0), -(hall.rating or 0)))
        if sort_by == "price_asc":
            return sorted(halls, key=lambda hall: hall.min_total_price or 9_999_999_999)
        if sort_by == "price_desc":
            return sorted(halls, key=lambda hall: -(hall.min_total_price or 0))
        return halls

    def _to_recommendation(self, hall: HallRecord) -> RecommendationCard:
        price_parts: list[str] = []
        if hall.min_meal_price:
            price_parts.append(
                f"식대 {self._format_price_range(hall.min_meal_price, hall.max_meal_price)}"
            )
        if hall.min_total_price or hall.max_total_price:
            price_parts.append(
                f"홀 비용 {self._format_price_range(hall.min_total_price, hall.max_total_price)}"
            )
        elif hall.min_rental_price or hall.max_rental_price:
            price_parts.append(
                f"대관비 {self._format_price_range(hall.min_rental_price, hall.max_rental_price)}"
            )

        return RecommendationCard(
            id=str(hall.partner_id),
            source="hall",
            category="venue",
            title=hall.name,
            subtitle=hall.sub_region or hall.region or None,
            description=self._build_hall_description(hall),
            price_label=" / ".join(price_parts) if price_parts else None,
            rating=hall.rating or None,
            review_count=hall.review_count or None,
            address=hall.address or None,
            image_url=hall.cover_url or (hall.images[0] if hall.images else None),
            link_url=None,
            tags=(hall.tags + hall.style_filters)[:4],
        )

    @staticmethod
    def _build_hall_description(hall: HallRecord) -> str | None:
        parts: list[str] = []
        if hall.address_hint:
            parts.append(hall.address_hint)
        elif hall.stations:
            access = hall.stations[0]
            if hall.subway_lines:
                access = f"{hall.subway_lines[0]} {access}"
            if hall.walk_minutes:
                access = f"{access} 도보 {hall.walk_minutes}분"
            parts.append(access)
        if hall.memo:
            parts.append(hall.memo[:120] + ("..." if len(hall.memo) > 120 else ""))
        return " / ".join(parts) if parts else None

    @staticmethod
    def _format_price(value: int) -> str:
        if value >= 10_000_000:
            return f"{value / 10_000_000:.1f}천만원".replace(".0", "")
        return f"{value / 10_000:.0f}만원"

    def _format_price_range(self, minimum: int | None, maximum: int | None) -> str:
        if minimum and maximum and minimum != maximum:
            return f"{self._format_price(minimum)} ~ {self._format_price(maximum)}"
        if minimum:
            return self._format_price(minimum)
        if maximum:
            return self._format_price(maximum)
        return "정보 없음"

    @staticmethod
    def _normalize_count(raw_value: Any) -> int | None:
        if raw_value in (None, ""):
            return None
        try:
            return max(1, min(int(raw_value), 10))
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _serialize_criteria(criteria: HallCriteria) -> dict[str, Any]:
        return {
            "regions": criteria.regions,
            "subway_lines": criteria.subway_lines,
            "stations": criteria.stations,
            "styles": criteria.styles,
            "features": criteria.features,
            "budget": criteria.budget,
            "meal_budget": criteria.meal_budget,
            "guest_count": criteria.guest_count,
            "count": criteria.count,
        }

    @staticmethod
    def _deserialize_criteria(raw: object) -> HallCriteria | None:
        if not isinstance(raw, dict):
            return None
        return HallCriteria(
            regions=list(raw.get("regions", [])),
            subway_lines=list(raw.get("subway_lines", [])),
            stations=list(raw.get("stations", [])),
            styles=list(raw.get("styles", [])),
            features=list(raw.get("features", [])),
            budget=raw.get("budget"),
            meal_budget=raw.get("meal_budget"),
            guest_count=raw.get("guest_count"),
            count=raw.get("count"),
        )
