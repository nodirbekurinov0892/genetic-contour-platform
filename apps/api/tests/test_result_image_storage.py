"""Integration test: experiment results are stored with storage_key."""

import asyncio
import io
import time

import pytest
from httpx import AsyncClient
from PIL import Image as PILImage

from app.config import get_settings
from app.jobs import background
from app.jobs.background import schedule_experiment_run
from app.services.storage import StorageService


@pytest.fixture
def inline_worker(monkeypatch):
    """Run experiment jobs on the API event loop (asyncio backend)."""

    monkeypatch.setattr("app.jobs.queue.enqueue_experiment_run", schedule_experiment_run)
    monkeypatch.setattr(
        "app.services.experiment_service.enqueue_experiment_run",
        schedule_experiment_run,
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


async def _drain_background_tasks(timeout: float = 60.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        pending = [task for task in background._background_tasks.values() if not task.done()]
        if not pending:
            return
        await asyncio.wait(pending, timeout=min(2.0, deadline - time.monotonic()))
    raise TimeoutError("Background experiment tasks did not finish")


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

    await _drain_background_tasks()
    final_status = await _wait_for_completion(client, headers, experiment_id, timeout=5.0)
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
