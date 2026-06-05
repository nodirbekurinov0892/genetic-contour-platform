import io

import pytest
from httpx import AsyncClient
from PIL import Image as PILImage


def _make_test_image_bytes() -> bytes:
    img = PILImage.new("RGB", (32, 32), color=(120, 80, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def _auth_and_image(client: AsyncClient) -> tuple[str, str]:
    reg = await client.post(
        "/api/auth/register",
        json={"email": "jobs@example.com", "password": "securepass123"},
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    upload = await client.post(
        "/api/images/upload",
        headers=headers,
        files={"file": ("test.png", _make_test_image_bytes(), "image/png")},
    )
    image_id = upload.json()["image"]["id"]

    create = await client.post(
        "/api/experiments",
        headers=headers,
        json={"image_id": image_id, "title": "Job test"},
    )
    experiment_id = create.json()["id"]
    return token, experiment_id


@pytest.mark.asyncio
async def test_run_returns_queued_job_immediately(client: AsyncClient):
    token, experiment_id = await _auth_and_image(client)
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post(
        f"/api/experiments/{experiment_id}/run",
        headers=headers,
        json={
            "algorithm": "sobel",
            "params": {
                "threshold": 0.5,
                "blur_kernel": 5,
                "resize_width": 64,
                "canny_low": 50,
                "canny_high": 150,
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "queued"
    assert data["job_id"] == experiment_id


@pytest.mark.asyncio
async def test_status_endpoint(client: AsyncClient):
    token, experiment_id = await _auth_and_image(client)
    headers = {"Authorization": f"Bearer {token}"}

    await client.post(
        f"/api/experiments/{experiment_id}/run",
        headers=headers,
        json={"algorithm": "sobel", "params": {}},
    )

    status = await client.get(
        f"/api/experiments/{experiment_id}/status",
        headers=headers,
    )
    assert status.status_code == 200
    body = status.json()
    assert body["job_id"] == experiment_id
    assert body["status"] in {"queued", "running", "completed", "failed"}
    assert "progress_percent" in body


@pytest.mark.asyncio
async def test_cancel_queued_experiment(client: AsyncClient):
    token, experiment_id = await _auth_and_image(client)
    headers = {"Authorization": f"Bearer {token}"}

    await client.post(
        f"/api/experiments/{experiment_id}/run",
        headers=headers,
        json={"algorithm": "genetic", "params": {}, "ga_params": {"generations": 50}},
    )

    cancel = await client.post(
        f"/api/experiments/{experiment_id}/cancel",
        headers=headers,
    )
    assert cancel.status_code == 200
    assert cancel.json()["status"] in {"cancelled", "running"}
