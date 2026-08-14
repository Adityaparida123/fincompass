"""Conversation memory: load and save chat history."""

from datetime import UTC, datetime

from app.core.exceptions import NotFoundError
from app.db.mongo import Doc, MongoDatabase

MAX_HISTORY_TURNS = 20


async def create_session(
    db: MongoDatabase, user_id: int, title: str = "New conversation", language: str = "en"
) -> Doc:
    now = datetime.now(UTC)
    return await db.insert(
        "chat_sessions",
        {
            "user_id": user_id,
            "title": title,
            "language": language,
            "created_at": now,
            "updated_at": now,
        },
    )


async def get_session(db: MongoDatabase, user_id: int, session_id: int) -> Doc:
    session = await db.find_one(
        "chat_sessions",
        {"id": session_id, "user_id": user_id},
    )
    if session is None:
        raise NotFoundError("Chat session not found.")
    return session


async def list_sessions(db: MongoDatabase, user_id: int) -> list[Doc]:
    return await db.find("chat_sessions", {"user_id": user_id}, sort=[("updated_at", -1)])


async def touch_session(db: MongoDatabase, session_id: int) -> None:
    await db.update_one(
        "chat_sessions",
        {"id": session_id},
        {"updated_at": datetime.now(UTC)},
    )


async def add_message(
    db: MongoDatabase,
    session_id: int,
    role: str,
    content: str,
    *,
    intent: str | None = None,
    tool_used: str | None = None,
) -> Doc:
    message = await db.insert(
        "chat_messages",
        {
            "session_id": session_id,
            "role": role,
            "content": content,
            "intent": intent,
            "tool_used": tool_used,
            "created_at": datetime.now(UTC),
        },
    )
    await touch_session(db, session_id)
    return message


async def get_messages(db: MongoDatabase, session_id: int, limit: int = MAX_HISTORY_TURNS) -> list[Doc]:
    rows = await db.find(
        "chat_messages",
        {"session_id": session_id},
        sort=[("id", -1)],
        limit=limit,
    )
    return list(reversed(rows))


async def delete_session(db: MongoDatabase, user_id: int, session_id: int) -> None:
    session = await get_session(db, user_id, session_id)
    await db.delete_one("chat_messages", {"session_id": session.id})
    await db.delete_one("chat_sessions", {"id": session.id})


def to_llm_history(messages: list[Doc]) -> list[dict[str, str]]:
    return [{"role": m.role, "content": m.content} for m in messages if m.role in ("user", "assistant")]
