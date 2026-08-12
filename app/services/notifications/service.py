"""Notifications service."""

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.notification import Notification


async def list_notifications(
    db: AsyncSession, user_id: int, *, unread_only: bool = False, limit: int = 100
) -> list[Notification]:
    stmt = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


async def unread_count(db: AsyncSession, user_id: int) -> int:
    stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id, Notification.is_read.is_(False)
    )
    return int((await db.execute(stmt)).scalar_one())


async def mark_read(db: AsyncSession, user_id: int, notification_id: int) -> Notification:
    stmt = select(Notification).where(
        Notification.id == notification_id, Notification.user_id == user_id
    )
    notification = (await db.execute(stmt)).scalar_one_or_none()
    if notification is None:
        raise NotFoundError("Notification not found.")
    notification.is_read = True
    await db.flush()
    return notification


async def mark_all_read(db: AsyncSession, user_id: int) -> int:
    stmt = (
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.rowcount or 0


async def delete_notification(db: AsyncSession, user_id: int, notification_id: int) -> None:
    stmt = select(Notification).where(
        Notification.id == notification_id, Notification.user_id == user_id
    )
    notification = (await db.execute(stmt)).scalar_one_or_none()
    if notification is None:
        raise NotFoundError("Notification not found.")
    await db.delete(notification)
    await db.flush()


async def notify(
    db: AsyncSession, user_id: int, title: str, message: str, ntype: str = "system"
) -> Notification:
    notification = Notification(user_id=user_id, title=title, message=message, type=ntype)
    db.add(notification)
    await db.flush()
    return notification
