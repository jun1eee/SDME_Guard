"""스드메 챗봇 라우터"""
from fastapi import APIRouter

from schemas.chat import ChatRequest, ChatResponse
from session_store import get_session, reset_session
from sdm.service import process_message

router = APIRouter(tags=["sdm"])


@router.post("/sdm", response_model=ChatResponse)
async def chat_sdm(req: ChatRequest):
    session = get_session(req.session_id)
    result = await process_message(req.message, session, req.couple_id)
    return ChatResponse(session_id=req.session_id, **result)


@router.post("/sdm/reset")
async def reset_sdm_session(req: dict):
    session_id = req.get("session_id", "")
    reset_session(session_id)
    return {"success": True, "session_id": session_id}
