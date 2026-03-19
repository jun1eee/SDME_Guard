"""스드메 챗봇 서비스 - pipeline에 도메인 프롬프트/tool 전달"""
from chat.pipeline import run_pipeline
from sdm.prompts import SYSTEM_PROMPT, TOOLS_SCHEMA
from sdm.tools import TOOL_MAP


async def process_message(message: str, session: dict, couple_id: int) -> dict:
    """스드메 챗봇 메시지 처리"""
    return await run_pipeline(
        message=message,
        session=session,
        system_prompt=SYSTEM_PROMPT,
        tools_schema=TOOLS_SCHEMA,
        tool_map=TOOL_MAP,
        couple_id=couple_id,
    )
