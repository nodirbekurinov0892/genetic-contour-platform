import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    response = await client.post(
        "/api/auth/register",
        json={
            "email": "researcher@example.com",
            "password": "securepass123",
            "name": "Researcher",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login(client: AsyncClient):
    await client.post(
        "/api/auth/register",
        json={"email": "login@example.com", "password": "securepass123"},
    )

    response = await client.post(
        "/api/auth/login",
        json={"email": "login@example.com", "password": "securepass123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["access_token"]
    assert data["refresh_token"]


@pytest.mark.asyncio
async def test_me(client: AsyncClient):
    register = await client.post(
        "/api/auth/register",
        json={"email": "me@example.com", "password": "securepass123", "name": "Me User"},
    )
    token = register.json()["access_token"]

    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@example.com"
    assert data["name"] == "Me User"
    assert data["role"] == "user"
    assert data["is_active"] is True
