"""Lifespan startup behavior tests."""

import pytest

from app import main as main_module
from app.core.config import settings


async def _run_lifespan():
    async with main_module.lifespan(None):
        yield


async def test_lifespan_fails_fast_in_production_when_mongo_down(monkeypatch):
    async def boom():
        raise RuntimeError("mongo unreachable")

    monkeypatch.setattr(main_module, "connect", boom)
    monkeypatch.setattr(type(settings), "is_production", property(lambda self: True))

    with pytest.raises(RuntimeError, match="mongo unreachable"):
        async for _ in _run_lifespan():
            pass


async def test_lifespan_warns_but_continues_in_dev_when_mongo_down(monkeypatch):
    async def boom():
        raise RuntimeError("mongo unreachable")

    monkeypatch.setattr(main_module, "connect", boom)
    monkeypatch.setattr(type(settings), "is_production", property(lambda self: False))

    async with main_module.lifespan(None):
        pass
