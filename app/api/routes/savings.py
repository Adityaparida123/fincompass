"""Savings goals and emergency fund endpoints."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.db.models.consent import ConsentType
from app.db.models.savings import SavingsGoal
from app.db.models.user import User
from app.db.session import get_session
from app.schemas.savings import (
    EmergencyBufferInput,
    EmergencyBufferResult,
    SavingsGoalCreate,
    SavingsGoalRead,
    SavingsGoalUpdate,
)
from app.services.consent.service import require_consent
from app.services.finance.emergency_fund import calculate_emergency_buffer
from app.services.finance.savings import goal_to_read

router = APIRouter(prefix="/savings", tags=["savings"])


@router.get("/goals", response_model=list[SavingsGoalRead])
async def list_goals(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[SavingsGoalRead]:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    stmt = select(SavingsGoal).where(SavingsGoal.user_id == user.id).order_by(SavingsGoal.created_at)
    goals = (await db.execute(stmt)).scalars().all()
    return [SavingsGoalRead.model_validate(goal_to_read(g)) for g in goals]


@router.post("/goals", response_model=SavingsGoalRead, status_code=201)
async def create_goal(
    data: SavingsGoalCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> SavingsGoalRead:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    goal = SavingsGoal(user_id=user.id, **data.model_dump())
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return SavingsGoalRead.model_validate(goal_to_read(goal))


@router.patch("/goals/{goal_id}", response_model=SavingsGoalRead)
async def update_goal(
    goal_id: int,
    data: SavingsGoalUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> SavingsGoalRead:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    stmt = select(SavingsGoal).where(SavingsGoal.id == goal_id, SavingsGoal.user_id == user.id)
    goal = (await db.execute(stmt)).scalar_one_or_none()
    if goal is None:
        raise NotFoundError("Savings goal not found.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    await db.commit()
    await db.refresh(goal)
    return SavingsGoalRead.model_validate(goal_to_read(goal))


@router.delete("/goals/{goal_id}", status_code=200)
async def delete_goal(
    goal_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    stmt = select(SavingsGoal).where(SavingsGoal.id == goal_id, SavingsGoal.user_id == user.id)
    goal = (await db.execute(stmt)).scalar_one_or_none()
    if goal is None:
        raise NotFoundError("Savings goal not found.")
    await db.delete(goal)
    await db.commit()
    return {"message": "Savings goal deleted."}


@router.post("/emergency-buffer", response_model=EmergencyBufferResult)
async def emergency_buffer(data: EmergencyBufferInput) -> EmergencyBufferResult:
    return calculate_emergency_buffer(data)
