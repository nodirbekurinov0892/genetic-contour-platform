"""Enqueue and revoke experiment jobs."""

import uuid

from app.config import get_settings
from app.jobs.background import revoke_background_task, schedule_experiment_run


def enqueue_experiment_run(experiment_id: uuid.UUID) -> str:
    """Push experiment to the configured queue backend. Returns task id."""
    settings = get_settings()
    if settings.uses_celery_queue:
        from app.jobs.tasks import run_experiment_task

        result = run_experiment_task.delay(str(experiment_id))
        return result.id

    return schedule_experiment_run(experiment_id)


def revoke_experiment_task(task_id: str) -> None:
    """Revoke/cancel a queued or running experiment task."""
    settings = get_settings()
    if settings.uses_celery_queue:
        from app.jobs.celery_app import celery_app

        celery_app.control.revoke(task_id, terminate=False)
        return

    revoke_background_task(task_id)
