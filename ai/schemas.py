from typing import Any

from pydantic import BaseModel, Field


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


class RecommendationCard(BaseModel):
    id: str
    source: str
    category: str
    title: str
    subtitle: str | None = None
    description: str | None = None
    price_label: str | None = None
    rating: float | None = None
    review_count: int | None = None
    address: str | None = None
    image_url: str | None = None
    link_url: str | None = None
    tags: list[str] = Field(default_factory=list)


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
