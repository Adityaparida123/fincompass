"""Recycle bin service for soft-deleted records."""

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from app.core.exceptions import NotFoundError
from app.db.mongo import Doc, MongoDatabase
from app.services.audit import log_audit

# Map recycle-bin resource types to their Mongo collections.
_COLLECTION_BY_RESOURCE: dict[str, str] = {
    "transaction": "transactions",
    "budget": "budgets",
    "debt_obligation": "debt_obligations",
    "savings_goal": "savings_goals",
}


async def list_items(db: MongoDatabase, user_id: int) -> list[Doc]:
    return await db.find(
        "recycle_bin",
        {"user_id": user_id},
        sort=[("deleted_at", -1)],
    )


async def add_item(
    db: MongoDatabase,
    user_id: int,
    resource_type: str,
    resource_id: int,
    deleted_data: dict | None,
) -> Doc:
    item = await db.insert(
        "recycle_bin",
        {
            "user_id": user_id,
            "resource_type": resource_type,
            "resource_id": str(resource_id),
            "deleted_data": deleted_data,
            "deleted_at": datetime.now(UTC),
        },
    )
    await log_audit(
        db,
        action="recycle_bin.add",
        resource_type=resource_type,
        user_id=user_id,
        resource_id=resource_id,
    )
    return item


async def get_item(db: MongoDatabase, user_id: int, item_id: int) -> Doc:
    item = await db.find_one("recycle_bin", {"id": item_id, "user_id": user_id})
    if item is None:
        raise NotFoundError("Recycle bin item not found.")
    return item


async def remove_item(db: MongoDatabase, user_id: int, item_id: int) -> Doc:
    item = await get_item(db, user_id, item_id)
    await db.delete_one("recycle_bin", {"id": item.id, "user_id": user_id})
    await log_audit(
        db,
        action="recycle_bin.delete",
        resource_type="recycle_bin",
        user_id=user_id,
        resource_id=item_id,
    )
    return item


def _snap(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _snap(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_snap(v) for v in value]
    return value


def item_snapshot(resource_type: str, obj: Any) -> dict:
    """Build a JSON-safe snapshot of a document for restore purposes."""
    return {key: _snap(value) for key, value in obj.items()}


async def move_to_recycle_bin(
    db: MongoDatabase,
    user_id: int,
    resource_type: str,
    resource_id: int,
    obj: Any,
    *,
    hard_delete: bool = True,
) -> Doc:
    """Snapshot a resource, optionally hard-delete it, and store in recycle bin."""
    snapshot = item_snapshot(resource_type, obj)
    if hard_delete:
        collection = _COLLECTION_BY_RESOURCE.get(resource_type)
        if collection is not None:
            await db.delete_one(collection, {"id": resource_id, "user_id": user_id})
    item = await add_item(db, user_id, resource_type, resource_id, snapshot)
    return item
