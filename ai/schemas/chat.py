from pydantic import BaseModel, field_validator
from typing import Optional, List


class ChatRequest(BaseModel):
    message: str
    session_id: str
    couple_id: int

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("메시지가 비어있습니다")
        return v.strip()

    @field_validator("session_id")
    @classmethod
    def session_id_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("session_id가 비어있습니다")
        return v.strip()


class ChatResponse(BaseModel):
    success: bool = True
    answer: str
    session_id: str
    vendors: List[str] = []
    category: Optional[str] = None
    tool_used: Optional[str] = None
    elapsed_seconds: float = 0.0
    debug: Optional[dict] = None
