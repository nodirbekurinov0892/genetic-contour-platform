"""Restart recovery logic tests (sync DB, no Celery broker)."""

import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from app.config import get_settings
from app.database_sync import SyncSessionLocal
from app.jobs.recovery import requeue_queued_experiments, reset_stale_running_jobs, run_startup_recovery
from app.models.experiment import Experiment, ExperimentStatus
from app.models.image import Image
from app.models.user import User


def _seed_experiment(status: str, *, cancel_requested: bool = False) -> uuid.UUID:
    experiment_id = uuid.uuid4()
    user_id = uuid.uuid4()
    image_id = uuid.uuid4()

    with SyncSessionLocal() as session:
        session.add(
            User(
                id=user_id,
                email=f"{experiment_id}@recovery.test",
                password_hash="hash",
                role="user",
            )
        )
        session.add(
            Image(
                id=image_id,
                user_id=user_id,
                original_name="seed.png",
                storage_key=f"uploads/{image_id}.png",
                public_url="http://test/static/uploads/seed.png",
                width=8,
                height=8,
                size=64,
                mime_type="image/png",
            )
        )
        session.add(
            Experiment(
                id=experiment_id,
                image_id=image_id,
                user_id=user_id,
                title="Recovery test",
                status=status,
                job_params={"algorithm": "sobel", "params": {}},
                cancel_requested=cancel_requested,
                progress_percent=42.0,
                current_generation=3,
                started_at=datetime.now(timezone.utc) if status == "running" else None,
            )
        )
        session.commit()

    return experiment_id


@pytest.fixture(autouse=True)
def _recovery_test_env(monkeypatch):
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "true")
    get_settings.cache_clear()
    monkeypatch.setattr(
        "app.jobs.recovery.enqueue_experiment_run",
        lambda experiment_id: f"recovery-task-{experiment_id}",
    )
    yield
    get_settings.cache_clear()


def test_reset_stale_running_jobs_marks_queued():
    experiment_id = _seed_experiment(ExperimentStatus.RUNNING.value)

    reset_ids = reset_stale_running_jobs()
    assert experiment_id in reset_ids

    with SyncSessionLocal() as session:
        experiment = session.get(Experiment, experiment_id)
        assert experiment.status == ExperimentStatus.QUEUED.value
        assert experiment.progress_percent == 0.0
        assert experiment.current_generation is None
        assert experiment.started_at is None


def test_requeue_queued_experiments_assigns_task_id():
    experiment_id = _seed_experiment(ExperimentStatus.QUEUED.value)

    count = requeue_queued_experiments()
    assert count == 1

    with SyncSessionLocal() as session:
        experiment = session.get(Experiment, experiment_id)
        assert experiment.celery_task_id == f"recovery-task-{experiment_id}"


def test_requeue_skips_cancel_requested():
    experiment_id = _seed_experiment(
        ExperimentStatus.QUEUED.value,
        cancel_requested=True,
    )

    count = requeue_queued_experiments()
    assert count == 0

    with SyncSessionLocal() as session:
        experiment = session.get(Experiment, experiment_id)
        assert experiment.status == ExperimentStatus.CANCELLED.value
        assert experiment.finished_at is not None


def test_run_startup_recovery_combines_reset_and_requeue():
    running_id = _seed_experiment(ExperimentStatus.RUNNING.value)

    with patch("app.jobs.recovery.requeue_queued_experiments", return_value=2) as mock_requeue:
        stats = run_startup_recovery()

    assert stats["stale_running_reset"] == 1
    assert stats["queued_re_enqueued"] == 2
    mock_requeue.assert_called_once()

    with SyncSessionLocal() as session:
        experiment = session.get(Experiment, running_id)
        assert experiment.status == ExperimentStatus.QUEUED.value
