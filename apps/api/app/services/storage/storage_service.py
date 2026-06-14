"""Unified storage facade used by API services."""

import uuid
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np

from app.config import Settings, get_settings
from app.services.storage.base import StorageBackend, StoredObject
from app.services.storage.local_storage import LocalStorageBackend
from app.services.storage.s3_storage import S3StorageBackend
from app.utils.file_utils import MIME_BY_EXT
from app.utils.public_url_safety import is_stale_public_url


class StorageService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.backend: StorageBackend = self._create_backend(settings)

    @staticmethod
    def _create_backend(settings: Settings) -> StorageBackend:
        if settings.storage_backend == "s3":
            return S3StorageBackend(settings)
        return LocalStorageBackend(settings)

    @property
    def is_local(self) -> bool:
        return self.settings.storage_backend == "local"

    def generate_storage_key(self, prefix: str, extension: str, *parts: str) -> str:
        """Server-side storage key generation. Users cannot influence path segments."""
        ext = extension if extension.startswith(".") else f".{extension}"
        segments = [prefix.strip("/"), *[p for p in parts if p], f"{uuid.uuid4().hex}{ext}"]
        return "/".join(segments)

    def upload_key(self, extension: str) -> str:
        return self.generate_storage_key("uploads", extension)

    def ground_truth_key(self, image_id: str) -> str:
        return f"uploads/ground-truth/{image_id}.png"

    def result_key(self, experiment_id: str, run_id: str, filename: str) -> str:
        """Filename must be server-defined (e.g. sobel.png), never user-supplied."""
        safe_name = Path(filename).name
        if safe_name != filename or ".." in safe_name:
            raise ValueError("Invalid result filename")
        return f"results/{experiment_id}/{run_id}/{safe_name}"

    def report_key(self, experiment_id: str, extension: str = ".pdf") -> str:
        ext = extension if extension.startswith(".") else f".{extension}"
        return f"results/{experiment_id}/reports/report-{experiment_id}{ext}"

    def save_bytes(
        self,
        storage_key: str,
        data: bytes,
        content_type: str | None = None,
    ) -> StoredObject:
        return self.backend.save_bytes(storage_key, data, content_type)

    def save_file(
        self,
        storage_key: str,
        source_path: str,
        content_type: str | None = None,
    ) -> StoredObject:
        return self.backend.save_file(storage_key, source_path, content_type)

    def save_image_array(
        self,
        storage_key: str,
        image: np.ndarray,
        content_type: str = "image/png",
    ) -> StoredObject:
        success, encoded = cv2.imencode(".png", image)
        if not success:
            raise OSError(f"Failed to encode image for storage key {storage_key}")
        return self.save_bytes(storage_key, encoded.tobytes(), content_type)

    def get_bytes(self, storage_key: str) -> bytes:
        return self.backend.get_bytes(storage_key)

    def delete_file(self, storage_key: str) -> bool:
        return self.backend.delete_file(storage_key)

    def delete_prefix(self, prefix: str) -> int:
        return self.backend.delete_prefix(prefix)

    def list_prefix(self, prefix: str) -> list[str]:
        list_fn = getattr(self.backend, "list_prefix", None)
        if callable(list_fn):
            return list_fn(prefix)
        return []

    def exists(self, storage_key: str) -> bool:
        return self.backend.exists(storage_key)

    def get_public_url(self, storage_key: str) -> str:
        return self.backend.get_public_url(storage_key)

    def get_signed_url(self, storage_key: str, expires_in: int = 3600) -> str:
        return self.backend.get_signed_url(storage_key, expires_in)

    def resolve_url(
        self,
        *,
        storage_key: str | None,
        public_url: str | None,
        file_path: str | None = None,
    ) -> str:
        if (
            public_url
            and public_url.strip()
            and not is_stale_public_url(public_url, self.settings)
        ):
            return public_url
        if storage_key:
            return self.get_public_url(storage_key)
        if file_path:
            return self.settings.build_static_url(file_path)
        return ""

    def resolve_storage_key(
        self,
        *,
        storage_key: str | None,
        file_path: str | None,
    ) -> str:
        if storage_key:
            return storage_key
        if file_path:
            return file_path.replace("\\", "/").lstrip("/")
        raise ValueError("No storage key available for file")

    def guess_content_type(self, storage_key: str) -> str:
        ext = Path(storage_key).suffix.lower()
        return MIME_BY_EXT.get(ext, "application/octet-stream")


@lru_cache
def get_storage_service() -> StorageService:
    return StorageService(get_settings())
