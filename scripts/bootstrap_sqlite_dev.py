#!/usr/bin/env python3
"""Bootstrap a local SQLite development database from SQLAlchemy models.

Use this for quick local setup when you do not need PostgreSQL-specific
features. For production-like schema management, use Alembic against PostgreSQL:

    alembic upgrade head
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app.db.models  # noqa: F401
from app.core.config import settings
from app.db.base import Base
from app.db.engine import create_app_engine


async def main() -> None:
    if not settings.is_sqlite:
        print("DATABASE_URL is not SQLite. Use `alembic upgrade head` for PostgreSQL.")
        sys.exit(1)

    engine = create_app_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print(f"SQLite schema created at {settings.DATABASE_URL}")


if __name__ == "__main__":
    asyncio.run(main())
