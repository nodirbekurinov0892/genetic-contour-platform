"""Restart recovery: reset stale running jobs and re-enqueue queued experiments."""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.config import get_settings
from app.database_sync import SyncSessionLocal
from app.jobs.queue import enqueue_experiment_run
from app.jobs.recovery_lock import acquire_recovery_lock, release_recovery_lock
from app.models.experiment import Experiment, ExperimentStatus

logger = logging.getLogger(__name__)


def reset_stale_running_jobs() -> list[uuid.UUID]:
    """Mark interrupted running jobs as queued so they can be retried."""
    requeued_ids: list[uuid.UUID] = []

    with SyncSessionLocal() as session:
        result = session.execute(
            select(Experiment).where(Experiment.status == ExperimentStatus.RUNNING.value)
        )
        stale = list(result.scalars().all())
        if not stale:
            return requeued_ids

        for experiment in stale:
            experiment.status = ExperimentStatus.QUEUED.value
            experiment.started_at = None
            experiment.progress_percent = 0.0
            experiment.current_generation = None
            experiment.error_message = None
            requeued_ids.append(experiment.id)
            logger.warning(
                "Recovered stale running experiment %s -> queued",
                experiment.id,
            )

        session.commit()

    return requeued_ids


def requeue_queued_experiments() -> int:
    """Re-enqueue all DB-queued experiments (survives API/worker restart)."""
    count = 0

    with SyncSessionLocal() as session:
        result = session.execute(
            select(Experiment).where(Experiment.status == ExperimentStatus.QUEUED.value)
        )
        queued = list(result.scalars().all())

        for experiment in queued:
            if experiment.cancel_requested:
                experiment.status = ExperimentStatus.CANCELLED.value
                experiment.finished_at = datetime.now(timezone.utc)
                continue

            task_id = enqueue_experiment_run(experiment.id)
            experiment.celery_task_id = task_id
            count += 1
            logger.info(
                "Re-enqueued experiment %s with Celery task %s",
                experiment.id,
                task_id,
            )

        session.commit()

    return count


def run_startup_recovery() -> dict[str, int | bool]:
    """Full recovery pass — worker startup only; guarded by Redis lock."""
    settings = get_settings()
    if not acquire_recovery_lock(settings):
        logger.info("Job recovery skipped — lock held by another process")
        return {
            "stale_running_reset": 0,
            "queued_re_enqueued": 0,
            "skipped": True,
        }

    try:
        stale_ids = reset_stale_running_jobs()
        requeued = requeue_queued_experiments()
        logger.info(
            "Job recovery complete: %d stale running reset, %d queued re-enqueued",
            len(stale_ids),
            requeued,
        )
        return {
            "stale_running_reset": len(stale_ids),
            "queued_re_enqueued": requeued,
            "skipped": False,
        }
    finally:
        release_recovery_lock(settings)
