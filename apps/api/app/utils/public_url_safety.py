"""Detect stale or dev-only public URLs in production responses."""

from app.config import Settings


def is_stale_public_url(public_url: str, settings: Settings) -> bool:
    """Detect URLs saved under a wrong dev/base host (e.g. localhost in production)."""
    if not public_url or not public_url.strip():
        return True
    lower = public_url.lower()
    if "localhost" in lower or "127.0.0.1" in lower:
        return True
    if settings.storage_backend == "s3":
        base = settings.s3_public_base_url.rstrip("/")
        if base and not public_url.startswith(base):
            return True
    else:
        base = settings.api_public_url.rstrip("/")
        if base and not public_url.startswith(base):
            return True
    return False
