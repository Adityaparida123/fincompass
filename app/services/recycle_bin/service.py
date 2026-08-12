"""Recycle bin service for soft-deleted records."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.recycle_bin import RecycleBinItem
from app.services.audit import log_audit


async def list_items(db: AsyncSession, user_id: int) -> list[RecycleBinItem]:
    stmt = (
        select(RecycleBinItem)
        .where(RecycleBinItem.user_id == user_id)
        .order_by(RecycleBinItem.deleted_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def add_item(
    db: AsyncSession,
    user_id: int,
    resource_type: str,
    resource_id: int,
    deleted_data: dict | None,
) -> RecycleBinItem:
    item = RecycleBinItem(
        user_id=user_id,
        resource_type=resource_type,
        resource_id=str(resource_id),
        deleted_data=deleted_data,
    )
    db.add(item)
    await db.flush()
    await log_audit(
        db,
        action="recycle_bin.add",
        resource_type=resource_type,
        user_id=user_id,
        resource_id=resource_id,
    )
    return item


async def get_item(db: AsyncSession, user_id: int, item_id: int) -> RecycleBinItem:
    stmt = select(RecycleBinItem).where(
        RecycleBinItem.id == item_id, RecycleBinItem.user_id == user_id
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if item is None:
        raise NotFoundError("Recycle bin item not found.")
    return item


async def remove_item(db: AsyncSession, user_id: int, item_id: int) -> RecycleBinItem:
    item = await get_item(db, user_id, item_id)
    await db.delete(item)
    await db.flush()
    await log_audit(
        db,
        action="recycle_bin.delete",
        resource_type="recycle_bin",
        user_id=user_id,
        resource_id=item_id,
    )
    return item


def item_snapshot(resource_type: str, obj) -> dict:
    """Build a JSON-safe snapshot of a model for restore purposes."""
    from decimal import Decimal
    from enum import Enum

    from sqlalchemy import inspect as sa_inspect

    insp = sa_inspect(obj)
    state = {**(insp.committed_state or {}), **(insp.dict or {})}
    data: dict = {}
    for column in obj.__table__.columns:
        key = column.key
        value = state.get(key)
        if hasattr(value, "isoformat"):
            value = value.isoformat()
        elif isinstance(value, Enum):
            value = value.value
        elif isinstance(value, Decimal):
            value = str(value)
        data[key] = value
    return data


async def move_to_recycle_bin(
    db: AsyncSession,
    user_id: int,
    resource_type: str,
    resource_id: int,
    obj: Any,
    *,
    hard_delete: bool = True,
) -> RecycleBinItem:
    """Snapshot a resource, optionally hard-delete it, and store in recycle bin."""
    snapshot = item_snapshot(resource_type, obj)
    if hard_delete:
        await db.delete(obj)
        await db.flush()
    item = await add_item(db, user_id, resource_type, resource_id, snapshot)
    return item
