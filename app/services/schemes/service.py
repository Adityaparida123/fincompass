"""Scheme service: seeding and lookup."""

import logging

from app.core.exceptions import NotFoundError
from app.db.mongo import Doc, MongoDatabase
from app.services.schemes.matcher import list_schemes

logger = logging.getLogger(__name__)


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


async def migrate_scheme_urls(db: MongoDatabase) -> int:
    """Update source_url for schemes whose URLs have changed in seed_schemes.py.

    This runs at every startup and is idempotent — only touches schemes
    whose seed URL differs from the current database value.
    """
    from app.knowledge.seed_schemes import SEED_SCHEMES

    url_map: dict[str, str] = {s["name"]: s["source_url"] for s in SEED_SCHEMES}
    updated = 0
    for name, new_url in url_map.items():
        doc = await db.find_one("government_schemes", {"name": name})
        if doc and doc.get("source_url") != new_url:
            await db.update_one(
                "government_schemes",
                {"name": name},
                {"source_url": new_url},
            )
            logger.info("Updated source_url for scheme: %s", name)
            updated += 1
    return updated
