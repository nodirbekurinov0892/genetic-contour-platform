"""Tests for production-safe public URL resolution."""

from app.config import Settings
from app.services.storage.storage_service import StorageService
from app.utils.media_urls import resolve_public_url
from app.utils.public_url_safety import is_stale_public_url


def _s3_settings(**overrides) -> Settings:
    base = {
        "database_url": "postgresql://u:p@localhost/db",
        "secret_key": "test-secret-key-32chars-minimum!!",
        "jwt_secret": "test-jwt-secret-32chars-minimum!!!",
        "storage_backend": "s3",
        "s3_bucket_name": "bucket",
        "s3_access_key_id": "key",
        "s3_secret_access_key": "secret",
        "s3_public_base_url": "https://cdn.example.com",
        "api_public_url": "https://api.example.com",
        "api_debug": True,
    }
    base.update(overrides)
    return Settings(**base)


def test_stale_localhost_url_detected():
    settings = _s3_settings()
    assert is_stale_public_url("http://localhost:8000/static/uploads/x.png", settings)


def test_fresh_s3_url_not_stale():
    settings = _s3_settings()
    assert not is_stale_public_url("https://cdn.example.com/uploads/x.png", settings)


def test_resolve_public_url_regenerates_from_storage_key():
    settings = _s3_settings()
    storage = StorageService(settings)
    url = resolve_public_url(
        storage=storage,
        settings=settings,
        storage_key="uploads/abc.png",
        public_url="http://localhost:8000/static/uploads/abc.png",
    )
    assert url == "https://cdn.example.com/uploads/abc.png"
