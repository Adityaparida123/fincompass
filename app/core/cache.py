"""Redis cache helpers for non-authoritative, derived financial summaries."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

USER_FINANCIAL_CACHE_KEYS = (
    "user_dashboard",
    "user_cashflow",
    "user_expenses",
    "user_savings",
    "user_readiness",
    "user_debt",
    "user_budget",
)


def _user_cache_key(user_id: int, suffix: str) -> str:
    return f"cache:user:{user_id}:{suffix}"


async def get_cached_json(user_id: int, suffix: str) -> Any | None:
    if not settings.CACHE_ENABLED:
        return None
    try:
        from redis.asyncio import Redis

        client = Redis.from_url(settings.REDIS_URL, socket_connect_timeout=0.3)
        try:
            raw = await client.get(_user_cache_key(user_id, suffix))
        finally:
            await client.aclose()
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        logger.debug("Cache read failed for user %s (%s)", user_id, suffix, exc_info=True)
        return None


async def set_cached_json(
    user_id: int,
    suffix: str,
    payload: Any,
    *,
    ttl_seconds: int | None = None,
) -> None:
    if not settings.CACHE_ENABLED:
        return
    ttl = ttl_seconds or settings.CACHE_TTL_SECONDS
    try:
        from redis.asyncio import Redis

        client = Redis.from_url(settings.REDIS_URL, socket_connect_timeout=0.3)
        try:
            await client.set(
                _user_cache_key(user_id, suffix),
                json.dumps(payload, default=str),
                ex=ttl,
            )
        finally:
            await client.aclose()
    except Exception:
        logger.debug("Cache write failed for user %s (%s)", user_id, suffix, exc_info=True)


async def invalidate_user_financial_cache(user_id: int) -> None:
    """Drop derived dashboard summaries after authoritative DB changes."""
    if not settings.CACHE_ENABLED:
        return
    try:
        from redis.asyncio import Redis

        client = Redis.from_url(settings.REDIS_URL, socket_connect_timeout=0.3)
        try:
            keys = [_user_cache_key(user_id, suffix) for suffix in USER_FINANCIAL_CACHE_KEYS]
            if keys:
                await client.delete(*keys)
        finally:
            await client.aclose()
    except Exception:
        logger.debug("Cache invalidation failed for user %s", user_id, exc_info=True)
