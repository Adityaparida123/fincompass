"""Debt obligation and debt burden endpoints."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.db.models.consent import ConsentType
from app.db.mongo import MongoDatabase
from app.db.session import get_session
from app.schemas.debt import (
    DebtBurdenInput,
    DebtBurdenResult,
    DebtObligationCreate,
    DebtObligationRead,
    DebtObligationUpdate,
)
from app.services.consent.service import require_consent
from app.services.finance.debt import calculate_debt_burden
from app.services.recycle_bin.service import move_to_recycle_bin

router = APIRouter(prefix="/debt", tags=["debt"])


@router.get("", response_model=list[DebtObligationRead])
async def list_debts(
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> list[DebtObligationRead]:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    obligations = await db.find("debt_obligations", {"user_id": user.id}, sort=[("name", 1)])
    return [DebtObligationRead.model_validate(o) for o in obligations]


@router.post("", response_model=DebtObligationRead, status_code=201)
async def create_debt(
    data: DebtObligationCreate,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> DebtObligationRead:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    obligation = await db.insert("debt_obligations", {"user_id": user.id, **data.model_dump()})
    return DebtObligationRead.model_validate(obligation)


@router.patch("/{obligation_id}", response_model=DebtObligationRead)
async def update_debt(
    obligation_id: int,
    data: DebtObligationUpdate,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> DebtObligationRead:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    obligation = await db.find_one(
        "debt_obligations",
        {"id": obligation_id, "user_id": user.id},
    )
    if obligation is None:
        raise NotFoundError("Debt obligation not found.")
    await db.update_one(
        "debt_obligations",
        {"id": obligation_id, "user_id": user.id},
        data.model_dump(exclude_unset=True),
    )
    obligation = await db.find_one(
        "debt_obligations",
        {"id": obligation_id, "user_id": user.id},
    )
    return DebtObligationRead.model_validate(obligation)


@router.delete("/{obligation_id}", status_code=200)
async def delete_debt(
    obligation_id: int,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> dict:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    obligation = await db.find_one(
        "debt_obligations",
        {"id": obligation_id, "user_id": user.id},
    )
    if obligation is None:
        raise NotFoundError("Debt obligation not found.")
    await move_to_recycle_bin(db, user.id, "debt_obligation", obligation.id, obligation)
    return {"message": "Debt obligation moved to recycle bin."}


@router.post("/burden", response_model=DebtBurdenResult)
async def debt_burden(data: DebtBurdenInput) -> DebtBurdenResult:
    return calculate_debt_burden(data)
