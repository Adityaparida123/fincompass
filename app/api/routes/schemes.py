"""Government scheme endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.scheme import SchemeMatchInput, SchemeMatchResult, SchemeRead
from app.services.schemes.matcher import list_schemes, match_schemes

router = APIRouter(prefix="/schemes", tags=["schemes"])


@router.get("", response_model=list[SchemeRead])
async def get_schemes(
    jurisdiction: str | None = None,
    db: AsyncSession = Depends(get_session),
) -> list[SchemeRead]:
    schemes = await list_schemes(db, jurisdiction=jurisdiction)
    return [
        SchemeRead(
            id=s.id,
            name=s.name,
            description=s.description,
            jurisdiction=s.jurisdiction,
            eligibility=s.eligibility,
            benefits=s.benefits,
            source_url=s.source_url,
            last_verified=s.last_verified,
            active=s.active,
        )
        for s in schemes
    ]


@router.post("/match", response_model=SchemeMatchResult)
async def match(
    data: SchemeMatchInput,
    db: AsyncSession = Depends(get_session),
) -> SchemeMatchResult:
    matches = await match_schemes(db, data)
    return SchemeMatchResult(matches=matches)
