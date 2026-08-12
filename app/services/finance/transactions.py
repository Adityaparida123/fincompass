"""Transaction CRUD service."""

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.transaction import Transaction, TransactionSource, TransactionType
from app.schemas.transaction import TransactionCreate, TransactionUpdate


async def create_transaction(
    db: AsyncSession, user_id: int, data: TransactionCreate
) -> Transaction:
    tx = Transaction(
        user_id=user_id,
        date=data.date,
        description=data.description,
        amount=data.amount,
        currency=data.currency,
        transaction_type=data.transaction_type,
        category=data.category,
        subcategory=data.subcategory,
        source=data.source,
    )
    db.add(tx)
    await db.flush()
    return tx


async def get_transaction(
    db: AsyncSession, user_id: int, transaction_id: int
) -> Transaction:
    stmt = select(Transaction).where(
        Transaction.id == transaction_id,
        Transaction.user_id == user_id,
        Transaction.is_deleted.is_(False),
    )
    tx = (await db.execute(stmt)).scalar_one_or_none()
    if tx is None:
        raise NotFoundError("Transaction not found.")
    return tx


async def update_transaction(
    db: AsyncSession, user_id: int, transaction_id: int, data: TransactionUpdate
) -> Transaction:
    tx = await get_transaction(db, user_id, transaction_id)
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(tx, field, value)
    await db.flush()
    return tx


async def soft_delete_transaction(
    db: AsyncSession, user_id: int, transaction_id: int
) -> Transaction:
    tx = await get_transaction(db, user_id, transaction_id)
    tx.is_deleted = True
    await db.flush()
    return tx


def transaction_filter_stmt(
    user_id: int,
    *,
    transaction_type: TransactionType | None = None,
    category: str | None = None,
    start: date | None = None,
    end: date | None = None,
    source: TransactionSource | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
):
    stmt = select(Transaction).where(
        Transaction.user_id == user_id,
        Transaction.is_deleted.is_(False),
    )
    if transaction_type is not None:
        stmt = stmt.where(Transaction.transaction_type == transaction_type)
    if category:
        stmt = stmt.where(Transaction.category == category)
    if source is not None:
        stmt = stmt.where(Transaction.source == source)
    if start:
        stmt = stmt.where(Transaction.date >= start)
    if end:
        stmt = stmt.where(Transaction.date <= end)
    if min_amount is not None:
        stmt = stmt.where(Transaction.amount >= min_amount)
    if max_amount is not None:
        stmt = stmt.where(Transaction.amount <= max_amount)
    return stmt


async def count_transactions(
    db: AsyncSession,
    user_id: int,
    *,
    start: date | None = None,
    end: date | None = None,
) -> int:
    stmt = select(func.count()).select_from(Transaction).where(
        Transaction.user_id == user_id,
        Transaction.is_deleted.is_(False),
    )
    if start:
        stmt = stmt.where(Transaction.date >= start)
    if end:
        stmt = stmt.where(Transaction.date <= end)
    return int((await db.execute(stmt)).scalar_one())
