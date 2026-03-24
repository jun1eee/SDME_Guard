from typing import Any, List, Optional

from pydantic import BaseModel, Field, field_validator


# ── 요청 ──

class ChatContext(BaseModel):
    page: str | None = None
    user_id: int | None = None
    couple_id: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ChatRequest(BaseModel):
    session_id: str | None = None
    message: str
    context: ChatContext | None = None
    debug: bool = False

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("메시지가 비어있습니다")
        return v.strip()


# ── 응답 ──

class RecommendationCard(BaseModel):
    """AI 추천 결과 — ID + 요약만. 상세 데이터는 백엔드가 MySQL에서 조회."""
    id: str                          # 업체/홀 ID (partnerId)
    source: str                      # "sdm" | "hall"
    category: str                    # "studio" | "dress" | "makeup" | "venue"
    title: str                       # 업체/홀 이름
    reason: str | None = None        # 추천 사유 (태그, 특징 요약)
    address: str | None = None       # 위치/주소


class ChatPayload(BaseModel):
    session_id: str
    answer: str
    route_used: str
    trace_id: str
    vendors: list[str] = Field(default_factory=list)
    recommendations: list[RecommendationCard] = Field(default_factory=list)
    debug_log: str | None = None


class HealthPayload(BaseModel):
    status: str
    message: str


class ApiResponse(BaseModel):
    success: bool = True
    data: ChatPayload | HealthPayload | dict[str, Any]
