"""Production configuration validation tests."""

import pytest

from app.config import Settings, get_settings


def _set_required_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/genetic_contour")
    monkeypatch.setenv("SECRET_KEY", "prod-secret-key-with-enough-entropy-32")
    monkeypatch.setenv("JWT_SECRET", "prod-jwt-secret-with-enough-entropy-32")
    monkeypatch.setenv("STORAGE_BACKEND", "s3")
    monkeypatch.setenv("S3_BUCKET_NAME", "test-bucket")
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "test-key")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "test-secret")
    monkeypatch.setenv("S3_PUBLIC_BASE_URL", "https://cdn.example.com")
    monkeypatch.setenv("API_DEBUG", "false")
    monkeypatch.setenv("API_PUBLIC_URL", "https://api.example.com")


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_redis_url_required_when_celery_backend(monkeypatch: pytest.MonkeyPatch):
    _set_required_env(monkeypatch)
    monkeypatch.setenv("EXPERIMENT_QUEUE_BACKEND", "celery")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "false")
    monkeypatch.setenv("REDIS_URL", "")

    with pytest.raises(ValueError, match="REDIS_URL"):
        Settings()


def test_redis_url_must_use_redis_scheme(monkeypatch: pytest.MonkeyPatch):
    _set_required_env(monkeypatch)
    monkeypatch.setenv("EXPERIMENT_QUEUE_BACKEND", "celery")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "false")
    monkeypatch.setenv("REDIS_URL", "http://localhost:6379")

    with pytest.raises(ValueError, match="REDIS_URL must start with redis://"):
        Settings()


def test_asyncio_backend_allows_empty_redis_in_production(monkeypatch: pytest.MonkeyPatch):
    _set_required_env(monkeypatch)
    monkeypatch.setenv("EXPERIMENT_QUEUE_BACKEND", "asyncio")
    monkeypatch.setenv("REDIS_URL", "")

    settings = Settings()
    assert settings.uses_celery_queue is False


def test_eager_mode_allows_empty_redis_url(monkeypatch: pytest.MonkeyPatch):
    _set_required_env(monkeypatch)
    monkeypatch.setenv("API_DEBUG", "true")
    monkeypatch.setenv("EXPERIMENT_QUEUE_BACKEND", "celery")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "true")
    monkeypatch.setenv("REDIS_URL", "")

    settings = Settings()
    assert settings.celery_task_always_eager is True


def test_local_storage_rejected_in_production(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/genetic_contour")
    monkeypatch.setenv("SECRET_KEY", "prod-secret-key-with-enough-entropy-32")
    monkeypatch.setenv("JWT_SECRET", "prod-jwt-secret-with-enough-entropy-32")
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    monkeypatch.setenv("API_DEBUG", "false")
    monkeypatch.setenv("API_PUBLIC_URL", "https://api.example.com")

    with pytest.raises(ValueError, match="STORAGE_BACKEND must be 'supabase' or 's3'"):
        Settings()


def test_supabase_storage_required_fields_in_production(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/genetic_contour")
    monkeypatch.setenv("SECRET_KEY", "prod-secret-key-with-enough-entropy-32")
    monkeypatch.setenv("JWT_SECRET", "prod-jwt-secret-with-enough-entropy-32")
    monkeypatch.setenv("STORAGE_BACKEND", "supabase")
    monkeypatch.setenv("API_DEBUG", "false")
    monkeypatch.setenv("API_PUBLIC_URL", "https://api.example.com")

    with pytest.raises(ValueError, match="SUPABASE_URL"):
        Settings()


def test_supabase_storage_accepts_production_config(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/genetic_contour")
    monkeypatch.setenv("SECRET_KEY", "prod-secret-key-with-enough-entropy-32")
    monkeypatch.setenv("JWT_SECRET", "prod-jwt-secret-with-enough-entropy-32")
    monkeypatch.setenv("STORAGE_BACKEND", "supabase")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "genetic-contour-platform")
    monkeypatch.setenv("API_DEBUG", "false")
    monkeypatch.setenv("API_PUBLIC_URL", "https://api.example.com")

    settings = Settings()
    assert settings.storage_backend == "supabase"
    assert settings.resolved_supabase_public_base_url.endswith("/genetic-contour-platform")
