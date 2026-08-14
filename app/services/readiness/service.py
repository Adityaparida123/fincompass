"""Readiness service: compute, persist, and correct credit readiness scores."""

from datetime import UTC, datetime

from app.db.mongo import Doc, MongoDatabase
from app.schemas.readiness import ReadinessFactorOut, ReadinessResult, ScoreCorrectionResult
from app.services.audit import log_audit
from app.services.readiness.engine import VERSION, ReadinessInput, compute_readiness
from app.services.readiness.factors import build_readiness_input


async def get_current_readiness(db: MongoDatabase, user_id: int) -> ReadinessResult:
    score = await latest_score(db, user_id)
    if score is not None:
        factors = await load_factors(db, score.id)
        return _build_result(score.score, factors)
    return await compute_and_store(db, user_id)


async def latest_score(db: MongoDatabase, user_id: int) -> Doc | None:
    scores = await db.find(
        "readiness_scores",
        {"user_id": user_id},
        sort=[("created_at", -1)],
        limit=1,
    )
    return scores[0] if scores else None


async def load_factors(db: MongoDatabase, score_id: int) -> list[Doc]:
    return await db.find("readiness_factors", {"readiness_score_id": score_id})


async def compute_and_store(
    db: MongoDatabase, user_id: int, *, input_override: ReadinessInput | None = None
) -> ReadinessResult:
    data = input_override or await build_readiness_input(db, user_id)
    result = compute_readiness(data)

    previous = await latest_score(db, user_id)
    previous_value = previous.score if previous else None

    score_row = await db.insert(
        "readiness_scores",
        {
            "user_id": user_id,
            "score": result.score,
            "version": VERSION,
            "model_version": VERSION,
            "feature_version": VERSION,
            "calculated_at": datetime.now(UTC),
            "previous_score": previous_value,
        },
    )

    for factor in result.factors:
        await db.insert(
            "readiness_factors",
            {
                "readiness_score_id": score_row.id,
                "factor_name": factor.name,
                "impact": factor.impact,
                "direction": factor.direction,
                "explanation": factor.explanation,
                "value": factor.value,
            },
        )

    await log_audit(
        db,
        action="readiness.compute",
        resource_type="readiness_score",
        user_id=user_id,
        resource_id=score_row.id,
        metadata={"score": result.score, "previous": previous_value},
    )
    return result


def _build_result(score: int, factors: list[Doc]) -> ReadinessResult:
    return ReadinessResult(
        score=score,
        version=VERSION,
        factors=[_factor_out(f) for f in factors],
        summary=_summary_text(score),
    )


def _factor_out(f: Doc) -> ReadinessFactorOut:
    return ReadinessFactorOut(
        name=f.factor_name,
        impact=f.impact,
        direction=f.direction,
        explanation=f.explanation,
        value=f.value,
    )


def _summary_text(score: int) -> str:
    if score >= 75:
        return "Strong financial foundation with healthy buffers and low debt pressure."
    if score >= 50:
        return "Reasonable financial position; strengthening savings and buffers would help."
    return "Financial position is tight; focus on budgeting, savings, and reducing debt pressure before considering credit."


async def correct_score(
    db: MongoDatabase, user_id: int, updated: ReadinessInput, reason: str
) -> ScoreCorrectionResult:
    previous_result = await get_current_readiness(db, user_id)

    result = compute_readiness(updated)

    score_row = await db.insert(
        "readiness_scores",
        {
            "user_id": user_id,
            "score": result.score,
            "version": VERSION,
            "model_version": VERSION,
            "feature_version": VERSION,
            "calculated_at": datetime.now(UTC),
            "previous_score": previous_result.score,
            "change_reason": reason,
        },
    )

    changed: list[ReadinessFactorOut] = []
    prev_by_name = {f.name: f.impact for f in previous_result.factors}
    for factor in result.factors:
        await db.insert(
            "readiness_factors",
            {
                "readiness_score_id": score_row.id,
                "factor_name": factor.name,
                "impact": factor.impact,
                "direction": factor.direction,
                "explanation": factor.explanation,
                "value": factor.value,
            },
        )
        if prev_by_name.get(factor.name) != factor.impact:
            changed.append(factor)

    await log_audit(
        db,
        action="readiness.correct",
        resource_type="readiness_score",
        user_id=user_id,
        resource_id=score_row.id,
        metadata={
            "previous_score": previous_result.score,
            "updated_score": result.score,
            "reason": reason,
        },
    )

    return ScoreCorrectionResult(
        previous_score=previous_result.score,
        updated_score=result.score,
        changed_factors=changed,
        reason=reason,
        version=VERSION,
    )
