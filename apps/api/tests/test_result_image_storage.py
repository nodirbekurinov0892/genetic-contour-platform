"""Integration test: experiment results are stored with storage_key."""

import asyncio
import io
import uuid

import numpy as np
import pytest
from httpx import AsyncClient
from PIL import Image as PILImage
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.algorithm_run import AlgorithmRun
from app.models.experiment import Experiment
from app.models.result_image import ResultImage
from app.services.experiment_worker import _mark_completed, run_experiment_job
from app.services.storage import StorageService


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


async def _stub_sobel_execute(exp_id: uuid.UUID, settings) -> None:
    """Persist a minimal sobel artifact without running the full CV pipeline."""
    storage = StorageService(settings)
    async with AsyncSessionLocal() as session:
        experiment = (
            await session.execute(select(Experiment).where(Experiment.id == exp_id))
        ).scalar_one()
        run = AlgorithmRun(
            id=uuid.uuid4(),
            experiment_id=exp_id,
            algorithm_name="sobel",
            parameters_json={"threshold": 0.5},
            status="completed",
        )
        session.add(run)
        await session.flush()

        key = storage.result_key(str(exp_id), str(run.id), "sobel.png")
        stored = await asyncio.to_thread(
            storage.save_image_array,
            key,
            np.zeros((8, 8), dtype=np.uint8),
        )
        session.add(
            ResultImage(
                algorithm_run_id=run.id,
                type="sobel",
                storage_key=stored.storage_key,
                public_url=stored.public_url,
                file_path=stored.storage_key,
            )
        )
        await _mark_completed(session, experiment)


@pytest.mark.asyncio
async def test_sobel_results_use_storage_keys(client: AsyncClient, monkeypatch):
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
    assert run.json()["status"] == "queued"

    monkeypatch.setattr(
        "app.services.experiment_worker._execute_job",
        _stub_sobel_execute,
    )

    await asyncio.sleep(0.05)
    await asyncio.wait_for(run_experiment_job(uuid.UUID(experiment_id)), timeout=30.0)

    status_resp = await client.get(
        f"/api/experiments/{experiment_id}/status",
        headers=headers,
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "completed", status_resp.json()

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
