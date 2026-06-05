"""Storage service backend selection and key generation tests."""

from unittest.mock import MagicMock, patch

import pytest

from app.config import get_settings
from app.services.storage.local_storage import LocalStorageBackend
from app.services.storage.s3_storage import S3StorageBackend
from app.services.storage.storage_service import StorageService


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _set_s3_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("STORAGE_BACKEND", "s3")
    monkeypatch.setenv("S3_BUCKET_NAME", "test-bucket")
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "test-key")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "test-secret")
    monkeypatch.setenv("S3_PUBLIC_BASE_URL", "https://cdn.example.com/bucket")
    monkeypatch.setenv("S3_ENDPOINT_URL", "https://account.r2.cloudflarestorage.com")
    monkeypatch.setenv("S3_REGION", "auto")
    get_settings.cache_clear()


def test_local_backend_selected_by_default(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    get_settings.cache_clear()
    service = StorageService(get_settings())
    assert isinstance(service.backend, LocalStorageBackend)
    assert service.is_local is True


@patch("app.services.storage.s3_storage.boto3.client")
def test_s3_backend_selected_when_configured(
    mock_boto_client: MagicMock, monkeypatch: pytest.MonkeyPatch
):
    """S3 client is mocked — no real AWS/R2 calls."""
    mock_boto_client.return_value = MagicMock()
    _set_s3_env(monkeypatch)

    service = StorageService(get_settings())
    assert isinstance(service.backend, S3StorageBackend)
    assert service.is_local is False
    mock_boto_client.assert_called_once()


def test_upload_key_is_server_generated_uuid(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    get_settings.cache_clear()
    service = StorageService(get_settings())
    key1 = service.upload_key(".png")
    key2 = service.upload_key(".png")

    assert key1.startswith("uploads/")
    assert key1.endswith(".png")
    assert key1 != key2


def test_result_key_rejects_path_traversal(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    get_settings.cache_clear()
    service = StorageService(get_settings())

    with pytest.raises(ValueError):
        service.result_key("exp", "run", "../evil.png")


@patch("app.services.storage.s3_storage.boto3.client")
def test_s3_save_bytes_uses_boto3_put_object(
    mock_boto_client: MagicMock, monkeypatch: pytest.MonkeyPatch
):
    """S3 I/O is fully mocked via unittest.mock — not moto, not real S3."""
    client = MagicMock()
    mock_boto_client.return_value = client
    _set_s3_env(monkeypatch)
    monkeypatch.setenv("S3_PUBLIC_BASE_URL", "https://pub.example.com")
    get_settings.cache_clear()

    service = StorageService(get_settings())
    stored = service.save_bytes("uploads/file.png", b"data", "image/png")

    client.put_object.assert_called_once_with(
        Bucket="test-bucket",
        Key="uploads/file.png",
        Body=b"data",
        ContentType="image/png",
    )
    assert stored.public_url == "https://pub.example.com/uploads/file.png"
