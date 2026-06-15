"""Local static file serving is restricted to dev mode."""

import pytest

from app.config import Settings, get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _base_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-with-enough-length-32")
    monkeypatch.setenv("JWT_SECRET", "test-jwt-secret-with-enough-length-32")
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")


def test_local_static_enabled_in_dev(monkeypatch: pytest.MonkeyPatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("API_DEBUG", "true")
    settings = Settings()
    assert settings.use_local_static_files is True


def test_local_static_disabled_in_production(monkeypatch: pytest.MonkeyPatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("API_DEBUG", "false")
    monkeypatch.setenv("API_PUBLIC_URL", "https://api.example.com")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "true")

    with pytest.raises(ValueError, match="STORAGE_BACKEND must be 'supabase' or 's3'"):
        Settings()


def test_s3_never_uses_local_static(monkeypatch: pytest.MonkeyPatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("API_DEBUG", "true")
    monkeypatch.setenv("STORAGE_BACKEND", "s3")
    monkeypatch.setenv("S3_BUCKET_NAME", "b")
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "k")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "s")
    monkeypatch.setenv("S3_PUBLIC_BASE_URL", "https://cdn.example.com")
    settings = Settings()
    assert settings.use_local_static_files is False
