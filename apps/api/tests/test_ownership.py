import io

import pytest
from httpx import AsyncClient
from PIL import Image as PILImage


def _make_test_image_bytes() -> bytes:
    img = PILImage.new("RGB", (32, 32), color=(120, 80, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def _register_and_token(client: AsyncClient, email: str) -> str:
    response = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "securepass123"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.mark.asyncio
async def test_experiment_ownership_isolation(client: AsyncClient):
    owner_token = await _register_and_token(client, "owner@example.com")
    other_token = await _register_and_token(client, "other@example.com")

    upload = await client.post(
        "/api/images/upload",
        headers={"Authorization": f"Bearer {owner_token}"},
        files={"file": ("test.png", _make_test_image_bytes(), "image/png")},
    )
    assert upload.status_code == 200
    image_id = upload.json()["image"]["id"]

    create_exp = await client.post(
        "/api/experiments",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"image_id": image_id, "title": "Owner experiment"},
    )
    assert create_exp.status_code == 200
    experiment_id = create_exp.json()["id"]

    owner_list = await client.get(
        "/api/experiments",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert owner_list.status_code == 200
    assert len(owner_list.json()) == 1

    other_list = await client.get(
        "/api/experiments",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert other_list.status_code == 200
    assert len(other_list.json()) == 0

    forbidden = await client.get(
        f"/api/experiments/{experiment_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_unauthenticated_access_forbidden(client: AsyncClient):
    response = await client.get("/api/experiments")
    assert response.status_code == 401
