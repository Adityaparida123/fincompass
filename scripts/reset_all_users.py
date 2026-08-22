"""Reset ALL user accounts in the development MongoDB database.

Development-only admin script. Deletes every registered user and every
user-owned record so the database behaves as if no one had ever signed up.
It reuses the exact per-user cascade from ``DELETE /api/v1/users/me``
(``app.services.users.service.delete_account``), so deletion order matches
production behaviour: child records first (chat messages by session,
readiness factors by score), then every ``user_id``-scoped collection, then
the user document itself.

Intentionally PRESERVED (global/reference data):
    - government_schemes   public scheme catalogue
    - counters             integer ID allocation state
    - any other collection not owned by a user account

Safety guards:
    - refuses to run when APP_ENV=production
    - refuses to target the production database name ("fincompass");
      only non-production databases (default "fincompass_dev") are allowed
    - read-only inspection unless --yes is passed
    - prints exactly what will be / was deleted before touching anything

Usage:
    python scripts/reset_all_users.py           # inspect only (dry run)
    python scripts/reset_all_users.py --yes     # permanently delete all user data

Environment:
    MONGODB_URI / MONGODB_DATABASE  target instance (default: repo .env)
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Make the repo importable when run as a plain script.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from app.db.mongo import MongoDatabase, connect, disconnect  # noqa: E402
from app.services.users.service import _USER_SCOPED_COLLECTIONS, delete_account  # noqa: E402

PRODUCTION_DATABASE_NAME = "fincompass"

# Everything tied to an account, in the order the cascade removes it.
USER_OWNED_COLLECTIONS = (
    *_USER_SCOPED_COLLECTIONS,
    "chat_sessions",
    "chat_messages",
    "readiness_scores",
    "readiness_factors",
    "users",
)

PRESERVED_COLLECTIONS = ("government_schemes", "counters")


def guard() -> None:
    """Refuse unsafe targets before opening any connection."""
    if settings.is_production:
        print("ABORT: APP_ENV=production. This script only runs in development.")
        raise SystemExit(1)
    database = settings.mongo_database
    if database == PRODUCTION_DATABASE_NAME:
        print(
            f"ABORT: target database '{database}' is the production database name. "
            "Set MONGODB_DATABASE to a development database."
        )
        raise SystemExit(1)


async def inspect(db: MongoDatabase) -> dict[str, int]:
    counts: dict[str, int] = {}
    names = await db._backend.list_collection_names()
    for name in sorted(set(names) | set(USER_OWNED_COLLECTIONS)):
        # Explicit empty filter: count_documents(None) is rejected by Atlas.
        counts[name] = await db.count(name, {})
    return counts


def report(counts: dict[str, int], *, future_tense: bool) -> None:
    verb = "WILL BE DELETED" if future_tense else "DELETED"
    print(f"\n--- User-owned data ({verb}) ---")
    for name in USER_OWNED_COLLECTIONS:
        print(f"  {name:<24} {counts.get(name, 0):>6}")
    print("\n--- Preserved (global/reference) ---")
    for name in PRESERVED_COLLECTIONS:
        extra = "" if name in counts else " (absent)"
        print(f"  {name:<24} {counts.get(name, 0):>6}{extra}")
    other = sorted(
        n for n in counts
        if n not in USER_OWNED_COLLECTIONS and n not in PRESERVED_COLLECTIONS
    )
    if other:
        print("\n--- Other collections (left untouched) ---")
        for name in other:
            print(f"  {name:<24} {counts.get(name, 0):>6}")


async def run(confirm: bool) -> int:
    guard()
    db = await connect()
    print(f"Target: {settings.MONGODB_URI.split('@')[-1]} / db='{settings.mongo_database}'")

    counts = await inspect(db)
    users = counts.get("users", 0)
    report(counts, future_tense=not confirm)

    if not confirm:
        print(f"\nDry run: {users} account(s) found. Re-run with --yes to permanently delete.")
        await disconnect()
        return 0

    if users == 0:
        print("\nNothing to delete: no user accounts exist.")
        await disconnect()
        return 0

    total: dict[str, int] = {}
    all_users = await db.find("users", {})
    for user in all_users:
        for collection, count in (await delete_account(db, user)).items():
            total[collection] = total.get(collection, 0) + count

    after = await inspect(db)
    report({k: v for k, v in after.items() if k in set(counts)}, future_tense=False)

    failures = [name for name in USER_OWNED_COLLECTIONS if after.get(name, 0) != 0]
    schemes = after.get("government_schemes", 0)
    print(f"\nDeleted {len(all_users)} account(s).")
    print(f"government_schemes preserved: {schemes} document(s).")
    if failures:
        print(f"ERROR: collections still holding records: {failures}")
        await disconnect()
        return 1
    print("Verification passed: zero accounts, zero orphaned user-owned records.")
    await disconnect()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Development-only: delete ALL user accounts and their data.",
        epilog="This permanently deletes development user data. Inspection-only by default.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Actually delete. Without this flag the script only reports what it would do.",
    )
    args = parser.parse_args()
    return asyncio.run(run(args.yes))


if __name__ == "__main__":
    sys.exit(main())
