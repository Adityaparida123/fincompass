"""Debt obligation and debt burden endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.db.models.consent import ConsentType
from app.db.models.debt import DebtObligation
from app.db.models.user import User
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

router = APIRouter(prefix="/debt", tags=["debt"])


@router.get("", response_model=list[DebtObligationRead])
async def list_debts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[DebtObligationRead]:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    stmt = select(DebtObligation).where(DebtObligation.user_id == user.id).order_by(DebtObligation.name)
    obligations = (await db.execute(stmt)).scalars().all()
    return [DebtObligationRead.model_validate(o) for o in obligations]


@router.post("", response_model=DebtObligationRead, status_code=201)
async def create_debt(
    data: DebtObligationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> DebtObligationRead:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    obligation = DebtObligation(user_id=user.id, **data.model_dump())
    db.add(obligation)
    await db.commit()
    await db.refresh(obligation)
    return DebtObligationRead.model_validate(obligation)


@router.patch("/{obligation_id}", response_model=DebtObligationRead)
async def update_debt(
    obligation_id: int,
    data: DebtObligationUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> DebtObligationRead:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    stmt = select(DebtObligation).where(
        DebtObligation.id == obligation_id, DebtObligation.user_id == user.id
    )
    obligation = (await db.execute(stmt)).scalar_one_or_none()
    if obligation is None:
        raise NotFoundError("Debt obligation not found.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obligation, field, value)
    await db.commit()
    await db.refresh(obligation)
    return DebtObligationRead.model_validate(obligation)


@router.delete("/{obligation_id}", status_code=200)
async def delete_debt(
    obligation_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    stmt = select(DebtObligation).where(
        DebtObligation.id == obligation_id, DebtObligation.user_id == user.id
    )
    obligation = (await db.execute(stmt)).scalar_one_or_none()
    if obligation is None:
        raise NotFoundError("Debt obligation not found.")
    await db.delete(obligation)
    await db.commit()
    return {"message": "Debt obligation deleted."}


@router.post("/burden", response_model=DebtBurdenResult)
async def debt_burden(data: DebtBurdenInput) -> DebtBurdenResult:
    return calculate_debt_burden(data)
