import pytest
from httpx import AsyncClient


async def _register(client: AsyncClient, email: str) -> str:
    response = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "securepass123", "name": "Profile User"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.mark.asyncio
async def test_patch_profile_persists(client: AsyncClient):
    token = await _register(client, "profile-save@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    patch = await client.patch(
        "/api/auth/me",
        headers=headers,
        json={"profile": {"first_name": "Ali", "last_name": "Valiyev", "organization": "TATU"}},
    )
    assert patch.status_code == 200, patch.text
    body = patch.json()
    assert body["profile_data"]["first_name"] == "Ali"
    assert body["profile_data"]["last_name"] == "Valiyev"

    me = await client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    data = me.json()
    assert data["profile_data"]["first_name"] == "Ali"
    assert data["profile_data"]["organization"] == "TATU"


@pytest.mark.asyncio
async def test_patch_name(client: AsyncClient):
    token = await _register(client, "profile-name@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    patch = await client.patch(
        "/api/auth/me",
        headers=headers,
        json={"name": "Updated Name"},
    )
    assert patch.status_code == 200
    assert patch.json()["name"] == "Updated Name"


@pytest.mark.asyncio
async def test_change_password(client: AsyncClient):
    token = await _register(client, "profile-pass@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post(
        "/api/auth/me/password",
        headers=headers,
        json={"current_password": "securepass123", "new_password": "newsecurepass123"},
    )
    assert response.status_code == 200

    login = await client.post(
        "/api/auth/login",
        json={"email": "profile-pass@example.com", "password": "newsecurepass123"},
    )
    assert login.status_code == 200
