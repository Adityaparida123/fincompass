"""Budget endpoints with data-driven recommendations."""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_current_user
from app.core.exceptions import ConflictError, NotFoundError
from app.db.enums import ConsentType
from app.db.mongo import MongoDatabase
from app.db.session import get_session
from app.schemas.budget import (
    BudgetCreate,
    BudgetRead,
    BudgetRecommendations,
    BudgetStatus,
    BudgetUpdate,
)
from app.services.consent.service import require_consent
from app.services.finance.budget import (
    build_recommendations,
    category_spend,
    list_budgets,
)
from app.services.recycle_bin.service import move_to_recycle_bin
from app.utils.dates import month_bounds, month_period_from_string

router = APIRouter(prefix="/budget", tags=["budget"])


@router.post("", response_model=BudgetRead, status_code=201)
async def create_budget(
    data: BudgetCreate,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> BudgetRead:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    period_date = month_period_from_string(data.period.isoformat()[:7])
    existing = await db.find_one(
        "budgets",
        {"user_id": user.id, "period": period_date, "category": data.category},
    )
    if existing is not None:
        raise ConflictError(
            f"A budget for '{data.category}' already exists for this period."
        )
    budget = await db.insert(
        "budgets",
        {"user_id": user.id, "period": period_date, **data.model_dump(exclude={"period"})},
    )
    return BudgetRead.model_validate(budget)


@router.get("", response_model=list[BudgetRead])
async def get_budgets(
    period: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> list[BudgetRead]:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    budgets = await list_budgets(db, user.id, period)
    return [BudgetRead.model_validate(b) for b in budgets]


@router.patch("/{budget_id}", response_model=BudgetRead)
async def update_budget(
    budget_id: int,
    data: BudgetUpdate,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> BudgetRead:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    budget = await db.find_one("budgets", {"id": budget_id, "user_id": user.id})
    if budget is None:
        raise NotFoundError("Budget not found.")
    await db.update_one(
        "budgets",
        {"id": budget_id, "user_id": user.id},
        {"limit_amount": data.limit_amount},
    )
    updated = await db.find_one("budgets", {"id": budget_id, "user_id": user.id})
    if updated is None:
        raise NotFoundError("Budget not found.")
    return BudgetRead.model_validate(updated)


@router.delete("/{budget_id}", status_code=200)
async def delete_budget(
    budget_id: int,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> dict:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    budget = await db.find_one("budgets", {"id": budget_id, "user_id": user.id})
    if budget is None:
        raise NotFoundError("Budget not found.")
    await move_to_recycle_bin(db, user.id, "budget", budget.id, budget)
    return {"message": "Budget moved to recycle bin."}


@router.get("/status", response_model=list[BudgetStatus])
async def budget_status(
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> list[BudgetStatus]:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    start = month_period_from_string(period)
    start, end = month_bounds(start.year, start.month)
    budgets = await list_budgets(db, user.id, period)
    statuses: list[BudgetStatus] = []
    for b in budgets:
        spent = await category_spend(db, user.id, b.category, start, end)
        percent = (spent / b.limit_amount * 100).quantize(Decimal("0.01")) if b.limit_amount else 0
        statuses.append(
            BudgetStatus(
                id=b.id,
                period=b.period,
                category=b.category,
                limit_amount=b.limit_amount,
                spent=spent,
                remaining=b.limit_amount - spent,
                percent_used=percent,
            )
        )
    return statuses


@router.get("/recommendations", response_model=BudgetRecommendations)
async def budget_recommendations(
    period: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> BudgetRecommendations:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    target = month_period_from_string(period) if period else date.today().replace(day=1)
    recs = await build_recommendations(db, user.id, target)
    return BudgetRecommendations(period=target, recommendations=recs)
