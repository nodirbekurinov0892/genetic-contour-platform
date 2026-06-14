"""Recovery lock prevents duplicate re-enqueue when recovery runs twice."""

from unittest.mock import MagicMock, patch

import pytest

from app.config import get_settings
from app.jobs.recovery import run_startup_recovery


class _FakeRedisClient:
    def __init__(self):
        self._keys: dict[str, str] = {}

    def set(self, key, value, nx=False, ex=None):
        if nx and key in self._keys:
            return False
        self._keys[key] = value
        return True

    def delete(self, key):
        self._keys.pop(key, None)


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_recovery_second_call_skipped_with_redis_lock(monkeypatch):
    fake_client = _FakeRedisClient()
    monkeypatch.setenv("EXPERIMENT_QUEUE_BACKEND", "celery")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "false")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    get_settings.cache_clear()

    mock_requeue = MagicMock(return_value=0)

    with patch("app.jobs.recovery_lock.redis.from_url", return_value=fake_client):
        with patch("app.jobs.recovery.reset_stale_running_jobs", return_value=[]):
            with patch("app.jobs.recovery.requeue_queued_experiments", mock_requeue):
                with patch("app.jobs.recovery.release_recovery_lock", lambda _settings: None):
                    first = run_startup_recovery()
                    second = run_startup_recovery()

    assert first.get("skipped") is False
    assert second.get("skipped") is True
    assert mock_requeue.call_count == 1
