"""MongoDB-backed database dependency.

Kept under the historical module name so routes, tests, and tooling that do
``from app.db.session import get_session`` keep working after the migration.
"""

from app.db.mongo import get_db, get_session

__all__ = ["get_db", "get_session"]
