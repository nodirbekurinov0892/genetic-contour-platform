"""Storage backend interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class StoredObject:
    storage_key: str
    public_url: str
    content_type: str | None = None


class StorageBackend(ABC):
    @abstractmethod
    def save_bytes(
        self,
        storage_key: str,
        data: bytes,
        content_type: str | None = None,
    ) -> StoredObject:
        raise NotImplementedError

    @abstractmethod
    def save_file(
        self,
        storage_key: str,
        source_path: str,
        content_type: str | None = None,
    ) -> StoredObject:
        raise NotImplementedError

    @abstractmethod
    def get_bytes(self, storage_key: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    def delete_file(self, storage_key: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def delete_prefix(self, prefix: str) -> int:
        raise NotImplementedError

    @abstractmethod
    def exists(self, storage_key: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def get_public_url(self, storage_key: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_signed_url(self, storage_key: str, expires_in: int = 3600) -> str:
        raise NotImplementedError
