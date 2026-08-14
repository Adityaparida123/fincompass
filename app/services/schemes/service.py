"""Scheme service: seeding and lookup."""

from app.core.exceptions import NotFoundError
from app.db.mongo import Doc, MongoDatabase
from app.services.schemes.matcher import list_schemes


async def get_scheme(db: MongoDatabase, scheme_id: int) -> Doc:
    scheme = await db.find_one("government_schemes", {"id": scheme_id})
    if scheme is None:
        raise NotFoundError("Scheme not found.")
    return scheme


async def ensure_seed_schemes(db: MongoDatabase) -> int:
    """Seed reference schemes from the bundled knowledge base if empty."""
    existing = await list_schemes(db, active_only=False)
    if existing:
        return 0
    from app.knowledge.seed_schemes import SEED_SCHEMES

    await db.insert_many("government_schemes", list(SEED_SCHEMES))
    return len(SEED_SCHEMES)
