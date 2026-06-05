"""Unit tests for local filesystem storage (real temp directory, no mocks)."""

from pathlib import Path

import pytest

from app.services.storage.local_storage import LocalStorageBackend


class _LocalSettings:
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.api_public_url = "http://testserver"

    @property
    def upload_path(self) -> Path:
        path = self.base_dir / "uploads"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def results_path(self) -> Path:
        path = self.base_dir / "results"
        path.mkdir(parents=True, exist_ok=True)
        return path


@pytest.fixture
def local_backend(tmp_path: Path) -> LocalStorageBackend:
    return LocalStorageBackend(_LocalSettings(tmp_path))


def test_save_and_read_bytes(local_backend: LocalStorageBackend):
    key = "uploads/abc123.png"
    data = b"png-bytes"
    stored = local_backend.save_bytes(key, data, "image/png")

    assert stored.storage_key == key
    assert stored.public_url == "http://testserver/static/uploads/abc123.png"
    assert local_backend.get_bytes(key) == data
    assert local_backend.exists(key)


def test_delete_file(local_backend: LocalStorageBackend):
    key = "results/exp1/run1/sobel.png"
    local_backend.save_bytes(key, b"edge")
    assert local_backend.delete_file(key) is True
    assert local_backend.exists(key) is False


def test_delete_prefix(local_backend: LocalStorageBackend):
    local_backend.save_bytes("results/exp-1/run-a/a.png", b"a")
    local_backend.save_bytes("results/exp-1/run-b/b.png", b"b")
    local_backend.save_bytes("results/exp-2/other.png", b"c")

    removed = local_backend.delete_prefix("results/exp-1")
    assert removed == 2
    assert local_backend.exists("results/exp-1/run-a/a.png") is False
    assert local_backend.exists("results/exp-2/other.png") is True


def test_public_url_for_results(local_backend: LocalStorageBackend):
    key = "results/e1/r1/overlay.png"
    local_backend.save_bytes(key, b"x")
    assert local_backend.get_public_url(key) == (
        "http://testserver/static/results/e1/r1/overlay.png"
    )
