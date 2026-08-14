"""PG -> MongoDB data migration.

Reads every table from the legacy PostgreSQL schema (via the retained
SQLAlchemy models) and writes it into MongoDB using the Mongo facade's
PyMongo backend. Original integer IDs and timestamps are preserved, enums are
stored as their ``.value`` strings, dates as ISO-8601 strings, and money as
Decimal (encoded to Decimal128 by the facade).

Usage:
    .venv/Scripts/python.exe scripts/migrate_pg_to_mongo.py [--dry-run] [--reset]

Environment:
    DATABASE_URL   legacy PostgreSQL async URL (default: settings value)
    MONGODB_URI    target MongoDB URI (default: settings value)
    MONGODB_DATABASE  target database name (default: settings value)

Notes:
    - Run with --dry-run first to preview row counts.
    - --reset drops all application collections on the target before migrating.
    - The script then runs ``ensure_indexes`` on the target.
"""

import argparse
import asyncio
import sys
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from pathlib import Path

# Make the repo importable when run as a plain script.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.db import models as app_models  # noqa: E402
from app.db.mongo import (  # noqa: E402
    MongoDatabase,
    PyMongoBackend,
    _encode_value,
)


def _convert(value):
    """Convert a SQLAlchemy column value into a Mongo-safe primitive."""
    if value is None:
        return None
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, date) and not isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal | datetime | bool | int | float | str):
        return value
    return str(value)


def _row_to_doc(model, row) -> dict:
    doc = {}
    for column in model.__table__.columns:
        value = _convert(getattr(row, column.name))
        if value is not None:
            doc[column.name] = value
    return doc


_COLLECTION_BY_MODEL = {
    app_models.User: "users",
    app_models.Transaction: "transactions",
    app_models.Budget: "budgets",
    app_models.SavingsGoal: "savings_goals",
    app_models.DebtObligation: "debt_obligations",
    app_models.Consent: "consents",
    app_models.AuditLog: "audit_logs",
    app_models.RefreshTokenSession: "refresh_token_sessions",
    app_models.MLPrediction: "ml_predictions",
    app_models.ReadinessScore: "readiness_scores",
    app_models.ReadinessFactor: "readiness_factors",
    app_models.ChatSession: "chat_sessions",
    app_models.ChatMessage: "chat_messages",
    app_models.Notification: "notifications",
    app_models.GovernmentScheme: "government_schemes",
    app_models.RecycleBinItem: "recycle_bin",
}


async def migrate(source_url: str, mongo_uri: str, database: str, *, dry_run: bool, reset: bool) -> None:
    engine = create_async_engine(source_url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    from pymongo.asynchronous.mongo_client import AsyncMongoClient

    mongo_client = AsyncMongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    db = MongoDatabase(PyMongoBackend(mongo_client[database]))

    try:
        if reset and not dry_run:
            await db.drop_collections()
            print(f"[migrate] reset target database '{database}'")

        print(f"[migrate] source={source_url.split('@')[-1]} target={database} dry_run={dry_run}")

        total = 0
        async with session_factory() as session:
            for model in _COLLECTION_BY_MODEL:
                collection = _COLLECTION_BY_MODEL[model]
                rows = list((await session.execute(select(model))).scalars())
                docs = [_row_to_doc(model, row) for row in rows]
                print(f"[migrate] {collection:>24}: {len(docs):>6} rows")
                if dry_run:
                    total += len(docs)
                    continue

                coll = db._coll(collection)  # noqa: SLF001
                max_id = 0
                for doc in docs:
                    doc_id = doc["id"]
                    doc["_id"] = doc_id
                    max_id = max(max_id, doc_id)
                    await coll.insert_one(_encode_value(doc))
                total += len(docs)

                if max_id:
                    await db._coll("counters").find_one_and_update(  # noqa: SLF001
                        {"_id": collection},
                        {"$set": {"seq": max_id}},
                        upsert=True,
                        return_after=True,
                    )

        if dry_run:
            print(f"[migrate] DRY-RUN: {total} rows would be migrated.")
        else:
            from app.db.indexes import ensure_indexes

            await ensure_indexes(db)
            print(f"[migrate] done: {total} rows migrated, indexes ensured.")
    finally:
        await mongo_client.close()
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate PostgreSQL -> MongoDB.")
    parser.add_argument("--dry-run", action="store_true", help="print counts only")
    parser.add_argument("--reset", action="store_true", help="drop target collections first")
    parser.add_argument("--database-url", default=None, help="override DATABASE_URL")
    parser.add_argument("--mongo-uri", default=None, help="override MONGODB_URI")
    parser.add_argument("--mongo-database", default=None, help="override MONGODB_DATABASE")
    args = parser.parse_args()

    from app.core.config import settings

    source = args.database_url or settings.DATABASE_URL
    mongo_uri = args.mongo_uri or settings.MONGODB_URI
    database = args.mongo_database or settings.mongo_database

    asyncio.run(migrate(source, mongo_uri, database, dry_run=args.dry_run, reset=args.reset))


if __name__ == "__main__":
    main()
