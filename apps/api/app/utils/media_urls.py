"""Resolve public URLs for stored media."""

from app.config import Settings
from app.services.storage import StorageService
from app.utils.public_url_safety import is_stale_public_url


def resolve_public_url(
    *,
    storage: StorageService,
    settings: Settings,
    storage_key: str | None,
    public_url: str | None,
    file_path: str | None = None,
) -> str:
    key = storage_key or ""
    if public_url and public_url.strip() and not is_stale_public_url(public_url, settings):
        if settings.storage_backend == "local" and not public_url.startswith("http"):
            return storage.get_public_url(key or file_path or "")
        return public_url
    if key:
        return storage.get_public_url(key)
    return storage.resolve_url(
        storage_key=storage_key,
        public_url=public_url,
        file_path=file_path,
    )
