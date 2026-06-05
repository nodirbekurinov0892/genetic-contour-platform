"""Resolve public URLs for stored media."""

from app.config import Settings
from app.services.storage import StorageService


def resolve_public_url(
    *,
    storage: StorageService,
    settings: Settings,
    storage_key: str | None,
    public_url: str | None,
    file_path: str | None = None,
) -> str:
    if public_url and public_url.strip():
        if settings.storage_backend == "local" and not public_url.startswith("http"):
            return storage.get_public_url(storage_key or file_path or "")
        return public_url
    return storage.resolve_url(
        storage_key=storage_key,
        public_url=public_url,
        file_path=file_path,
    )
