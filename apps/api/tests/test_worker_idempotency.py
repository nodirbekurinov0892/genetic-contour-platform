"""Worker idempotency: duplicate Celery tasks must not run the same job twice."""

import asyncio
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.models.experiment import Experiment, ExperimentStatus
from app.models.image import Image
from app.models.user import User
from app.services.experiment_worker import run_experiment_job


async def _create_queued_experiment(db_session) -> uuid.UUID:
    user = User(
        id=uuid.uuid4(),
        email=f"idempotent-{uuid.uuid4()}@example.com",
        password_hash="hash",
        role="user",
    )
    image = Image(
        id=uuid.uuid4(),
        user_id=user.id,
        original_name="idem.png",
        storage_key="uploads/idem.png",
        public_url="http://test/static/uploads/idem.png",
        width=16,
        height=16,
        size=100,
        mime_type="image/png",
    )
    experiment = Experiment(
        id=uuid.uuid4(),
        image_id=image.id,
        user_id=user.id,
        title="Idempotency test",
        status=ExperimentStatus.QUEUED.value,
        job_params={
            "algorithm": "sobel",
            "params": {"resize_width": 64, "blur_kernel": 5, "threshold": 0.5},
        },
    )
    db_session.add_all([user, image, experiment])
    await db_session.flush()
    experiment_id = experiment.id
    await db_session.commit()
    return experiment_id


@pytest.mark.asyncio
async def test_duplicate_tasks_only_one_claims_running(db_session):
    experiment_id = await _create_queued_experiment(db_session)

    execute_calls = 0

    async def slow_execute(*_args, **_kwargs):
        nonlocal execute_calls
        execute_calls += 1
        await asyncio.sleep(0.05)

    with patch(
        "app.services.experiment_worker._execute_job",
        new_callable=AsyncMock,
        side_effect=slow_execute,
    ):
        await asyncio.gather(
            run_experiment_job(experiment_id),
            run_experiment_job(experiment_id),
        )

    result = await db_session.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = result.scalar_one()
    assert experiment.status == ExperimentStatus.RUNNING.value
    assert execute_calls == 1
