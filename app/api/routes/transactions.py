"""Transaction routes with soft delete to recycle bin."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.db.models.consent import ConsentType
from app.db.models.transaction import Transaction, TransactionSource, TransactionType
from app.db.models.user import User
from app.db.session import get_session
from app.schemas.common import Page
from app.schemas.transaction import TransactionCreate, TransactionRead, TransactionUpdate
from app.services.consent.service import require_consent
from app.services.finance.transactions import (
    create_transaction,
    get_transaction,
    update_transaction,
)
from app.services.recycle_bin.service import add_item, item_snapshot
from app.utils.pagination import paginate

router = APIRouter(prefix="/transactions", tags=["transactions"])


async def _require_financial_consent(db: AsyncSession, user_id: int) -> None:
    await require_consent(db, user_id, ConsentType.financial_data_analysis)


@router.post("", response_model=TransactionRead, status_code=201)
async def create_tx(
    data: TransactionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Transaction:
    await _require_financial_consent(db, user.id)
    tx = await create_transaction(db, user.id, data)
    await db.commit()
    return tx


@router.get("", response_model=Page[TransactionRead])
async def list_txs(
    transaction_type: TransactionType | None = None,
    category: str | None = None,
    start: date | None = None,
    end: date | None = None,
    source: TransactionSource | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    await _require_financial_consent(db, user.id)
    stmt = select(Transaction).where(Transaction.user_id == user.id, Transaction.is_deleted.is_(False))
    count_stmt = select(func.count()).select_from(Transaction).where(
        Transaction.user_id == user.id, Transaction.is_deleted.is_(False)
    )
    if transaction_type is not None:
        stmt = stmt.where(Transaction.transaction_type == transaction_type)
        count_stmt = count_stmt.where(Transaction.transaction_type == transaction_type)
    if category:
        stmt = stmt.where(Transaction.category == category)
        count_stmt = count_stmt.where(Transaction.category == category)
    if source is not None:
        stmt = stmt.where(Transaction.source == source)
        count_stmt = count_stmt.where(Transaction.source == source)
    if start:
        stmt = stmt.where(Transaction.date >= start)
        count_stmt = count_stmt.where(Transaction.date >= start)
    if end:
        stmt = stmt.where(Transaction.date <= end)
        count_stmt = count_stmt.where(Transaction.date <= end)

    total = int((await db.execute(count_stmt)).scalar_one())
    rows = (await db.execute(stmt.order_by(Transaction.date.desc(), Transaction.id.desc()).offset((page - 1) * page_size).limit(page_size))).scalars().all()
    items = [TransactionRead.model_validate(r) for r in rows]
    return paginate(items, total, page, page_size)


@router.get("/{transaction_id}", response_model=TransactionRead)
async def get_tx(
    transaction_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> TransactionRead:
    await _require_financial_consent(db, user.id)
    stmt = select(Transaction).where(
        Transaction.id == transaction_id,
        Transaction.user_id == user.id,
        Transaction.is_deleted.is_(False),
    )
    tx = (await db.execute(stmt)).scalar_one_or_none()
    if tx is None:
        raise NotFoundError("Transaction not found.")
    return TransactionRead.model_validate(tx)


@router.patch("/{transaction_id}", response_model=TransactionRead)
async def patch_tx(
    transaction_id: int,
    data: TransactionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> TransactionRead:
    await _require_financial_consent(db, user.id)
    tx = await update_transaction(db, user.id, transaction_id, data)
    await db.commit()
    return TransactionRead.model_validate(tx)


@router.delete("/{transaction_id}", status_code=200)
async def delete_tx(
    transaction_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    await _require_financial_consent(db, user.id)
    tx = await get_transaction(db, user.id, transaction_id)
    snapshot = item_snapshot("transaction", tx)
    tx.is_deleted = True
    await db.flush()
    await add_item(db, user.id, "transaction", tx.id, snapshot)
    await db.commit()
    return {"message": "Transaction moved to recycle bin.", "recycle_id": tx.id}
