from fastapi import APIRouter, Depends, Request

from deps import get_hall_service
from hall.service import HallChatService
from schemas.chat import ApiResponse, ChatRequest

router = APIRouter(prefix="/api/chat", tags=["hall"])


@router.post("/hall", response_model=ApiResponse)
async def chat_hall(
    payload: ChatRequest,
    request: Request,
    service: HallChatService = Depends(get_hall_service),
):
    result = service.chat(payload, trace_id=request.state.trace_id)
    return ApiResponse(data=result)
