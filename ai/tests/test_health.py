"""
Smoke tests for the /healthz endpoint.

These verify that the FastAPI app boots and responds correctly
without requiring any external services (Neo4j, OpenAI, MySQL).
"""


def test_healthz_returns_200(client):
    """GET /healthz should return 200 with status ok."""
    response = client.get("/healthz")
    assert response.status_code == 200

    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "ok"
    assert body["data"]["message"] == "service is running"


def test_healthz_response_shape(client):
    """Verify the response matches the ApiResponse schema."""
    response = client.get("/healthz")
    body = response.json()

    # Top-level keys
    assert "success" in body
    assert "data" in body

    # Data payload keys
    data = body["data"]
    assert "status" in data
    assert "message" in data


async def test_healthz_async(async_client):
    """Same health check via async client."""
    response = await async_client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "ok"
