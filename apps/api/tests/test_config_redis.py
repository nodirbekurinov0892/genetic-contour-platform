"""REDIS_URL validation at startup."""

import pytest

from app.config import Settings, get_settings


def _base_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@localhost:5432/db")
    monkeypatch.setenv("SECRET_KEY", "prod-secret-key-with-enough-entropy-64chars!!")
    monkeypatch.setenv("JWT_SECRET", "prod-jwt-secret-with-enough-entropy-64chars!!!")
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    get_settings.cache_clear()


def test_redis_url_required_when_not_eager(monkeypatch: pytest.MonkeyPatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("API_DEBUG", "true")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "false")
    monkeypatch.setenv("REDIS_URL", "")

    with pytest.raises(ValueError, match="REDIS_URL"):
        Settings()


def test_redis_url_required_in_production(monkeypatch: pytest.MonkeyPatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("API_DEBUG", "false")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "false")
    monkeypatch.setenv("REDIS_URL", "")

    with pytest.raises(ValueError, match="REDIS_URL"):
        Settings()


def test_invalid_redis_url_scheme_rejected(monkeypatch: pytest.MonkeyPatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("API_DEBUG", "true")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "false")
    monkeypatch.setenv("REDIS_URL", "http://localhost:6379")

    with pytest.raises(ValueError, match="redis://"):
        Settings()


def test_eager_mode_allows_empty_redis_url(monkeypatch: pytest.MonkeyPatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("API_DEBUG", "true")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "true")
    monkeypatch.setenv("REDIS_URL", "")

    settings = Settings()
    assert settings.celery_task_always_eager is True
