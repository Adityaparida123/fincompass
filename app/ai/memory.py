"""Conversation memory: load and save chat history."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.chat import ChatMessage, ChatSession

MAX_HISTORY_TURNS = 20


async def create_session(
    db: AsyncSession, user_id: int, title: str = "New conversation", language: str = "en"
) -> ChatSession:
    session = ChatSession(user_id=user_id, title=title, language=language)
    db.add(session)
    await db.flush()
    return session


async def get_session(db: AsyncSession, user_id: int, session_id: int) -> ChatSession:
    stmt = select(ChatSession).where(
        ChatSession.id == session_id, ChatSession.user_id == user_id
    )
    session = (await db.execute(stmt)).scalar_one_or_none()
    if session is None:
        raise NotFoundError("Chat session not found.")
    return session


async def list_sessions(db: AsyncSession, user_id: int) -> list[ChatSession]:
    stmt = (
        select(ChatSession)
        .where(ChatSession.user_id == user_id)
        .order_by(ChatSession.updated_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def add_message(
    db: AsyncSession,
    session_id: int,
    role: str,
    content: str,
    *,
    intent: str | None = None,
    tool_used: str | None = None,
) -> ChatMessage:
    message = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        intent=intent,
        tool_used=tool_used,
    )
    db.add(message)
    await db.flush()
    return message


async def get_messages(db: AsyncSession, session_id: int, limit: int = MAX_HISTORY_TURNS) -> list[ChatMessage]:
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.id.desc())
        .limit(limit)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    return list(reversed(rows))


async def delete_session(db: AsyncSession, user_id: int, session_id: int) -> None:
    session = await get_session(db, user_id, session_id)
    await db.delete(session)
    await db.flush()


def to_llm_history(messages: list[ChatMessage]) -> list[dict[str, str]]:
    return [{"role": m.role, "content": m.content} for m in messages if m.role in ("user", "assistant")]
