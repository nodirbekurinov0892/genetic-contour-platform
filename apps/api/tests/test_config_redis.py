"""REDIS_URL validation at startup."""

import pytest

from app.config import Settings, get_settings


def _base_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@localhost:5432/db")
    monkeypatch.setenv("SECRET_KEY", "prod-secret-key-with-enough-entropy-64chars!!")
    monkeypatch.setenv("JWT_SECRET", "prod-jwt-secret-with-enough-entropy-64chars!!!")
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    get_settings.cache_clear()


def test_redis_url_required_when_celery_backend(monkeypatch: pytest.MonkeyPatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("API_DEBUG", "true")
    monkeypatch.setenv("EXPERIMENT_QUEUE_BACKEND", "celery")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "false")
    monkeypatch.setenv("REDIS_URL", "")

    with pytest.raises(ValueError, match="REDIS_URL"):
        Settings()


def test_redis_url_required_in_production_with_celery(monkeypatch: pytest.MonkeyPatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("API_DEBUG", "false")
    monkeypatch.setenv("EXPERIMENT_QUEUE_BACKEND", "celery")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "false")
    monkeypatch.setenv("REDIS_URL", "")

    with pytest.raises(ValueError, match="REDIS_URL"):
        Settings()


def test_invalid_redis_url_scheme_rejected(monkeypatch: pytest.MonkeyPatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("API_DEBUG", "true")
    monkeypatch.setenv("EXPERIMENT_QUEUE_BACKEND", "celery")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "false")
    monkeypatch.setenv("REDIS_URL", "http://localhost:6379")

    with pytest.raises(ValueError, match="redis://"):
        Settings()


def test_asyncio_backend_allows_empty_redis_url(monkeypatch: pytest.MonkeyPatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("API_DEBUG", "true")
    monkeypatch.setenv("EXPERIMENT_QUEUE_BACKEND", "asyncio")
    monkeypatch.setenv("REDIS_URL", "")

    settings = Settings()
    assert settings.experiment_queue_backend == "asyncio"
    assert settings.uses_celery_queue is False


def test_eager_mode_allows_empty_redis_url(monkeypatch: pytest.MonkeyPatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("API_DEBUG", "true")
    monkeypatch.setenv("EXPERIMENT_QUEUE_BACKEND", "celery")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "true")
    monkeypatch.setenv("REDIS_URL", "")

    settings = Settings()
    assert settings.celery_task_always_eager is True
