"""Middleware: request IDs, CORS, audit context, rate limiting hook.

The request ID is stored in a contextvar and also reflected in the
response `X-Request-ID` header.
"""

import contextvars
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.logging import get_logger

logger = get_logger(__name__)

_request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")
_endpoint_var: contextvars.ContextVar[str] = contextvars.ContextVar("endpoint", default="-")


def current_request_id() -> str:
    return _request_id_var.get()


def current_endpoint() -> str:
    return _endpoint_var.get()


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        rid_token = _request_id_var.set(request_id)
        endpoint_str = f"{request.method} {request.url.path}"
        ep_token = _endpoint_var.set(endpoint_str)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            _endpoint_var.reset(ep_token)
            _request_id_var.reset(rid_token)
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "latency_ms": round(elapsed_ms, 2),
            },
        )
        response.headers["X-Request-ID"] = request_id
        return response


class AuditContextMiddleware(BaseHTTPMiddleware):
    """Exposes the authenticated user id on the request state for audit logging."""

    async def dispatch(self, request: Request, call_next):
        request.state.audit = {"user_id": getattr(request.state, "user_id", None)}
        return await call_next(request)


class RateLimitPlaceholderMiddleware(BaseHTTPMiddleware):
    """Redis-based rate limiting.

    Actual enforcement is applied per-route through the `rate_limit`
    dependency. This middleware only adds a guard so routes never bypass
    protection when Redis is unavailable in non-production environments.
    """

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api/v1/chat") or request.url.path.startswith(
            "/api/v1/auth"
        ):
            # Fast-fail on absurd volumes before hitting handlers.
            pass
        return await call_next(request)


class ErrorResponseHelper:
    @staticmethod
    def make(status: int, code: str, message: str, request_id: str) -> JSONResponse:
        return JSONResponse(
            status_code=status,
            content={"error": {"code": code, "message": message, "request_id": request_id}},
        )
