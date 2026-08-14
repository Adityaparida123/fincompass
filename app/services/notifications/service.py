"""Notifications service."""

from app.core.exceptions import NotFoundError
from app.db.mongo import Doc, MongoDatabase


async def list_notifications(
    db: MongoDatabase, user_id: int, *, unread_only: bool = False, limit: int = 100
) -> list[Doc]:
    filt: dict = {"user_id": user_id}
    if unread_only:
        filt["is_read"] = False
    return await db.find(
        "notifications",
        filt,
        sort=[("created_at", -1)],
        limit=limit,
    )


async def unread_count(db: MongoDatabase, user_id: int) -> int:
    return await db.count("notifications", {"user_id": user_id, "is_read": False})


async def mark_read(db: MongoDatabase, user_id: int, notification_id: int) -> Doc:
    notification = await db.find_one(
        "notifications",
        {"id": notification_id, "user_id": user_id},
    )
    if notification is None:
        raise NotFoundError("Notification not found.")
    await db.update_one(
        "notifications",
        {"id": notification_id, "user_id": user_id},
        {"is_read": True},
    )
    notification.is_read = True
    return notification


async def mark_all_read(db: MongoDatabase, user_id: int) -> int:
    return await db.update_many(
        "notifications",
        {"user_id": user_id, "is_read": False},
        {"is_read": True},
    )


async def delete_notification(db: MongoDatabase, user_id: int, notification_id: int) -> None:
    notification = await db.find_one(
        "notifications",
        {"id": notification_id, "user_id": user_id},
    )
    if notification is None:
        raise NotFoundError("Notification not found.")
    await db.delete_one("notifications", {"id": notification_id, "user_id": user_id})


async def notify(
    db: MongoDatabase, user_id: int, title: str, message: str, ntype: str = "system"
) -> Doc:
    return await db.insert(
        "notifications",
        {
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": ntype,
            "is_read": False,
        },
    )
