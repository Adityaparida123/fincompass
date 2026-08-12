"""Scheme service: seeding and lookup."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.scheme import GovernmentScheme
from app.services.schemes.matcher import list_schemes


async def get_scheme(db: AsyncSession, scheme_id: int) -> GovernmentScheme:
    stmt = select(GovernmentScheme).where(GovernmentScheme.id == scheme_id)
    scheme = (await db.execute(stmt)).scalar_one_or_none()
    if scheme is None:
        raise NotFoundError("Scheme not found.")
    return scheme


async def ensure_seed_schemes(db: AsyncSession) -> int:
    """Seed reference schemes from the bundled knowledge base if empty."""
    existing = await list_schemes(db, active_only=False)
    if existing:
        return 0
    from app.knowledge.seed_schemes import SEED_SCHEMES

    for item in SEED_SCHEMES:
        db.add(GovernmentScheme(**item))
    await db.flush()
    return len(SEED_SCHEMES)
