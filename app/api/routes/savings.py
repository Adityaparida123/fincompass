"""Savings goals and emergency fund endpoints."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.db.enums import ConsentType, SavingsGoalStatus
from app.db.mongo import MongoDatabase
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
from app.services.recycle_bin.service import move_to_recycle_bin

router = APIRouter(prefix="/savings", tags=["savings"])


@router.get("/goals", response_model=list[SavingsGoalRead])
async def list_goals(
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> list[SavingsGoalRead]:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    goals = await db.find("savings_goals", {"user_id": user.id}, sort=[("created_at", 1)])
    return [SavingsGoalRead.model_validate(goal_to_read(g)) for g in goals]


@router.post("/goals", response_model=SavingsGoalRead, status_code=201)
async def create_goal(
    data: SavingsGoalCreate,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> SavingsGoalRead:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    goal = await db.insert(
        "savings_goals",
        {"user_id": user.id, **data.model_dump(), "status": SavingsGoalStatus.active.value},
    )
    return SavingsGoalRead.model_validate(goal_to_read(goal))


@router.patch("/goals/{goal_id}", response_model=SavingsGoalRead)
async def update_goal(
    goal_id: int,
    data: SavingsGoalUpdate,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> SavingsGoalRead:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    goal = await db.find_one("savings_goals", {"id": goal_id, "user_id": user.id})
    if goal is None:
        raise NotFoundError("Savings goal not found.")
    updates = data.model_dump(exclude_unset=True)
    if "status" in updates and hasattr(updates["status"], "value"):
        updates["status"] = updates["status"].value
    await db.update_one("savings_goals", {"id": goal_id, "user_id": user.id}, updates)
    goal = await db.find_one("savings_goals", {"id": goal_id, "user_id": user.id})
    return SavingsGoalRead.model_validate(goal_to_read(goal))


@router.delete("/goals/{goal_id}", status_code=200)
async def delete_goal(
    goal_id: int,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> dict:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    goal = await db.find_one("savings_goals", {"id": goal_id, "user_id": user.id})
    if goal is None:
        raise NotFoundError("Savings goal not found.")
    await move_to_recycle_bin(db, user.id, "savings_goal", goal.id, goal)
    return {"message": "Savings goal moved to recycle bin."}


@router.post("/emergency-buffer", response_model=EmergencyBufferResult)
async def emergency_buffer(data: EmergencyBufferInput) -> EmergencyBufferResult:
    return calculate_emergency_buffer(data)
