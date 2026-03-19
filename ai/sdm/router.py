from fastapi import APIRouter, Depends, Request

from deps import get_sdm_service
from schemas import ApiResponse, ChatRequest
from sdm.service import SdmChatService

router = APIRouter(prefix="/api/chat", tags=["sdm"])


@router.post("/sdm", response_model=ApiResponse)
async def chat_sdm(
    payload: ChatRequest,
    request: Request,
    service: SdmChatService = Depends(get_sdm_service),
):
    result = service.chat(payload, trace_id=request.state.trace_id)
    return ApiResponse(data=result)
