import time
from config import settings

_sessions: dict[str, dict] = {}


def get_session(session_id: str) -> dict:
    """session_id에 해당하는 세션 반환. 없으면 새로 생성."""
    if session_id not in _sessions:
        _sessions[session_id] = {
            "category": None,
            "vendors": [],
            "last_mentioned": [],
            "vendor_history": {},
            "chat_history": [],
            "turn": 0,
            "created_at": time.time(),
        }
    return _sessions[session_id]


def reset_session(session_id: str):
    """세션 초기화"""
    _sessions.pop(session_id, None)


def cleanup_old_sessions():
    """만료된 세션 정리"""
    now = time.time()
    max_age = settings.session_max_age_hours * 3600
    expired = [sid for sid, s in _sessions.items() if now - s["created_at"] > max_age]
    for sid in expired:
        del _sessions[sid]
    if expired:
        print(f"만료 세션 {len(expired)}개 정리")
