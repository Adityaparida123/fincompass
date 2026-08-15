"""Shared FastAPI dependencies: authentication, rate limiting, pagination."""

from fastapi import Depends, Header, Request

from app.core.exceptions import RateLimitError, UnauthorizedError
from app.core.logging import get_logger
from app.core.security import require_valid_access_token
from app.db.mongo import MongoDatabase
from app.db.session import get_session
from app.services.auth.service import get_user_by_id

logger = get_logger(__name__)


async def get_current_user(
    request: Request,
    db: MongoDatabase = Depends(get_session),
    authorization: str | None = Header(default=None),
) -> object:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if token is None:
        raise UnauthorizedError("Authentication required.")
    user_id = require_valid_access_token(token)
    user = await get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Authentication required.")
    request.state.audit = {"user_id": user.id}
    return user


async def rate_limit_register(request: Request) -> None:
    from app.core.config import settings

    await _rate_limit(
        request,
        "register",
        limit=settings.RATE_LIMIT_REGISTER_LIMIT,
        window=settings.RATE_LIMIT_REGISTER_WINDOW,
    )
    email = await _request_email(request)
    if email:
        await _rate_limit(
            request,
            "register_email",
            limit=settings.RATE_LIMIT_REGISTER_EMAIL_LIMIT,
            window=settings.RATE_LIMIT_REGISTER_EMAIL_WINDOW,
            email=email,
        )


async def rate_limit_login(request: Request) -> None:
    from app.core.config import settings

    await _rate_limit(
        request,
        "login",
        limit=settings.RATE_LIMIT_LOGIN_LIMIT,
        window=settings.RATE_LIMIT_LOGIN_WINDOW,
    )
    email = await _request_email(request)
    if email:
        await _rate_limit(
            request,
            "login_email",
            limit=settings.RATE_LIMIT_LOGIN_EMAIL_LIMIT,
            window=settings.RATE_LIMIT_LOGIN_EMAIL_WINDOW,
            email=email,
        )


async def rate_limit_refresh(request: Request) -> None:
    from app.core.config import settings

    await _rate_limit(
        request,
        "refresh",
        limit=settings.RATE_LIMIT_REFRESH_LIMIT,
        window=settings.RATE_LIMIT_REFRESH_WINDOW,
    )


async def rate_limit_forgot_password(request: Request) -> None:
    from app.core.config import settings

    await _rate_limit(
        request,
        "forgot",
        limit=settings.RATE_LIMIT_FORGOT_LIMIT,
        window=settings.RATE_LIMIT_FORGOT_WINDOW,
    )
    email = await _request_email(request)
    if email:
        await _rate_limit(
            request,
            "forgot_email",
            limit=settings.RATE_LIMIT_FORGOT_EMAIL_LIMIT,
            window=settings.RATE_LIMIT_FORGOT_EMAIL_WINDOW,
            email=email,
        )


async def rate_limit_reset_password(request: Request) -> None:
    from app.core.config import settings

    await _rate_limit(
        request,
        "reset",
        limit=settings.RATE_LIMIT_RESET_LIMIT,
        window=settings.RATE_LIMIT_RESET_WINDOW,
    )


async def rate_limit_chat(request: Request) -> None:
    from app.core.config import settings

    await _rate_limit(
        request,
        "chat",
        limit=settings.RATE_LIMIT_CHAT_LIMIT,
        window=settings.RATE_LIMIT_CHAT_WINDOW,
    )


async def rate_limit_ml(request: Request) -> None:
    from app.core.config import settings

    await _rate_limit(
        request,
        "ml",
        limit=settings.RATE_LIMIT_ML_LIMIT,
        window=settings.RATE_LIMIT_ML_WINDOW,
    )


async def _request_email(request: Request) -> str | None:
    """Best-effort extraction of the request email for per-email rate buckets."""
    try:
        body = await request.json()
    except Exception:
        return None
    if isinstance(body, dict):
        email = body.get("email")
        if isinstance(email, str) and email.strip():
            return email.strip().lower()
    return None


async def _rate_limit(
    request: Request,
    scope: str,
    limit: int,
    window: int,
    *,
    email: str | None = None,
) -> None:
    from app.core.config import settings

    if not settings.RATE_LIMIT_ENABLED:
        return
    try:
        from redis.asyncio import Redis

        client = Redis.from_url(settings.REDIS_URL, socket_connect_timeout=0.3)
        ip = request.client.host if request.client else "unknown"
        key = f"rl:{scope}:{ip}"
        if email:
            key += f":{email.strip().lower()}"
        try:
            count = await client.incr(key)
            if count == 1:
                await client.expire(key, window)
            if count > limit:
                ttl = int(await client.ttl(key) or 0)
                raise RateLimitError(
                    "Too many requests. Please slow down.",
                    retry_after=max(ttl, 1),
                )
        finally:
            await client.aclose()
    except RateLimitError:
        raise
    except Exception:
        # Redis unavailable: fail open so requests are allowed through, and
        # log it so rate-limit gaps are visible in production. A 429 here
        # would falsely blame healthy clients for an infrastructure issue.
        logger.warning(
            "Rate limiting unavailable (Redis unreachable): allowing request",
            exc_info=True,
        )
