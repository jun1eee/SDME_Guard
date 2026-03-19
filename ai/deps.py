"""FastAPI 의존성 주입 (DI)"""
from fastapi import Request

from session_store import InMemorySessionStore


def get_session_store(request: Request) -> InMemorySessionStore:
    return request.app.state.session_store


def get_sdm_service(request: Request):
    return request.app.state.sdm_service


def get_hall_service(request: Request):
    return request.app.state.hall_service
