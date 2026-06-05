"""Worker status transition tests."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.models.experiment import Experiment, ExperimentStatus
from app.models.image import Image
from app.models.user import User
from app.services.experiment_worker import run_experiment_job


async def _create_queued_experiment(db_session, *, cancel_requested: bool = False) -> uuid.UUID:
    user = User(
        id=uuid.uuid4(),
        email="status@example.com",
        password_hash="hash",
        role="user",
    )
    image = Image(
        id=uuid.uuid4(),
        user_id=user.id,
        original_name="status.png",
        storage_key="uploads/status.png",
        public_url="http://test/static/uploads/status.png",
        width=16,
        height=16,
        size=100,
        mime_type="image/png",
    )
    experiment = Experiment(
        id=uuid.uuid4(),
        image_id=image.id,
        user_id=user.id,
        title="Status transition",
        status=ExperimentStatus.QUEUED.value,
        job_params={
            "algorithm": "sobel",
            "params": {"resize_width": 64, "blur_kernel": 5, "threshold": 0.5},
        },
        cancel_requested=cancel_requested,
    )
    db_session.add_all([user, image, experiment])
    await db_session.flush()
    return experiment.id


@pytest.mark.asyncio
async def test_cancel_requested_before_start_marks_cancelled(db_session):
    experiment_id = await _create_queued_experiment(db_session, cancel_requested=True)
    await db_session.commit()

    await run_experiment_job(experiment_id)

    result = await db_session.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = result.scalar_one()
    assert experiment.status == ExperimentStatus.CANCELLED.value


@pytest.mark.asyncio
async def test_worker_completes_after_execute_job(db_session):
    experiment_id = await _create_queued_experiment(db_session)
    await db_session.commit()

    with patch(
        "app.services.experiment_worker._execute_job",
        new_callable=AsyncMock,
    ) as mock_execute:
        mock_execute.return_value = None
        await run_experiment_job(experiment_id)

    result = await db_session.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = result.scalar_one()
    assert experiment.status == ExperimentStatus.RUNNING.value
    mock_execute.assert_awaited_once()
