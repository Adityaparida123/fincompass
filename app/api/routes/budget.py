"""Budget endpoints with data-driven recommendations."""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.db.models.budget import Budget
from app.db.models.consent import ConsentType
from app.db.models.user import User
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
from app.utils.dates import month_period_from_string

router = APIRouter(prefix="/budget", tags=["budget"])


@router.post("", response_model=BudgetRead, status_code=201)
async def create_budget(
    data: BudgetCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> BudgetRead:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    budget = Budget(user_id=user.id, **data.model_dump())
    db.add(budget)
    await db.commit()
    await db.refresh(budget)
    return BudgetRead.model_validate(budget)


@router.get("", response_model=list[BudgetRead])
async def get_budgets(
    period: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[BudgetRead]:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    budgets = await list_budgets(db, user.id, period)
    return [BudgetRead.model_validate(b) for b in budgets]


@router.patch("/{budget_id}", response_model=BudgetRead)
async def update_budget(
    budget_id: int,
    data: BudgetUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> BudgetRead:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    stmt = select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id)
    budget = (await db.execute(stmt)).scalar_one_or_none()
    if budget is None:
        raise NotFoundError("Budget not found.")
    budget.limit_amount = data.limit_amount
    await db.commit()
    await db.refresh(budget)
    return BudgetRead.model_validate(budget)


@router.delete("/{budget_id}", status_code=200)
async def delete_budget(
    budget_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    stmt = select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id)
    budget = (await db.execute(stmt)).scalar_one_or_none()
    if budget is None:
        raise NotFoundError("Budget not found.")
    await move_to_recycle_bin(db, user.id, "budget", budget.id, budget)
    await db.commit()
    return {"message": "Budget moved to recycle bin."}


@router.get("/status", response_model=list[BudgetStatus])
async def budget_status(
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[BudgetStatus]:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    start = month_period_from_string(period)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1, day=1)
    else:
        end = start.replace(month=start.month + 1, day=1)
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
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> BudgetRecommendations:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    target = month_period_from_string(period) if period else date.today().replace(day=1)
    recs = await build_recommendations(db, user.id, target)
    return BudgetRecommendations(period=target, recommendations=recs)
