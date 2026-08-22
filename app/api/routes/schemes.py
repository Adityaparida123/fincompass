"""Government scheme endpoints."""

from decimal import Decimal

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.core.exceptions import ConsentDeniedError
from app.db.enums import ConsentType
from app.db.mongo import Doc, MongoDatabase
from app.db.session import get_session
from app.schemas.scheme import SchemeMatchInput, SchemeMatchResult, SchemeRead
from app.services.consent.service import require_consent
from app.services.schemes.matcher import list_schemes, match_schemes

router = APIRouter(prefix="/schemes", tags=["schemes"])


@router.get("", response_model=list[SchemeRead])
async def get_schemes(
    jurisdiction: str | None = None,
    db: MongoDatabase = Depends(get_session),
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
            category=getattr(s, "category", None),
        )
        for s in schemes
    ]


@router.post("/match", response_model=SchemeMatchResult)
async def match(
    data: SchemeMatchInput,
    db: MongoDatabase = Depends(get_session),
) -> SchemeMatchResult:
    matches = await match_schemes(db, data)
    return SchemeMatchResult(matches=matches)


@router.post("/recommended", response_model=SchemeMatchResult)
async def recommended(
    db: MongoDatabase = Depends(get_session),
    user: Doc = Depends(get_current_user),
) -> SchemeMatchResult:
    """Scheme suggestions based on the user's business profile.

    Uses only the profile fields the user chose to save (business type,
    state) plus recorded income when financial-analysis consent is granted.
    Matches are always labelled "potential" and never guaranteed.
    """
    business = getattr(user, "business", None) or {}
    business_type = business.get("business_type")
    special: list[str] = []
    if business_type:
        special.append(str(business_type))
    if business.get("seasonal"):
        special.append("seasonal")

    input_data = SchemeMatchInput(
        location_state=business.get("state"),
        occupation=business_type,
        special_eligibility=special,
    )

    try:
        await require_consent(db, user.id, ConsentType.financial_data_analysis)
        from app.services.readiness.factors import build_readiness_input

        readiness = await build_readiness_input(db, user.id)
        if readiness.income > 0:
            input_data.income = Decimal(readiness.income)
    except ConsentDeniedError:
        pass  # profile-only matching is still useful without income

    matches = await match_schemes(db, input_data)
    return SchemeMatchResult(matches=matches)
