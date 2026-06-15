"""Storage health check probes."""

import pytest

from app.config import Settings
from app.services.health_checks import check_storage


def test_local_storage_health_read_write_delete(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/test")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-pytest-only-32chars")
    monkeypatch.setenv("JWT_SECRET", "test-jwt-secret-for-pytest-only-32chars")
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    monkeypatch.setenv("API_DEBUG", "true")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("RESULTS_DIR", str(tmp_path / "results"))

    from app.config import get_settings

    get_settings.cache_clear()
    settings = Settings()
    result = check_storage(settings)

    assert result.ok is True
    assert result.metadata is not None
    assert result.metadata["backend"] == "local"
    assert result.metadata["read"] is True
    assert result.metadata["write"] is True
    assert result.metadata["delete"] is True


def test_production_local_storage_fails_health(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/test")
    monkeypatch.setenv("SECRET_KEY", "prod-secret-key-with-enough-entropy-32")
    monkeypatch.setenv("JWT_SECRET", "prod-jwt-secret-with-enough-entropy-32")
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    monkeypatch.setenv("API_DEBUG", "false")
    monkeypatch.setenv("API_PUBLIC_URL", "https://api.example.com")

    from app.config import get_settings

    get_settings.cache_clear()
    with pytest.raises(ValueError, match="STORAGE_BACKEND must be 'supabase' or 's3'"):
        Settings()
