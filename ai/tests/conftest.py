"""
Shared pytest fixtures for the Wedding AI FastAPI project.

Provides:
- FastAPI TestClient with mocked dependencies (Neo4j, OpenAI, MySQL)
- Isolated app instance that skips real lifespan (no DB connections needed)
"""
import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

# Ensure the ai/ package root is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


# ---------------------------------------------------------------------------
# Mock objects
# ---------------------------------------------------------------------------

class FakeSessionStore:
    """In-memory session store stub for tests."""

    def __init__(self):
        self._sessions: dict = {}

    def get(self, session_id: str):
        return self._sessions.get(session_id)

    def set(self, session_id: str, data):
        self._sessions[session_id] = data

    def delete(self, session_id: str):
        self._sessions.pop(session_id, None)


class FakeSdmService:
    """Stub for SdmChatService."""

    async def handle(self, *args, **kwargs):
        return {
            "answer": "test answer",
            "route_used": "test",
            "vendors": [],
            "recommendations": [],
            "suggestions": [],
        }


class FakeHallService:
    """Stub for HallChatService."""

    async def handle(self, *args, **kwargs):
        return {
            "answer": "test answer",
            "route_used": "test",
            "vendors": [],
            "recommendations": [],
            "suggestions": [],
        }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_settings():
    """Return a Settings-like object with safe defaults (no real credentials)."""
    from config import Settings

    return Settings(
        neo4j_uri="bolt://localhost:7687",
        neo4j_user="neo4j",
        neo4j_pw="test",
        openai_api_key="sk-test-fake-key",
        mysql_host="localhost",
        mysql_user="test",
        mysql_password="test",
        mysql_db="test_db",
        cors_origins="*",
    )


@pytest.fixture()
def app(mock_settings) -> FastAPI:
    """
    Create a FastAPI app instance with mocked state.

    This bypasses the real lifespan (which connects to Neo4j/MySQL/OpenAI)
    and injects fake services instead.
    """
    from main import app as real_app

    # Attach mocked state so DI functions in deps.py work
    real_app.state.settings = mock_settings
    real_app.state.session_store = FakeSessionStore()
    real_app.state.sdm_service = FakeSdmService()
    real_app.state.hall_service = FakeHallService()

    return real_app


@pytest.fixture()
def client(app: FastAPI) -> TestClient:
    """Synchronous TestClient for simple endpoint tests."""
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture()
async def async_client(app: FastAPI) -> AsyncClient:
    """Async HTTPX client for async endpoint tests."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Utility mock fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_neo4j_driver():
    """Mock Neo4j driver — prevents real DB connections in unit tests."""
    driver = MagicMock()
    driver.verify_connectivity = MagicMock(return_value=None)
    session = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)
    return driver


@pytest.fixture()
def mock_openai_client():
    """Mock OpenAI client — prevents real API calls in unit tests."""
    client = MagicMock()
    # Chat completion mock
    completion = MagicMock()
    completion.choices = [MagicMock()]
    completion.choices[0].message.content = "mocked LLM response"
    completion.choices[0].message.tool_calls = None
    client.chat.completions.create = MagicMock(return_value=completion)
    return client
