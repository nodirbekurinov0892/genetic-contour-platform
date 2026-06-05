"""Celery application — broker/backend: Redis."""

from celery import Celery
from celery.signals import worker_ready

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "genetic_contour",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.jobs.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    task_default_queue="experiments",
)

if settings.celery_task_always_eager:
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = True


@worker_ready.connect
def _recover_on_worker_start(**_kwargs) -> None:
    from app.jobs.recovery import run_startup_recovery

    run_startup_recovery()
