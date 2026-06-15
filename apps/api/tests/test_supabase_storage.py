"""Supabase storage backend unit tests (httpx mocked)."""

from unittest.mock import MagicMock, patch

import pytest

from app.config import Settings
from app.services.storage.exceptions import StorageObjectNotFoundError
from app.services.storage.storage_service import StorageService
from app.services.storage.supabase_storage import SupabaseStorageBackend


def _set_supabase_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("STORAGE_BACKEND", "supabase")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "genetic-contour-platform")


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    from app.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_supabase_backend_selected_when_configured(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/test")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-pytest-only-32chars")
    monkeypatch.setenv("JWT_SECRET", "test-jwt-secret-for-pytest-only-32chars")
    _set_supabase_env(monkeypatch)

    service = StorageService(Settings())
    assert isinstance(service.backend, SupabaseStorageBackend)


@patch("app.services.storage.supabase_storage.httpx.Client")
def test_supabase_save_bytes_posts_with_upsert(mock_client_cls, monkeypatch: pytest.MonkeyPatch):
    _set_supabase_env(monkeypatch)
    settings = Settings()
    backend = SupabaseStorageBackend(settings)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_response
    mock_client_cls.return_value = mock_client

    stored = backend.save_bytes("uploads/test.png", b"png-bytes", "image/png")

    assert stored.storage_key == "uploads/test.png"
    assert stored.public_url.startswith(
        "https://example.supabase.co/storage/v1/object/public/genetic-contour-platform/"
    )
    mock_client.post.assert_called_once()
    call_kwargs = mock_client.post.call_args.kwargs
    assert call_kwargs["params"] == {"upsert": "true"}
    assert call_kwargs["content"] == b"png-bytes"


@patch("app.services.storage.supabase_storage.httpx.Client")
def test_supabase_get_bytes_raises_not_found_on_404(mock_client_cls, monkeypatch: pytest.MonkeyPatch):
    _set_supabase_env(monkeypatch)
    backend = SupabaseStorageBackend(Settings())

    mock_response = MagicMock()
    mock_response.status_code = 404
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.get.return_value = mock_response
    mock_client_cls.return_value = mock_client

    with pytest.raises(StorageObjectNotFoundError):
        backend.get_bytes("uploads/missing.png")


@patch("app.services.storage.supabase_storage.httpx.Client")
def test_supabase_exists_uses_list_search(mock_client_cls, monkeypatch: pytest.MonkeyPatch):
    _set_supabase_env(monkeypatch)
    backend = SupabaseStorageBackend(Settings())

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [{"name": "test.png", "metadata": {"size": 10}}]
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_response
    mock_client_cls.return_value = mock_client

    assert backend.exists("uploads/test.png") is True
