"""Shared FastAPI dependencies: authentication, rate limiting, pagination."""

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import RateLimitError, UnauthorizedError
from app.db.models.user import User
from app.db.session import get_session
from app.core.security import require_valid_access_token
from app.services.auth.service import get_user_by_id


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_session),
    authorization: str | None = Header(default=None),
) -> User:
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


async def rate_limit_auth(request: Request) -> None:
    await _rate_limit(request, "auth", limit=20, window=60)


async def rate_limit_chat(request: Request) -> None:
    await _rate_limit(request, "chat", limit=30, window=60)


async def _rate_limit(request: Request, scope: str, limit: int, window: int) -> None:
    from app.core.config import settings

    if not settings.RATE_LIMIT_ENABLED:
        return
    try:
        from redis.asyncio import Redis

        client = Redis.from_url(settings.REDIS_URL, socket_connect_timeout=0.3)
        key = f"rl:{scope}:{request.client.host if request.client else 'unknown'}"
        try:
            count = await client.incr(key)
            if count == 1:
                await client.expire(key, window)
        finally:
            await client.aclose()
        if count > limit:
            raise RateLimitError("Too many requests. Please slow down.")
    except RateLimitError:
        raise
    except Exception:
        # Redis unavailable: fail open in non-production, fail closed in production.
        if settings.is_production:
            raise RateLimitError("Rate limiting unavailable.")
