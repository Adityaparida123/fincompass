"""Recycle bin endpoints."""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.db.models.budget import Budget
from app.db.models.debt import DebtObligation
from app.db.models.recycle_bin import RecycleBinItem
from app.db.models.savings import SavingsGoal, SavingsGoalStatus
from app.db.models.transaction import Transaction, TransactionSource, TransactionType
from app.db.models.user import User
from app.db.session import get_session
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

    message = "Item restored."

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
            db.add(
                Transaction(
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
            )
        message = "Transaction restored."
    elif item.resource_type == "budget":
        data = item.deleted_data or {}
        db.add(
            Budget(
                user_id=user.id,
                period=_parse_date(data.get("period")),
                category=data.get("category", "other"),
                limit_amount=_parse_decimal(data.get("limit_amount")),
            )
        )
        message = "Budget restored."
    elif item.resource_type == "debt_obligation":
        data = item.deleted_data or {}
        due = data.get("due_date")
        db.add(
            DebtObligation(
                user_id=user.id,
                name=data.get("name", "Restored debt"),
                principal=_parse_decimal(data.get("principal")),
                monthly_payment=_parse_decimal(data.get("monthly_payment")),
                interest_rate=_parse_decimal(data.get("interest_rate", "0")),
                remaining_balance=_parse_decimal(data.get("remaining_balance")),
                due_date=_parse_date(due) if due else None,
            )
        )
        message = "Debt obligation restored."
    elif item.resource_type == "savings_goal":
        data = item.deleted_data or {}
        target = data.get("target_date")
        db.add(
            SavingsGoal(
                user_id=user.id,
                name=data.get("name", "Restored goal"),
                target_amount=_parse_decimal(data.get("target_amount")),
                current_amount=_parse_decimal(data.get("current_amount", "0")),
                target_date=_parse_date(target) if target else None,
                status=SavingsGoalStatus(data.get("status", "active")),
            )
        )
        message = "Savings goal restored."
    else:
        raise NotFoundError(f"Unknown resource type '{item.resource_type}'.")

    await db.delete(item)
    await log_audit(
        db,
        action="recycle_bin.restore",
        resource_type="recycle_bin",
        user_id=user.id,
        resource_id=item_id,
    )
    await db.commit()
    return {"message": message}


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
