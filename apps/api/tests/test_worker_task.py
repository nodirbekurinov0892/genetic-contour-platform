"""Unit tests for Celery worker task wrapper."""

from unittest.mock import patch
from uuid import UUID

from app.jobs.celery_app import celery_app
from app.jobs.tasks import run_experiment_task

celery_app.conf.task_always_eager = True
celery_app.conf.task_eager_propagates = True


@patch("app.jobs.tasks.asyncio.run")
def test_run_experiment_task_calls_async_worker(mock_asyncio_run):
    experiment_id = "11111111-1111-1111-1111-111111111111"
    run_experiment_task.apply(args=[experiment_id])

    mock_asyncio_run.assert_called_once()
    passed_coro = mock_asyncio_run.call_args[0][0]

    import inspect

    assert inspect.iscoroutine(passed_coro)
    assert str(UUID(experiment_id)) in repr(passed_coro)
