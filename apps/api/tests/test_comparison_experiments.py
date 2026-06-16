"""Comparison API validation and experiment-vs-experiment behavior."""

import io
import uuid

import pytest
from httpx import AsyncClient
from PIL import Image as PILImage


def _make_test_image_bytes() -> bytes:
    img = PILImage.new("RGB", (32, 32), color=(50, 100, 150))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def _auth_headers(client: AsyncClient) -> dict[str, str]:
    reg = await client.post(
        "/api/auth/register",
        json={"email": f"compare-{uuid.uuid4().hex[:8]}@example.com", "password": "securepass123"},
    )
    token = reg.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _create_pending_experiment(client: AsyncClient, headers: dict[str, str]) -> str:
    upload = await client.post(
        "/api/images/upload",
        headers=headers,
        files={"file": ("test.png", _make_test_image_bytes(), "image/png")},
    )
    image_id = upload.json()["image"]["id"]
    create = await client.post(
        "/api/experiments",
        headers=headers,
        json={"image_id": image_id, "title": "Comparison test"},
    )
    return create.json()["id"]


@pytest.mark.asyncio
async def test_compare_same_experiment_returns_400(client: AsyncClient):
    headers = await _auth_headers(client)
    experiment_id = uuid.uuid4()

    response = await client.get(
        f"/api/comparison/experiments?experiment_a={experiment_id}&experiment_b={experiment_id}",
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Experiments must be different"


@pytest.mark.asyncio
async def test_compare_missing_experiment_returns_404(client: AsyncClient):
    headers = await _auth_headers(client)
    experiment_a = uuid.uuid4()
    experiment_b = uuid.uuid4()

    response = await client.get(
        f"/api/comparison/experiments?experiment_a={experiment_a}&experiment_b={experiment_b}",
        headers=headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Experiment not found"


@pytest.mark.asyncio
async def test_compare_different_incomplete_experiments_returns_400(client: AsyncClient):
    headers = await _auth_headers(client)
    experiment_a = await _create_pending_experiment(client, headers)
    experiment_b = await _create_pending_experiment(client, headers)

    response = await client.get(
        f"/api/comparison/experiments?experiment_a={experiment_a}&experiment_b={experiment_b}",
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Experiment must be completed"
