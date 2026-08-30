"""Financial health service: compute, persist, and surface health scores."""

from datetime import UTC, datetime

from app.db.mongo import Doc, MongoDatabase
from app.schemas.health import FinancialHealthResult
from app.services.audit import log_audit
from app.services.health.engine import VERSION, compute_health
from app.services.notifications import notify
from app.services.readiness.factors import build_readiness_input


async def latest_score(db: MongoDatabase, user_id: int) -> Doc | None:
    scores = await db.find(
        "financial_health_scores",
        {"user_id": user_id},
        sort=[("calculated_at", -1)],
        limit=1,
    )
    return scores[0] if scores else None


async def get_current_health_score(db: MongoDatabase, user_id: int) -> FinancialHealthResult:
    """Compute (and persist) the user's current financial health score."""
    data = await build_readiness_input(db, user_id)
    result = compute_health(data)

    previous = await latest_score(db, user_id)
    previous_value = previous.score if previous else None
    change = None
    if previous_value is not None:
        change = result.score - previous_value

    result.previous_score = previous_value
    result.change = change

    score_row = await db.insert(
        "financial_health_scores",
        {
            "user_id": user_id,
            "score": result.score,
            "label": result.label,
            "version": VERSION,
            "calculated_at": datetime.now(UTC),
            "previous_score": previous_value,
            "change": change,
        },
    )

    for factor in result.factors:
        await db.insert(
            "financial_health_factors",
            {
                "health_score_id": score_row.id,
                "factor_name": factor.name,
                "score": factor.score,
                "weight": factor.weight,
                "direction": factor.direction,
                "explanation": factor.explanation,
                "value": factor.value,
            },
        )

    await log_audit(
        db,
        action="health.compute",
        resource_type="financial_health_score",
        user_id=user_id,
        resource_id=score_row.id,
        metadata={
            "score": result.score,
            "previous": previous_value,
            "change": change,
        },
    )

    if previous_value is not None and change is not None and abs(change) >= 5:
        await notify(
            db,
            user_id,
            title="Financial health updated",
            message=(
                f"Your financial health score changed from {previous_value} "
                f"to {result.score}/100 ({_trend_text(change)}). {result.summary}"
            ),
            ntype="health_changed",
        )

    return result


def _trend_text(change: int) -> str:
    return "improved" if change > 0 else "slipped"
