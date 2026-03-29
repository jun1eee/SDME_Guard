"""통합 웨딩 챗봇 서비스"""
import json
import logging
import re
import time
from typing import Any

logger = logging.getLogger(__name__)

from config import Settings
from schemas.chat import ChatPayload, ChatRequest, CoupleContext, RecommendationCard
from sdm.graphrag import SdmGraphRagEngine
from sdm.prompts import CATEGORY_LABELS, COUPLE_CONTEXT_TEMPLATE, SYSTEM_PROMPT
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
        user_id = request.context.user_id if request.context else None
        log_lines = [f"[input] {message}"]

        # 취향 데이터 추출 (BE에서 context.preferences로 전달)
        preferences = request.context.preferences if request.context else None

        try:
            messages = self._build_messages(session, message, couple_context=request.couple_context, preferences=preferences)
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

                # Category validation: get_detail without related_category but message mentions another category
                if tool_name == "get_detail" and not tool_args.get("related_category"):
                    cat_keywords = {"드레스": "dress", "메이크업": "makeup", "스튜디오": "studio",
                                   "웨딩홀": "hall", "홀": "hall", "촬영": "studio", "헤어": "makeup"}
                    for kw, cat in cat_keywords.items():
                        if kw in message:
                            source_name = tool_args.get("name", "")
                            source_cat = self._get_source_category(source_name, session)
                            if source_cat and cat != source_cat:
                                tool_args["related_category"] = cat
                                log_lines.append(f"[category_inject] {source_name} -> {cat}")
                                break

                if tool_name in ("search", "search_style", "search_nearby", "filter_sort"):
                    is_new_search = True
                if tool_name == "get_detail" and tool_args.get("related_category"):
                    is_new_search = True

                log_lines.append(f"[tool] {tool_name} {json.dumps(tool_args, ensure_ascii=False)[:160]}")
                logger.info(f"[tool] {tool_name} {json.dumps(tool_args, ensure_ascii=False)[:160]}")

                try:
                    tool_result = self.tools.execute(tool_name=tool_name, couple_id=couple_id, user_id=user_id, **tool_args)
                except Exception as exc:
                    log_lines.append(f"[tool_error] {tool_name}: {exc}")
                    logger.warning(f"[tool_error] {tool_name}: {exc}")
                    if "429" in str(exc) or "rate_limit" in str(exc):
                        messages_for_followup.append({"role": "tool", "tool_call_id": tool_call.id, "content": "일시적으로 요청이 많아 처리할 수 없습니다. 잠시 후 다시 시도해주세요."})
                    else:
                        messages_for_followup.append({"role": "tool", "tool_call_id": tool_call.id, "content": f"오류: {exc}"})
                    continue

                tool_results.append((tool_call, tool_args, tool_result))
                all_vendors.extend(tool_result.vendors)
                messages_for_followup.append({"role": "tool", "tool_call_id": tool_call.id, "content": tool_result.data})

            answer = self._build_answer_from_tools(messages_for_followup, tool_results, log_lines,
                                                    has_preferences=bool(preferences))

            # vendor fallback
            if not all_vendors:
                for _, tool_args, _ in tool_results:
                    if "names" in tool_args:
                        all_vendors = tool_args["names"]
                        break
            if not all_vendors and answer:
                all_vendors = self.engine._extract_vendors_from_bold(answer)
            if not all_vendors and answer:
                all_vendors = self.engine._extract_vendors_from_list(answer)

            self._update_session_from_tools(
                session=session, tool_results=tool_results,
                all_vendors=all_vendors, is_new_search=is_new_search,
            )
        else:
            answer = choice.message.content or "웨딩 관련 질문을 해주세요."

        recommendations = self._build_recommendations(all_vendors, limit=requested_count)
        self._append_turns(session, message, answer)

        # 후속 질문 생성 (규칙 기반, LLM 호출 없음)
        tool_names = [tc.function.name for tc in (choice.message.tool_calls or [])] if choice.message.tool_calls else []
        suggestions = self._generate_suggestions(tool_names, all_vendors, session)

        return ChatPayload(
            session_id=session.session_id, answer=answer,
            route_used=route_used, trace_id=trace_id,
            vendors=list(dict.fromkeys(all_vendors)),
            recommendations=recommendations,
            suggestions=suggestions,
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

    def _get_source_category(self, name: str, session) -> str | None:
        """업체 카테고리 조회 (세션 -> Neo4j)"""
        if session.category:
            return session.category
        # Neo4j에서 직접 조회
        if self.engine.driver:
            with self.engine.driver.session() as s:
                r = s.run("MATCH (v:Vendor) WHERE v.name = $n RETURN v.category AS cat LIMIT 1", n=name).single()
                if r:
                    return r["cat"]
        return None

    # ── 내부 ──

    @staticmethod
    def _build_preference_prompt(preferences: dict) -> str:
        lines = ["[커플 취향 정보]"]
        for role_key, label in [("groom", "신랑"), ("bride", "신부")]:
            prefs = preferences.get(role_key)
            if not prefs:
                continue
            parts = []
            if prefs.get("styles"):
                parts.append(f"선호 스타일: {', '.join(prefs['styles'])}")
            if prefs.get("colors"):
                parts.append(f"선호 색상: {', '.join(prefs['colors'])}")
            if prefs.get("moods"):
                parts.append(f"선호 분위기: {', '.join(prefs['moods'])}")
            if prefs.get("foods"):
                parts.append(f"선호 음식: {', '.join(prefs['foods'])}")
            if prefs.get("hall_style"):
                parts.append(f"웨딩홀 스타일: {prefs['hall_style']}")
            if parts:
                lines.append(f"[{label}] " + " / ".join(parts))
        if len(lines) == 1:
            return ""
        lines.append("")
        lines.append("업체를 추천할 때 위 취향 정보를 참고하여 각 업체가 왜 이 커플에게 적합한지 한 줄 이유를 추가하세요.")
        return "\n".join(lines)

    @staticmethod
    def _build_couple_system_prompt(couple_context: CoupleContext) -> str:
        return COUPLE_CONTEXT_TEMPLATE.format(
            groom_summary=couple_context.groom_summary or "",
            groom_vendors=couple_context.groom_vendors or "",
            bride_summary=couple_context.bride_summary or "",
            bride_vendors=couple_context.bride_vendors or "",
        )

    def _build_messages(self, session: SessionState, message: str,
                        couple_context: CoupleContext | None = None,
                        preferences: dict | None = None) -> list[dict[str, Any]]:
        system_prompt = self._build_dynamic_system_prompt(session)
        if couple_context:
            system_prompt = self._build_couple_system_prompt(couple_context) + "\n" + system_prompt
        if preferences:
            pref_block = self._build_preference_prompt(preferences)
            system_prompt = pref_block + "\n" + system_prompt
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(session.history[-self.settings.session_history_limit:])
        messages.append({"role": "user", "content": message})
        return messages

    def _build_dynamic_system_prompt(self, session: SessionState) -> str:
        state_lines: list[str] = []
        if session.category:
            state_lines.append(f"현재 카테고리: {CATEGORY_LABELS.get(session.category, session.category)}")
        if session.last_mentioned and session.last_mentioned != session.vendors:
            state_lines.append(f"직전 언급 업체: {', '.join(session.last_mentioned[:5])}")
        for cat, vendors in session.vendor_history.items():
            if vendors:
                label = CATEGORY_LABELS.get(cat, cat)
                state_lines.append(f"{label} 추천 업체: {', '.join(vendors[:8])}")
        # vendor_history에 없는 현재 추천 업체 (첫 검색 직후 등)
        if session.vendors and not any(
            set(session.vendors) <= set(v) for v in session.vendor_history.values()
        ):
            state_lines.append(f"추천 업체 목록: {', '.join(session.vendors[:10])}")
        if not state_lines:
            return SYSTEM_PROMPT
        return SYSTEM_PROMPT + "\n\n[현재 대화 상태]\n" + "\n".join(state_lines)

    def _build_answer_from_tools(self, messages, tool_results, log_lines,
                                has_preferences: bool = False) -> str:
        # 취향 정보가 있으면 direct 결과도 LLM을 거쳐 추천 이유 생성
        direct_results = [r for _, _, r in tool_results if r.result_type == "direct"]
        if direct_results and not has_preferences:
            if len(direct_results) > 1:
                # 복수 결과: vendor 중복 제거 + 등장 빈도순 정렬
                from collections import Counter
                vendor_counts: Counter = Counter()
                for r in direct_results:
                    for v in r.vendors:
                        vendor_counts[v] += 1
                merged_vendors = [v for v, _ in vendor_counts.most_common()]
                if merged_vendors:
                    # 첫 번째 결과의 tool_args에서 category 추출
                    first_args = next((args for _, args, r in tool_results if r.result_type == "direct"), {})
                    category = first_args.get("related_category", "")
                    return self.tools._build_vendor_list(
                        merged_vendors[:10], category,
                    ).data
            # 단일 결과 또는 vendor 합산 불가 시
            seen = []
            for r in direct_results:
                if r.data not in seen:
                    seen.append(r.data)
            return "\n\n".join(seen)

        # graphrag 결과 (Text2Cypher/VectorCypher 답변) — 단일이든 복수든 첫 번째 사용
        graphrag_results = [r.data for _, _, r in tool_results if r.result_type == "graphrag"]
        if graphrag_results:
            return graphrag_results[0]

        # raw → LLM이 자연어 생성
        try:
            final = self.engine.run_chat_completion(messages=messages, temperature=0)
            if final.usage:
                log_lines.append(f"[tokens2] prompt={final.usage.prompt_tokens}, completion={final.usage.completion_tokens}")
            return final.choices[0].message.content or "답변을 생성하지 못했습니다."
        except Exception as exc:
            log_lines.append(f"[followup_error] {exc}")
            logger.warning(f"[followup_error] {exc}")
            # 429 rate limit 시 1회 재시도
            if "429" in str(exc) or "rate_limit" in str(exc):
                time.sleep(2)
                try:
                    final = self.engine.run_chat_completion(messages=messages, temperature=0)
                    return final.choices[0].message.content or "답변을 생성하지 못했습니다."
                except Exception:
                    pass
            return "죄송합니다. 답변 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."

    def _update_session_from_tools(self, session, tool_results, all_vendors, is_new_search) -> None:
        unique = list(dict.fromkeys(all_vendors))
        if not unique:
            return
        session.turn += 1
        session.last_mentioned = unique
        if is_new_search:
            session.vendors = unique
        for _, tool_args, _ in tool_results:
            cat = tool_args.get("category") or tool_args.get("related_category") or tool_args.get("target_category")
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
        """추천 결과 — ID + 요약만 (상세는 백엔드가 MySQL에서 조회)"""
        unique = list(dict.fromkeys(vendor_names))
        if not unique:
            return []
        # Vendor(스드메) 조회
        records = self.engine.query_vendors_by_names(unique)
        # Hall(웨딩홀) 조회 — Vendor에서 못 찾은 이름
        found_names = {r.get("name") for r in records}
        if self.tools.hall_engine:
            for name in unique:
                if name not in found_names:
                    hall = self.tools.hall_engine.get_hall_details(name)
                    if hall:
                        records.append({
                            "sourceId": hall.partner_id, "name": hall.name,
                            "category": "hall", "tags": hall.tags[:3],
                            "address": hall.address or f"{hall.region} {hall.sub_region}".strip(),
                        })
        # 같은 이름 업체 중복 제거 (패키지 다른 레코드 합침)
        seen: dict[str, dict] = {}
        deduped: list[dict] = []
        for r in records:
            name = r.get("name", "")
            if name in seen:
                # 태그 합침
                existing = seen[name]
                existing_tags = set(existing.get("tags") or [])
                new_tags = set(r.get("tags") or [])
                existing["tags"] = list(existing_tags | new_tags)[:6]
            else:
                seen[name] = r
                deduped.append(r)
        records = deduped
        if limit:
            records = records[:limit]
        return [
            RecommendationCard(
                id=str(r.get("sourceId") or r.get("name")),
                source="hall" if r.get("category") == "hall" else "sdm",
                category=self._map_category(r.get("category")),
                title=r.get("name") or "추천 업체",
                reason=", ".join(list(r.get("tags") or [])[:4]) or None,
                address=r.get("address") or r.get("region") or None,
            )
            for r in records
        ]

    @staticmethod
    def _generate_suggestions(tool_names: list[str], vendors: list[str],
                              session) -> list[str]:
        """tool 결과 기반 후속 질문 생성 (LLM 호출 없음)"""
        if not tool_names:
            # tool 미사용 (잡담/일반 답변)
            return ["웨딩홀 추천해줘", "스튜디오 찾아줘", "결혼 준비 일정 알려줘"]

        primary = tool_names[0]
        cat = session.category or ""
        other_cats = {"studio": "드레스", "dress": "메이크업", "makeup": "스튜디오", "hall": "스튜디오"}
        other = other_cats.get(cat, "스튜디오")

        suggestions_map = {
            "search": [
                "이 중에서 비교해줘",
                f"어울리는 {other} 찾아줘",
                "투어 동선 짜줘",
                "예산에 맞는지 확인해줘",
            ],
            "search_style": [
                "이 중에서 비교해줘",
                "상세 정보 알려줘",
                f"어울리는 {other} 찾아줘",
            ],
            "search_nearby": [
                "이 중에서 비교해줘",
                "투어 동선 짜줘",
                "더 가까운 곳 있어?",
            ],
            "get_detail": [
                "비슷한 업체 더 찾아줘",
                "예산에 추가해줘",
                f"어울리는 {other} 찾아줘",
                "투어 동선 짜줘",
            ],
            "compare": [
                "이 중에서 추천해줘",
                "투어 동선 짜줘",
                "더 저렴한 곳 있어?",
            ],
            "plan_tour": [
                "동선 수정해줘",
                "다른 업체 추가해줘",
                "귀가 시간도 알려줘",
            ],
            "modify_tour": [
                "이 동선으로 확정할게",
                "다른 업체로 바꿔줘",
            ],
            "knowledge_qa": [
                "다른 궁금한 점 있어",
                "업체 추천 받고 싶어",
                "예산 배분 도와줘",
            ],
            "guest_calc": [
                "웨딩홀 추천해줘",
                "예산 배분 도와줘",
                "체크리스트 만들어줘",
            ],
            "get_timeline": [
                "체크리스트 만들어줘",
                "지금 뭐 해야 돼?",
                "업체 추천 받고 싶어",
            ],
            "get_checklist": [
                "결혼 준비 일정 알려줘",
                "업체 추천 받고 싶어",
                "예산 현황 보여줘",
            ],
            "suggest_budget": [
                "숨은 비용 뭐가 있어?",
                "업체 추천 받고 싶어",
                "예산 현황 보여줘",
            ],
            "get_budget_summary": [
                "예산 배분 다시 해줘",
                "업체 추천 받고 싶어",
            ],
        }

        result = suggestions_map.get(primary, ["웨딩홀 추천해줘", "스튜디오 찾아줘"])
        # 첫 번째 vendor 이름이 있으면 상세 조회 제안 추가
        if vendors and primary in ("search", "search_nearby", "search_style"):
            result = [f"{vendors[0]} 상세 알려줘"] + result[:3]
        return result[:4]

    @staticmethod
    def _map_category(cat) -> str:
        return {"studio": "studio", "dress": "dress", "makeup": "makeup",
                "hall": "venue"}.get(str(cat), "studio")
