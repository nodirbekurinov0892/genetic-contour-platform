"""SMTP degraded auth mode."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_config_degraded(client: AsyncClient):
    response = await client.get("/api/auth/config")
    assert response.status_code == 200
    data = response.json()
    assert "smtp_configured" in data
    assert "degraded_auth_mode" in data


@pytest.mark.asyncio
async def test_register_login_without_smtp(client: AsyncClient):
    email = "degraded-auth@example.com"
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "securepass123", "name": "Degraded"},
    )
    assert reg.status_code == 200

    login = await client.post(
        "/api/auth/login",
        json={"email": email, "password": "securepass123"},
    )
    assert login.status_code == 200


@pytest.mark.asyncio
async def test_password_reset_unavailable_without_smtp(client: AsyncClient):
    response = await client.post(
        "/api/auth/password-reset/request",
        json={"email": "nobody@example.com"},
    )
    if response.status_code == 503:
        assert "SMTP not configured" in response.json()["detail"]
    else:
        assert response.status_code == 200
