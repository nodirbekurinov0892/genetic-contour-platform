"""Local filesystem storage (development)."""

import shutil
from pathlib import Path

from app.config import Settings
from app.services.storage.base import StorageBackend, StoredObject
from app.services.storage.exceptions import StorageObjectNotFoundError
from app.utils.file_utils import ensure_path_within_base


class LocalStorageBackend(StorageBackend):
    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_dir = settings.base_dir
        self.upload_path = settings.upload_path
        self.results_path = settings.results_path

    def _resolve_local_path(self, storage_key: str) -> Path:
        normalized = storage_key.replace("\\", "/").lstrip("/")
        if normalized.startswith("uploads/"):
            path = self.upload_path / normalized[len("uploads/") :]
            return ensure_path_within_base(path, self.upload_path)
        if normalized.startswith("results/"):
            path = self.results_path / normalized[len("results/") :]
            return ensure_path_within_base(path, self.results_path)
        path = self.base_dir / normalized
        return ensure_path_within_base(path, self.base_dir)

    def save_bytes(
        self,
        storage_key: str,
        data: bytes,
        content_type: str | None = None,
    ) -> StoredObject:
        path = self._resolve_local_path(storage_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return StoredObject(
            storage_key=storage_key,
            public_url=self.get_public_url(storage_key),
            content_type=content_type,
        )

    def save_file(
        self,
        storage_key: str,
        source_path: str,
        content_type: str | None = None,
    ) -> StoredObject:
        src = Path(source_path)
        dest = self._resolve_local_path(storage_key)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)
        return StoredObject(
            storage_key=storage_key,
            public_url=self.get_public_url(storage_key),
            content_type=content_type,
        )

    def get_bytes(self, storage_key: str) -> bytes:
        path = self._resolve_local_path(storage_key)
        if not path.exists():
            raise StorageObjectNotFoundError(storage_key)
        return path.read_bytes()

    def delete_file(self, storage_key: str) -> bool:
        path = self._resolve_local_path(storage_key)
        if not path.exists():
            return False
        path.unlink()
        return True

    def delete_prefix(self, prefix: str) -> int:
        normalized = prefix.replace("\\", "/").rstrip("/")
        if normalized.startswith("results/"):
            target = self.results_path / normalized[len("results/") :]
            base = self.results_path
            root = self.results_path
        elif normalized.startswith("uploads/"):
            target = self.upload_path / normalized[len("uploads/") :]
            base = self.upload_path
            root = self.upload_path
        else:
            target = self.base_dir / normalized
            base = self.base_dir
            root = self.base_dir

        try:
            target = ensure_path_within_base(target, base)
        except ValueError:
            return 0

        if not target.exists():
            return 0

        removed = 0
        if target.is_file():
            target.unlink()
            return 1

        for file_path in sorted(target.rglob("*"), reverse=True):
            if file_path.is_file():
                file_path.unlink()
                removed += 1
            elif file_path.is_dir():
                file_path.rmdir()
        if target.is_dir():
            shutil.rmtree(target, ignore_errors=True)
        return removed

    def list_prefix(self, prefix: str) -> list[str]:
        normalized = prefix.replace("\\", "/").rstrip("/")
        if normalized.startswith("uploads/"):
            root = self.upload_path
            scan = root / normalized[len("uploads/") :]
            storage_prefix = "uploads/"
        elif normalized.startswith("results/"):
            root = self.results_path
            scan = root / normalized[len("results/") :]
            storage_prefix = "results/"
        else:
            return []

        if not scan.exists():
            return []
        keys: list[str] = []
        for file_path in scan.rglob("*"):
            if file_path.is_file():
                rel = file_path.relative_to(root).as_posix()
                keys.append(f"{storage_prefix}{rel}")
        return keys

    def exists(self, storage_key: str) -> bool:
        return self._resolve_local_path(storage_key).exists()

    def get_public_url(self, storage_key: str) -> str:
        normalized = storage_key.replace("\\", "/").lstrip("/")
        return f"{self.settings.api_public_url.rstrip('/')}/static/{normalized}"

    def get_signed_url(self, storage_key: str, expires_in: int = 3600) -> str:
        return self.get_public_url(storage_key)

    def get_local_path(self, storage_key: str) -> Path:
        return self._resolve_local_path(storage_key)
