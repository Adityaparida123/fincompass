"""Delete a user account and all associated data from MongoDB.

One-off admin script used to purge throwaway/test accounts (e.g. accounts
created against a live deployment while debugging) — same cascade logic as
``DELETE /api/v1/users/me``.

Usage:
    .venv/Scripts/python.exe scripts/delete_user.py --email someone@example.com

Environment:
    MONGODB_URI / MONGODB_DATABASE  target instance (default: repo .env)
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Make the repo importable when run as a plain script.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.mongo import connect, disconnect  # noqa: E402
from app.services.auth.service import get_user_by_email  # noqa: E402
from app.services.users.service import delete_account  # noqa: E402


async def run(email: str) -> int:
    db = await connect()
    user = await get_user_by_email(db, email)
    if user is None:
        print(f"No user found with email: {email}")
        return 1
    counts = await delete_account(db, user)
    print(f"Deleted account: {email} (user id {user.id})")
    for collection, count in sorted(counts.items()):
        print(f"  - {collection}: {count}")
    await disconnect()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True, help="Email of the account to delete.")
    args = parser.parse_args()
    return asyncio.run(run(args.email))


if __name__ == "__main__":
    sys.exit(main())
