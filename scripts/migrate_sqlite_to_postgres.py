#!/usr/bin/env python3
"""Migrate FinCompass data from SQLite to PostgreSQL.

Safe, idempotent-oriented export/import for hackathon and production cutover.
Does NOT delete the source SQLite database.

Usage:
    export DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/finai
    python scripts/migrate_sqlite_to_postgres.py \\
        --sqlite-url sqlite+aiosqlite:///./finai_dev.sqlite

Requirements:
    - Target PostgreSQL schema must already exist (`alembic upgrade head`)
    - Source SQLite file must be readable
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import MetaData, Table, func, select, text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

DEFAULT_SQLITE = "sqlite+aiosqlite:///./finai_dev.sqlite"

# Tables in foreign-key-safe insertion order.
TABLE_ORDER: Sequence[str] = (
    "users",
    "government_schemes",
    "consents",
    "transactions",
    "budgets",
    "savings_goals",
    "debt_obligations",
    "readiness_scores",
    "readiness_factors",
    "chat_sessions",
    "chat_messages",
    "notifications",
    "audit_logs",
    "recycle_bin",
    "refresh_token_sessions",
    "ml_predictions",
)


@dataclass
class MigrationReport:
    table: str
    source_count: int
    inserted: int
    skipped: int
    errors: list[str]


async def _count_rows(engine: AsyncEngine, table: str) -> int:
    async with engine.connect() as conn:
        result = await conn.execute(text(f'SELECT COUNT(*) FROM "{table}"'))
        return int(result.scalar_one())


async def _fetch_rows(engine: AsyncEngine, table: str) -> list[dict[str, Any]]:
    metadata = MetaData()
    async with engine.connect() as conn:
        tbl = await conn.run_sync(lambda sync_conn: Table(table, metadata, autoload_with=sync_conn))
        result = await conn.execute(select(tbl))
        return [dict(row._mapping) for row in result.fetchall()]


async def _insert_rows(
    engine: AsyncEngine,
    table: str,
    rows: list[dict[str, Any]],
    *,
    dry_run: bool,
) -> tuple[int, int, list[str]]:
    if not rows:
        return 0, 0, []

    metadata = MetaData()
    inserted = 0
    skipped = 0
    errors: list[str] = []

    async with engine.begin() as conn:
        tbl = await conn.run_sync(lambda sync_conn: Table(table, metadata, autoload_with=sync_conn))
        for row in rows:
            try:
                if dry_run:
                    inserted += 1
                    continue
                await conn.execute(tbl.insert().values(**row))
                inserted += 1
            except Exception as exc:  # noqa: BLE001
                message = str(exc).lower()
                if "duplicate" in message or "unique" in message:
                    skipped += 1
                else:
                    errors.append(f"{table} id={row.get('id')}: {exc}")
    return inserted, skipped, errors


async def migrate(
    sqlite_url: str,
    postgres_url: str,
    *,
    dry_run: bool = False,
) -> list[MigrationReport]:
    if not postgres_url.startswith("postgresql"):
        raise ValueError("Target DATABASE_URL must be PostgreSQL.")

    source = create_async_engine(
        sqlite_url,
        connect_args={"check_same_thread": False},
    )
    target = create_async_engine(postgres_url)

    reports: list[MigrationReport] = []

    try:
        for table in TABLE_ORDER:
            try:
                source_count = await _count_rows(source, table)
            except Exception:
                reports.append(MigrationReport(table, 0, 0, 0, ["table missing in source"]))
                continue

            rows = await _fetch_rows(source, table)
            inserted, skipped, errors = await _insert_rows(
                target, table, rows, dry_run=dry_run
            )
            target_count = await _count_rows(target, table)
            reports.append(
                MigrationReport(
                    table=table,
                    source_count=source_count,
                    inserted=inserted,
                    skipped=skipped,
                    errors=errors,
                )
            )
            if source_count != target_count and not dry_run and not errors:
                reports[-1].errors.append(
                    f"count mismatch after import: source={source_count}, target={target_count}"
                )
    finally:
        await source.dispose()
        await target.dispose()

    return reports


def _normalize_postgres_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


async def _verify_postgres(engine: AsyncEngine) -> None:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))


def print_report(reports: list[MigrationReport]) -> int:
    exit_code = 0
    print("\nFinCompass SQLite → PostgreSQL migration report")
    print("=" * 72)
    for report in reports:
        status = "OK"
        if report.errors:
            status = "ERRORS"
            exit_code = 1
        print(
            f"{report.table:24} source={report.source_count:4} "
            f"inserted={report.inserted:4} skipped={report.skipped:4} [{status}]"
        )
        for err in report.errors:
            print(f"  - {err}")
    print("=" * 72)
    return exit_code


async def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate FinCompass SQLite data to PostgreSQL")
    parser.add_argument("--sqlite-url", default=DEFAULT_SQLITE)
    parser.add_argument(
        "--postgres-url",
        default=None,
        help="Defaults to DATABASE_URL environment variable",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    from app.core.config import settings

    postgres_url = _normalize_postgres_url(args.postgres_url or settings.DATABASE_URL)
    if postgres_url.startswith("sqlite"):
        print("Set DATABASE_URL to a PostgreSQL URL or pass --postgres-url.")
        return 1

    sqlite_path = args.sqlite_url.replace("sqlite+aiosqlite:///", "")
    if not Path(sqlite_path).exists() and ":///:memory:" not in args.sqlite_url:
        print(f"SQLite file not found: {sqlite_path}")
        return 1

    target = create_async_engine(postgres_url)
    try:
        await _verify_postgres(target)
    finally:
        await target.dispose()

    reports = await migrate(args.sqlite_url, postgres_url, dry_run=args.dry_run)
    return print_report(reports)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
