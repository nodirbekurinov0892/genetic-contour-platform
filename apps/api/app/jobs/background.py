"""In-process asyncio experiment execution (no Celery worker required)."""

from __future__ import annotations

import asyncio
import logging
import uuid

logger = logging.getLogger(__name__)

_background_tasks: dict[str, asyncio.Task[None]] = {}


def schedule_experiment_run(experiment_id: uuid.UUID) -> str:
    """Schedule experiment on the current FastAPI event loop. Returns task id."""
    from app.services.experiment_worker import run_experiment_job

    task_key = str(experiment_id)
    existing = _background_tasks.get(task_key)
    if existing and not existing.done():
        logger.info("Experiment %s already has a background task", experiment_id)
        return task_key

    loop = asyncio.get_running_loop()

    async def _wrapper() -> None:
        try:
            await run_experiment_job(experiment_id)
        except asyncio.CancelledError:
            logger.info("Experiment %s background task cancelled", experiment_id)
        except Exception:
            logger.exception("Background job %s failed", experiment_id)
        finally:
            _background_tasks.pop(task_key, None)

    task = loop.create_task(_wrapper(), name=f"experiment-{experiment_id}")
    _background_tasks[task_key] = task
    logger.info("Scheduled experiment %s as background task", experiment_id)
    return task_key


def revoke_background_task(task_id: str) -> None:
    """Cancel a pending/running in-process background task."""
    task = _background_tasks.get(task_id)
    if task and not task.done():
        task.cancel()


def active_background_task_count() -> int:
    return sum(1 for task in _background_tasks.values() if not task.done())
