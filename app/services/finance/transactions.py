"""Transaction CRUD service."""

from datetime import date
from decimal import Decimal

from app.core.cache import invalidate_user_financial_cache
from app.core.exceptions import NotFoundError
from app.db.enums import TransactionSource, TransactionType
from app.db.mongo import Doc, MongoDatabase
from app.schemas.transaction import TransactionCreate, TransactionUpdate


async def create_transaction(
    db: MongoDatabase, user_id: int, data: TransactionCreate
) -> Doc:
    tx = await db.insert(
        "transactions",
        {
            "user_id": user_id,
            "date": data.date,
            "description": data.description,
            "amount": data.amount,
            "currency": data.currency,
            "transaction_type": data.transaction_type.value,
            "category": data.category,
            "subcategory": data.subcategory,
            "source": data.source.value,
            "is_deleted": False,
        },
    )
    await invalidate_user_financial_cache(user_id)
    return tx


async def get_transaction(
    db: MongoDatabase, user_id: int, transaction_id: int
) -> Doc:
    tx = await db.find_one(
        "transactions",
        {"id": transaction_id, "user_id": user_id, "is_deleted": False},
    )
    if tx is None:
        raise NotFoundError("Transaction not found.")
    return tx


async def update_transaction(
    db: MongoDatabase, user_id: int, transaction_id: int, data: TransactionUpdate
) -> Doc:
    tx = await get_transaction(db, user_id, transaction_id)
    updates = data.model_dump(exclude_unset=True)
    if "transaction_type" in updates and hasattr(updates["transaction_type"], "value"):
        updates["transaction_type"] = updates["transaction_type"].value
    if "source" in updates and hasattr(updates["source"], "value"):
        updates["source"] = updates["source"].value
    await db.update_one("transactions", {"id": tx.id, "user_id": user_id}, updates)
    await invalidate_user_financial_cache(user_id)
    return await get_transaction(db, user_id, transaction_id)


async def soft_delete_transaction(
    db: MongoDatabase, user_id: int, transaction_id: int
) -> Doc:
    tx = await get_transaction(db, user_id, transaction_id)
    await db.update_one(
        "transactions",
        {"id": tx.id, "user_id": user_id},
        {"is_deleted": True},
    )
    tx.is_deleted = True
    await invalidate_user_financial_cache(user_id)
    return tx


def transaction_filter(
    user_id: int,
    *,
    transaction_type: TransactionType | None = None,
    category: str | None = None,
    start: date | None = None,
    end: date | None = None,
    source: TransactionSource | None = None,
) -> dict:
    filt: dict = {"user_id": user_id, "is_deleted": False}
    if transaction_type is not None:
        filt["transaction_type"] = transaction_type.value
    if category:
        filt["category"] = category
    if source is not None:
        filt["source"] = source.value
    if start:
        filt["date"] = {"$gte": start}
    if end:
        filt["date"] = {"$lte": end}
    return filt


def amount_in_range(
    amount: Decimal,
    *,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
) -> bool:
    if min_amount is not None and amount < min_amount:
        return False
    if max_amount is not None and amount > max_amount:
        return False
    return True


async def count_transactions(
    db: MongoDatabase,
    user_id: int,
    *,
    start: date | None = None,
    end: date | None = None,
) -> int:
    filt = transaction_filter(user_id, start=start, end=end)
    return await db.count("transactions", filt)
