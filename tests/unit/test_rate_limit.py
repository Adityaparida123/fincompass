"""Unit tests for the rate-limit dependency with a fake Redis backend."""

import pytest
import redis.asyncio
from starlette.requests import Request

from app.api import dependencies as deps
from app.core.exceptions import RateLimitError


class FakeRedisClient:
    """In-memory stand-in for the async Redis client."""

    def __init__(self):
        self.counts = {}
        self.ttls = {}

    async def incr(self, key: str) -> int:
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    async def expire(self, key: str, window: int) -> None:
        self.ttls[key] = window

    async def ttl(self, key: str) -> int:
        return self.ttls.get(key, -1)

    async def aclose(self) -> None:
        pass


class FakeRedis:
    """Replaces redis.asyncio.Redis; returns the injected client."""

    client: FakeRedisClient | None = None

    @classmethod
    def from_url(cls, url: str, **kwargs):
        assert cls.client is not None
        return cls.client


class FlakyRedis:
    @classmethod
    def from_url(cls, url: str, **kwargs):
        raise ConnectionError("redis is down")


def _request(ip: str = "203.0.113.7") -> Request:
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/api/v1/auth/login",
            "raw_path": b"/api/v1/auth/login",
            "query_string": b"",
            "headers": [],
            "client": (ip, 12345),
            "server": ("test", 80),
        }
    )


def _enable(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)


async def test_rate_limit_allows_limit_requests_then_rejects(monkeypatch):
    client = FakeRedisClient()
    FakeRedis.client = client
    monkeypatch.setattr(redis.asyncio, "Redis", FakeRedis)
    _enable(monkeypatch)

    request = _request()
    for _ in range(2):
        await deps._rate_limit(request, "login", limit=2, window=60)
    with pytest.raises(RateLimitError) as exc_info:
        await deps._rate_limit(request, "login", limit=2, window=60)
    assert exc_info.value.retry_after is not None
    assert client.counts["rl:login:203.0.113.7"] == 3


async def test_rate_limit_buckets_are_per_ip(monkeypatch):
    client = FakeRedisClient()
    FakeRedis.client = client
    monkeypatch.setattr(redis.asyncio, "Redis", FakeRedis)
    _enable(monkeypatch)

    await deps._rate_limit(_request("1.1.1.1"), "login", limit=1, window=60)
    # A different IP is not throttled.
    await deps._rate_limit(_request("2.2.2.2"), "login", limit=1, window=60)
    with pytest.raises(RateLimitError):
        await deps._rate_limit(_request("1.1.1.1"), "login", limit=1, window=60)


async def test_rate_limit_per_email_bucket(monkeypatch):
    client = FakeRedisClient()
    FakeRedis.client = client
    monkeypatch.setattr(redis.asyncio, "Redis", FakeRedis)
    _enable(monkeypatch)

    request = _request()
    await deps._rate_limit(request, "login_email", limit=1, window=60, email="a@b.com")
    with pytest.raises(RateLimitError):
        await deps._rate_limit(request, "login_email", limit=1, window=60, email="a@b.com")
    # Same email normalized; different email unaffected.
    with pytest.raises(RateLimitError):
        await deps._rate_limit(request, "login_email", limit=1, window=60, email="A@B.com")
    await deps._rate_limit(request, "login_email", limit=1, window=60, email="c@d.com")


async def test_rate_limit_fails_open_when_redis_unavailable(monkeypatch):
    monkeypatch.setattr(redis.asyncio, "Redis", FlakyRedis)
    _enable(monkeypatch)
    await deps._rate_limit(_request(), "login", limit=10, window=60)


async def test_rate_limit_disabled_when_turned_off(monkeypatch):
    client = FakeRedisClient()
    FakeRedis.client = client
    monkeypatch.setattr(redis.asyncio, "Redis", FakeRedis)
    from app.core.config import settings

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)

    for _ in range(5):
        await deps._rate_limit(_request(), "login", limit=1, window=60)


async def test_request_email_extraction():
    request = _request()
    request._body = b'{"email": "  A@B.com  "}'
    assert await deps._request_email(request) == "a@b.com"

    request = _request()
    request._body = b"not json"
    assert await deps._request_email(request) is None

    request = _request()
    request._body = b"[]"
    assert await deps._request_email(request) is None


async def test_register_dependency_uses_register_limits(monkeypatch):
    client = FakeRedisClient()
    FakeRedis.client = client
    monkeypatch.setattr(redis.asyncio, "Redis", FakeRedis)
    _enable(monkeypatch)
    from app.core.config import settings

    request = _request()
    request._body = b'{"email": "reg@example.com"}'
    limit = min(settings.RATE_LIMIT_REGISTER_LIMIT, settings.RATE_LIMIT_REGISTER_EMAIL_LIMIT)
    for _ in range(limit):
        await deps.rate_limit_register(request)
    with pytest.raises(RateLimitError):
        await deps.rate_limit_register(request)
    assert any(k.startswith("rl:register:") for k in client.counts)
    assert "rl:register_email:203.0.113.7:reg@example.com" in client.counts


def test_auth_dependency_names_exist():
    from app.api.routes import auth as auth_module

    for name in (
        "rate_limit_register",
        "rate_limit_login",
        "rate_limit_refresh",
        "rate_limit_forgot_password",
        "rate_limit_reset_password",
    ):
        assert hasattr(auth_module, name)
