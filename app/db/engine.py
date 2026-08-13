"""Async SQLAlchemy engine factory with dialect-specific configuration."""

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.core.config import settings


def build_engine_kwargs() -> dict:
    """Return ``create_async_engine`` kwargs for the configured DATABASE_URL."""
    kwargs: dict = {
        "echo": settings.DEBUG and not settings.is_production,
        "pool_pre_ping": True,
    }

    if settings.is_sqlite:
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs.update(
            {
                "pool_size": settings.DB_POOL_SIZE,
                "max_overflow": settings.DB_MAX_OVERFLOW,
            }
        )

    return kwargs


def create_app_engine() -> AsyncEngine:
    return create_async_engine(settings.DATABASE_URL, **build_engine_kwargs())
