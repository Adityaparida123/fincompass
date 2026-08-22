"""Government scheme matcher.

Matches users to schemes on a heuristic basis (income ceilings, age, category
keywords). Every match is labelled as "potentially eligible" and never
guaranteed; official verification is always required.
"""

from decimal import Decimal

from app.db.mongo import Doc, MongoDatabase
from app.schemas.scheme import SchemeMatch, SchemeMatchInput, SchemeRead


def _to_read(scheme: Doc) -> SchemeRead:
    return SchemeRead(
        id=scheme.id,
        name=scheme.name,
        description=scheme.description,
        jurisdiction=scheme.jurisdiction,
        eligibility=scheme.eligibility,
        benefits=scheme.benefits,
        source_url=scheme.source_url,
        last_verified=scheme.last_verified,
        active=scheme.active,
        category=getattr(scheme, "category", None),
    )


def _score_scheme(scheme: Doc, data: SchemeMatchInput) -> tuple[Decimal, list[str]]:
    score = Decimal("0")
    reasons: list[str] = []

    if scheme.income_ceiling is not None and data.income is not None:
        if data.income <= scheme.income_ceiling:
            score += Decimal("2")
            reasons.append(f"income within ceiling of {scheme.income_ceiling:,.0f}")

    if data.age is not None:
        low = _age_low(scheme)
        high = _age_high(scheme)
        if low is not None and high is not None and low <= data.age <= high:
            score += Decimal("1.5")
            reasons.append(f"age within {low}-{high}")
        elif low is not None and data.age >= low:
            score += Decimal("1")
            reasons.append("age satisfies minimum")

    if data.location_state:
        eligibility_lower = scheme.eligibility.lower()
        if data.location_state.lower() in eligibility_lower:
            score += Decimal("1.5")
            reasons.append("jurisdiction/state referenced in eligibility")

    if data.occupation:
        occ = data.occupation.lower()
        if occ in scheme.eligibility.lower() or occ in scheme.category.lower() or occ in scheme.name.lower():
            score += Decimal("1.5")
            reasons.append("occupation matches scheme scope")

    for kw in data.special_eligibility:
        if kw.lower() in scheme.eligibility.lower() or kw.lower() in scheme.name.lower():
            score += Decimal("1")
            reasons.append(f"keyword '{kw}' matches")

    return score, reasons


def _age_low(scheme: Doc) -> int | None:
    text = f"{scheme.eligibility} {scheme.description}".lower()
    for token, value in (("18 years", 18), ("18 years and above", 18), ("above 18", 18)):
        if token in text:
            return value
    return None


def _age_high(scheme: Doc) -> int | None:
    text = f"{scheme.eligibility} {scheme.description}".lower()
    for token, value in (("60 years", 60), ("below 60", 60), ("60 to", 60)):
        if token in text:
            return value
    return None


async def list_schemes(
    db: MongoDatabase, *, jurisdiction: str | None = None, active_only: bool = True
) -> list[Doc]:
    filt: dict = {}
    if jurisdiction:
        filt["jurisdiction"] = jurisdiction
    if active_only:
        filt["active"] = True
    return await db.find("government_schemes", filt, sort=[("name", 1)])


async def match_schemes(db: MongoDatabase, data: SchemeMatchInput) -> list[SchemeMatch]:
    schemes = await list_schemes(db)
    scored: list[tuple[Decimal, Doc, list[str]]] = []
    for scheme in schemes:
        score, reasons = _score_scheme(scheme, data)
        if score > 0:
            scored.append((score, scheme, reasons))

    scored.sort(key=lambda item: item[0], reverse=True)
    matches: list[SchemeMatch] = []
    for _score, scheme, reasons in scored[:10]:
        reason = "; ".join(reasons) if reasons else "Possible alignment with scheme objectives."
        matches.append(
            SchemeMatch(
                scheme=_to_read(scheme),
                match_reason=reason,
                confidence="potential",
            )
        )
    return matches
