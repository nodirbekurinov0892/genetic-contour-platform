"""Celery task definitions."""

import asyncio
import logging
import uuid

from app.jobs.celery_app import celery_app
from app.services.experiment_worker import run_experiment_job

logger = logging.getLogger(__name__)


@celery_app.task(
    name="experiment.run",
    bind=True,
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
)
def run_experiment_task(self, experiment_id: str) -> None:
    """Execute one experiment job. Wraps the async worker with asyncio.run."""
    logger.info("Celery task %s started for experiment %s", self.request.id, experiment_id)
    asyncio.run(run_experiment_job(uuid.UUID(experiment_id)))
