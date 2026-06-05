"""Enqueue and revoke experiment jobs via Celery."""

import uuid

from app.jobs.celery_app import celery_app
from app.jobs.tasks import run_experiment_task


def enqueue_experiment_run(experiment_id: uuid.UUID) -> str:
    """Push experiment to Celery queue. Returns Celery task id."""
    result = run_experiment_task.delay(str(experiment_id))
    return result.id


def revoke_experiment_task(task_id: str) -> None:
    """Revoke a queued (not yet started) Celery task."""
    celery_app.control.revoke(task_id, terminate=False)
