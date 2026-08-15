"""Domain exceptions and consistent error responses.

Every HTTP error returns:

    {
        "error": {
            "code": "INVALID_INPUT",
            "message": "...",
            "request_id": "..."
        }
    }
"""

from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger
from app.core.middleware import current_request_id

logger = get_logger(__name__)


class AppError(Exception):
    """Base application error."""

    code = "INTERNAL_ERROR"
    status_code = 500

    def __init__(
        self,
        message: str,
        *,
        details: dict[str, Any] | None = None,
        retry_after: int | None = None,
    ) -> None:
        self.message = message
        self.details = details or {}
        self.retry_after = retry_after
        super().__init__(message)


class NotFoundError(AppError):
    code = "NOT_FOUND"
    status_code = 404


class ConflictError(AppError):
    code = "CONFLICT"
    status_code = 409


class UnauthorizedError(AppError):
    code = "UNAUTHORIZED"
    status_code = 401


class ForbiddenError(AppError):
    code = "FORBIDDEN"
    status_code = 403


class InvalidInputError(AppError):
    code = "INVALID_INPUT"
    status_code = 422


class ConsentDeniedError(AppError):
    code = "CONSENT_DENIED"
    status_code = 403


class RateLimitError(AppError):
    code = "RATE_LIMITED"
    status_code = 429


class LLMUnavailableError(AppError):
    code = "LLM_UNAVAILABLE"
    status_code = 503


def error_body(
    code: str,
    message: str,
    request: Request | None = None,
    *,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    request_id = current_request_id() or "-"
    body: dict[str, Any] = {"error": {"code": code, "message": message, "request_id": request_id}}
    if details:
        body["error"]["details"] = details
    return body


def _log_handled(request: Request, status_code: int, code: str, message: str) -> None:
    level = logger.warning if 400 <= status_code < 500 else logger.error
    level(
        "Request %s %s -> %s %s: %s",
        request.method,
        request.url.path,
        status_code,
        code,
        message,
        exc_info=(status_code >= 500),
    )


async def app_exception_handler(request: Request, exc: AppError) -> JSONResponse:
    _log_handled(request, exc.status_code, exc.code, exc.message)
    headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.code, exc.message, request, details=exc.details),
        headers=headers,
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        429: "RATE_LIMITED",
    }.get(exc.status_code, "HTTP_ERROR")
    _log_handled(request, exc.status_code, code, str(exc.detail))
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(code, str(exc.detail), request),
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    _log_handled(request, 422, "VALIDATION_ERROR", "Request validation failed")
    return JSONResponse(
        status_code=422,
        content=error_body(
            "VALIDATION_ERROR",
            "Request validation failed.",
            request,
            details={"errors": exc.errors()},
        ),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error for %s %s", request.method, request.url.path, exc_info=exc)
    message = "An unexpected error occurred."
    return JSONResponse(
        status_code=500,
        content=error_body("INTERNAL_ERROR", message, request),
    )
