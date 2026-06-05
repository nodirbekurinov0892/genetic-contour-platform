"""Attach a unique request ID to every HTTP request."""

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.utils.request_context import request_id_ctx

REQUEST_ID_HEADER = "X-Request-ID"


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        incoming = request.headers.get(REQUEST_ID_HEADER)
        request_id = incoming.strip() if incoming and incoming.strip() else uuid.uuid4().hex
        token = request_id_ctx.set(request_id)
        request.state.request_id = request_id

        try:
            response = await call_next(request)
        finally:
            request_id_ctx.reset(token)

        response.headers[REQUEST_ID_HEADER] = request_id
        return response
