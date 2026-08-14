"""Health endpoint behavior tests."""

from app.api.routes import health as health_module
from app.core.config import settings


async def test_production_reports_degraded_when_redis_down(monkeypatch):
    async def db_ok():
        return "connected"

    async def redis_down():
        return "disconnected"

    monkeypatch.setattr(health_module, "_check_database", db_ok)
    monkeypatch.setattr(health_module, "_check_redis", redis_down)
    monkeypatch.setattr(type(settings), "is_production", property(lambda self: True))

    payload = await health_module.health()
    assert payload["database"]["status"] == "connected"
    assert payload["redis"]["status"] == "disconnected"
    assert payload["status"] == "degraded"


async def test_production_reports_healthy_when_all_dependencies_up(monkeypatch):
    async def db_ok():
        return "connected"

    async def redis_ok():
        return "connected"

    monkeypatch.setattr(health_module, "_check_database", db_ok)
    monkeypatch.setattr(health_module, "_check_redis", redis_ok)
    monkeypatch.setattr(type(settings), "is_production", property(lambda self: True))

    payload = await health_module.health()
    assert payload["status"] == "healthy"


async def test_dev_ignores_redis_for_overall_status(monkeypatch):
    async def db_ok():
        return "connected"

    async def redis_down():
        return "disconnected"

    monkeypatch.setattr(health_module, "_check_database", db_ok)
    monkeypatch.setattr(health_module, "_check_redis", redis_down)
    monkeypatch.setattr(type(settings), "is_production", property(lambda self: False))

    payload = await health_module.health()
    assert payload["redis"]["status"] == "disconnected"
    assert payload["status"] == "healthy"


async def test_degraded_when_database_down(monkeypatch):
    async def db_down():
        return "disconnected"

    async def redis_ok():
        return "connected"

    monkeypatch.setattr(health_module, "_check_database", db_down)
    monkeypatch.setattr(health_module, "_check_redis", redis_ok)
    monkeypatch.setattr(type(settings), "is_production", property(lambda self: True))

    payload = await health_module.health()
    assert payload["status"] == "degraded"
