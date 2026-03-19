from pydantic import BaseModel
from typing import Optional, List


class ChatRequest(BaseModel):
    message: str
    session_id: str
    couple_id: int


class ChatResponse(BaseModel):
    success: bool = True
    answer: str
    session_id: str
    vendors: List[str] = []
    category: Optional[str] = None
    tool_used: Optional[str] = None
    elapsed_seconds: float = 0.0
    debug: Optional[dict] = None
