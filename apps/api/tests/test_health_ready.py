"""Readiness and liveness health endpoint tests."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.services.health_checks import HealthCheckResult


@pytest.mark.asyncio
async def test_health_live_returns_ok(client: AsyncClient):
    response = await client.get("/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_health_ready_all_checks_ok(client: AsyncClient):
    checks = [
        HealthCheckResult("postgresql", True, "connected"),
        HealthCheckResult("redis", True, "connected"),
        HealthCheckResult("storage", True, "local directories writable"),
    ]
    with patch(
        "app.routes.health.run_readiness_checks",
        new=AsyncMock(return_value=checks),
    ):
        response = await client.get("/health/ready")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["checks"]["postgresql"]["ok"] is True
    assert body["checks"]["redis"]["ok"] is True
    assert body["checks"]["storage"]["ok"] is True


@pytest.mark.asyncio
async def test_health_ready_returns_503_when_degraded(client: AsyncClient):
    checks = [
        HealthCheckResult("postgresql", True, "connected"),
        HealthCheckResult("redis", False, "connection refused"),
        HealthCheckResult("storage", True, "ok"),
    ]
    with patch(
        "app.routes.health.run_readiness_checks",
        new=AsyncMock(return_value=checks),
    ):
        response = await client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["status"] == "degraded"
    assert response.json()["checks"]["redis"]["ok"] is False
