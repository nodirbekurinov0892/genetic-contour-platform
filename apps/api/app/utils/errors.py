"""API error formatting utilities."""

from typing import Any


def format_error_detail(detail: Any, *, debug: bool = False, fallback: str = "Request failed") -> str:
    """Normalize FastAPI / service errors into a user-facing string."""
    if detail is None:
        return fallback
    if isinstance(detail, str):
        return detail if debug else _sanitize_message(detail, fallback)
    if isinstance(detail, list):
        messages: list[str] = []
        for item in detail:
            if isinstance(item, dict):
                loc = ".".join(str(x) for x in item.get("loc", []))
                msg = item.get("msg", "")
                messages.append(f"{loc}: {msg}" if loc else str(msg))
            else:
                messages.append(str(item))
        return "; ".join(messages) or fallback
    if isinstance(detail, dict):
        return str(detail.get("message") or detail.get("detail") or detail)
    return str(detail)


def _sanitize_message(message: str, fallback: str) -> str:
    """Hide internal exception strings in production responses."""
    lowered = message.lower()
    internal_markers = ("traceback", "sqlalchemy", "asyncpg", "module", "attributeerror")
    if any(marker in lowered for marker in internal_markers):
        return fallback
    if len(message) > 300:
        return fallback
    return message
