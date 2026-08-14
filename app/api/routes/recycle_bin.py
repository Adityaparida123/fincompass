"""Recycle bin endpoints."""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.db.mongo import Doc, MongoDatabase
from app.db.session import get_session
from app.services.audit import log_audit
from app.services.recycle_bin.service import list_items, remove_item

router = APIRouter(prefix="/recycle-bin", tags=["recycle bin"])


@router.get("", response_model=list[dict])
async def get_items(
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> list[dict]:
    items = await list_items(db, user.id)
    return [_serialize(i) for i in items]


@router.post("/{item_id}/restore", status_code=200)
async def restore(
    item_id: int,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> dict:
    item = await db.find_one("recycle_bin", {"id": item_id, "user_id": user.id})
    if item is None:
        raise NotFoundError("Recycle bin item not found.")

    message = "Item restored."
    data = item.deleted_data or {}
    resource_type = item.resource_type

    if resource_type == "transaction":
        existing = await db.find_one(
            "transactions",
            {"id": int(item.resource_id), "user_id": user.id},
        )
        if existing is not None:
            await db.update_one(
                "transactions",
                {"id": existing.id, "user_id": user.id},
                {"is_deleted": False},
            )
        else:
            await db.insert(
                "transactions",
                {
                    "user_id": user.id,
                    "date": _parse_date(data.get("date")),
                    "description": data.get("description", "Restored transaction"),
                    "amount": _parse_decimal(data.get("amount")),
                    "currency": data.get("currency", "INR"),
                    "transaction_type": data.get("transaction_type", "expense"),
                    "category": data.get("category", "other"),
                    "subcategory": data.get("subcategory"),
                    "source": data.get("source", "manual"),
                    "is_deleted": False,
                },
            )
        message = "Transaction restored."
    elif resource_type == "budget":
        await db.insert(
            "budgets",
            {
                "user_id": user.id,
                "period": _parse_date(data.get("period")),
                "category": data.get("category", "other"),
                "limit_amount": _parse_decimal(data.get("limit_amount")),
            },
        )
        message = "Budget restored."
    elif resource_type == "debt_obligation":
        due = data.get("due_date")
        await db.insert(
            "debt_obligations",
            {
                "user_id": user.id,
                "name": data.get("name", "Restored debt"),
                "principal": _parse_decimal(data.get("principal")),
                "monthly_payment": _parse_decimal(data.get("monthly_payment")),
                "interest_rate": _parse_decimal(data.get("interest_rate", "0")),
                "remaining_balance": _parse_decimal(data.get("remaining_balance")),
                "due_date": _parse_date(due) if due else None,
            },
        )
        message = "Debt obligation restored."
    elif resource_type == "savings_goal":
        target = data.get("target_date")
        await db.insert(
            "savings_goals",
            {
                "user_id": user.id,
                "name": data.get("name", "Restored goal"),
                "target_amount": _parse_decimal(data.get("target_amount")),
                "current_amount": _parse_decimal(data.get("current_amount", "0")),
                "target_date": _parse_date(target) if target else None,
                "status": data.get("status", "active"),
            },
        )
        message = "Savings goal restored."
    else:
        raise NotFoundError(f"Unknown resource type '{resource_type}'.")

    await db.delete_one("recycle_bin", {"id": item_id, "user_id": user.id})
    await log_audit(
        db,
        action="recycle_bin.restore",
        resource_type="recycle_bin",
        user_id=user.id,
        resource_id=item_id,
    )
    return {"message": message}


@router.delete("/{item_id}", status_code=200)
async def delete_item(
    item_id: int,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> dict:
    await remove_item(db, user.id, item_id)
    return {"message": "Recycle bin item permanently deleted."}


def _serialize(item: Doc) -> dict:
    return {
        "id": item.id,
        "resource_type": item.resource_type,
        "resource_id": item.resource_id,
        "deleted_at": item.deleted_at.isoformat() if item.deleted_at else None,
        "deleted_data": item.deleted_data,
    }


def _parse_date(value) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    raise NotFoundError("Invalid date in recycle bin snapshot.")


def _parse_decimal(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if value is None:
        raise NotFoundError("Invalid amount in recycle bin snapshot.")
    return Decimal(str(value))
