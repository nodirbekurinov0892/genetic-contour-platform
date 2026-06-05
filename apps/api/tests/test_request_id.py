"""Request ID middleware tests."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_response_includes_request_id_header(client: AsyncClient):
    response = await client.get("/health/live")
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID")
    assert len(response.headers["X-Request-ID"]) >= 8


@pytest.mark.asyncio
async def test_client_may_supply_request_id(client: AsyncClient):
    custom_id = "test-request-id-abc123"
    response = await client.get(
        "/health/live",
        headers={"X-Request-ID": custom_id},
    )
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID") == custom_id
