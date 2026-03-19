from dataclasses import dataclass, field
from threading import Lock
from typing import Any
from uuid import uuid4


@dataclass
class SessionState:
    session_id: str
    category: str | None = None
    vendors: list[str] = field(default_factory=list)
    last_mentioned: list[str] = field(default_factory=list)
    vendor_history: dict[str, list[str]] = field(default_factory=dict)
    turn: int = 0
    history: list[dict[str, str]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


class InMemorySessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}
        self._lock = Lock()

    def get_or_create(self, session_id: str | None = None) -> SessionState:
        target_id = session_id or str(uuid4())
        with self._lock:
            if target_id not in self._sessions:
                self._sessions[target_id] = SessionState(session_id=target_id)
            return self._sessions[target_id]

    def append_history(self, session_id: str, role: str, content: str) -> None:
        session = self.get_or_create(session_id)
        with self._lock:
            session.history.append({"role": role, "content": content})

    def clear(self, session_id: str) -> None:
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
