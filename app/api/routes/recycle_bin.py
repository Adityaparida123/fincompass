"""Recycle bin endpoints."""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.db.models.recycle_bin import RecycleBinItem
from app.db.models.transaction import Transaction, TransactionSource, TransactionType
from app.db.models.user import User
from app.db.session import get_session
from app.schemas.transaction import TransactionCreate
from app.services.audit import log_audit
from app.services.recycle_bin.service import list_items, remove_item

router = APIRouter(prefix="/recycle-bin", tags=["recycle bin"])


@router.get("", response_model=list[dict])
async def get_items(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[dict]:
    items = await list_items(db, user.id)
    return [_serialize(i) for i in items]


@router.post("/{item_id}/restore", status_code=200)
async def restore(
    item_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    stmt = select(RecycleBinItem).where(
        RecycleBinItem.id == item_id, RecycleBinItem.user_id == user.id
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if item is None:
        raise NotFoundError("Recycle bin item not found.")

    if item.resource_type == "transaction":
        tx_id = int(item.resource_id)
        tx_stmt = select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.user_id == user.id,
        )
        tx = (await db.execute(tx_stmt)).scalar_one_or_none()
        if tx is not None:
            tx.is_deleted = False
        else:
            data = item.deleted_data or {}
            tx = Transaction(
                user_id=user.id,
                date=_parse_date(data.get("date")),
                description=data.get("description", "Restored transaction"),
                amount=_parse_decimal(data.get("amount")),
                currency=data.get("currency", "INR"),
                transaction_type=TransactionType(data.get("transaction_type", "expense")),
                category=data.get("category", "other"),
                subcategory=data.get("subcategory"),
                source=TransactionSource(data.get("source", TransactionSource.manual.value)),
                is_deleted=False,
            )
            db.add(tx)
    elif item.resource_type in ("budget", "debt_obligation", "savings_goal"):
        data = item.deleted_data or {}
        return {"message": f"Restore of '{item.resource_type}' is not supported yet."}
    else:
        return {"message": f"Unknown resource type '{item.resource_type}'."}

    await db.delete(item)
    await log_audit(
        db,
        action="recycle_bin.restore",
        resource_type="recycle_bin",
        user_id=user.id,
        resource_id=item_id,
    )
    await db.commit()
    return {"message": "Transaction restored."}


@router.delete("/{item_id}", status_code=200)
async def delete_item(
    item_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    await remove_item(db, user.id, item_id)
    await db.commit()
    return {"message": "Recycle bin item permanently deleted."}


def _serialize(item: RecycleBinItem) -> dict:
    return {
        "id": item.id,
        "resource_type": item.resource_type,
        "resource_id": item.resource_id,
        "deleted_at": item.deleted_at.isoformat() if item.deleted_at else None,
        "deleted_data": item.deleted_data,
    }


def _parse_date(value) -> date:
    from datetime import date as date_type

    if isinstance(value, date_type):
        return value
    if isinstance(value, str):
        return date_type.fromisoformat(value)
    raise NotFoundError("Invalid date in recycle bin snapshot.")


def _parse_decimal(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if value is None:
        raise NotFoundError("Invalid amount in recycle bin snapshot.")
    return Decimal(str(value))
