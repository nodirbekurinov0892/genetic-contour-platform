"""Per-request context for logging and tracing."""

import contextvars

request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id",
    default="-",
)


def get_request_id() -> str:
    return request_id_ctx.get()
