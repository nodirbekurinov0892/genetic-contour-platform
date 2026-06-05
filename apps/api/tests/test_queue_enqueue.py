"""Tests for Celery enqueue integration."""

import io
import uuid

import pytest
from httpx import AsyncClient
from PIL import Image as PILImage
from sqlalchemy import select

from app.models.experiment import Experiment, ExperimentStatus


def _make_test_image_bytes() -> bytes:
    img = PILImage.new("RGB", (16, 16), color=(1, 2, 3))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_enqueue_stores_celery_task_id(client: AsyncClient, db_session):
    reg = await client.post(
        "/api/auth/register",
        json={"email": "enqueue@example.com", "password": "securepass123"},
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    upload = await client.post(
        "/api/images/upload",
        headers=headers,
        files={"file": ("t.png", _make_test_image_bytes(), "image/png")},
    )
    image_id = upload.json()["image"]["id"]

    create = await client.post(
        "/api/experiments",
        headers=headers,
        json={"image_id": image_id, "title": "Enqueue test"},
    )
    experiment_id = uuid.UUID(create.json()["id"])

    response = await client.post(
        f"/api/experiments/{experiment_id}/run",
        headers=headers,
        json={"algorithm": "sobel", "params": {"resize_width": 64}},
    )
    assert response.status_code == 200
    assert response.json()["status"] == ExperimentStatus.QUEUED.value

    result = await db_session.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = result.scalar_one()
    assert experiment.celery_task_id == f"test-task-{experiment_id}"
    assert experiment.cancel_requested is False
