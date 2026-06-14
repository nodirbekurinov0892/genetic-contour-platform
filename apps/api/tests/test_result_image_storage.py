"""Integration test: experiment results are stored with storage_key."""

import asyncio
import io
import time
import uuid

import pytest
from httpx import AsyncClient
from PIL import Image as PILImage

from app.config import get_settings
from app.services.experiment_worker import run_experiment_job
from app.services.storage import StorageService


@pytest.fixture
def inline_worker(monkeypatch):
    """Defer worker until after request commit; poll /status for completion."""

    def inline_enqueue(experiment_id: uuid.UUID):
        async def _run():
            await asyncio.sleep(0)
            await run_experiment_job(experiment_id)

        asyncio.get_running_loop().create_task(
            _run(),
            name=f"inline-worker-{experiment_id}",
        )
        return str(experiment_id)

    monkeypatch.setattr("app.jobs.queue.enqueue_experiment_run", inline_enqueue)
    monkeypatch.setattr(
        "app.services.experiment_service.enqueue_experiment_run",
        inline_enqueue,
    )


def _make_test_image_bytes() -> bytes:
    img = PILImage.new("RGB", (32, 32), color=(50, 100, 150))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def _register_upload_experiment(client: AsyncClient) -> tuple[dict, str]:
    reg = await client.post(
        "/api/auth/register",
        json={"email": "storage-results@example.com", "password": "securepass123"},
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
        json={"image_id": image_id, "title": "Storage result test"},
    )
    experiment_id = create.json()["id"]
    return headers, experiment_id


async def _wait_for_completion(
    client: AsyncClient, headers: dict, experiment_id: str, timeout: float = 30.0
) -> str:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status = await client.get(
            f"/api/experiments/{experiment_id}/status",
            headers=headers,
        )
        body = status.json()
        if body["status"] in {"completed", "failed", "cancelled"}:
            return body["status"]
        await asyncio.sleep(0.25)
    raise TimeoutError("Experiment did not finish in time")


@pytest.mark.asyncio
async def test_sobel_results_use_storage_keys(client: AsyncClient, inline_worker):
    headers, experiment_id = await _register_upload_experiment(client)

    run = await client.post(
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
    assert run.status_code == 200

    final_status = await _wait_for_completion(client, headers, experiment_id, timeout=30.0)
    assert final_status == "completed"

    results = await client.get(
        f"/api/experiments/{experiment_id}/results",
        headers=headers,
    )
    assert results.status_code == 200
    runs = results.json()["algorithm_runs"]

    sobel_run = next(r for r in runs if r["algorithm_name"] == "sobel")
    assert sobel_run["result_images"]

    storage = StorageService(get_settings())
    for result_image in sobel_run["result_images"]:
        assert result_image["storage_key"].startswith(f"results/{experiment_id}/")
        assert result_image["url"]
        assert storage.exists(result_image["storage_key"])
