"""FinAI chat endpoints."""

import json
import time

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.ai.agent import chat, get_provider
from app.ai.memory import (
    add_message,
    create_session,
    delete_session,
    get_messages,
    get_session,
    list_sessions,
    to_llm_history,
)
from app.ai.prompts import build_messages
from app.ai.router import route_intent
from app.ai.safety import (
    borrowing_caution_suffix,
    requires_borrowing_caution,
    sanitize_financial_claims,
    validate_response,
)
from app.ai.tools import TOOL_SPECS, ToolContext, execute_tool
from app.api.dependencies import get_current_user, rate_limit_chat
from app.core.config import settings
from app.core.exceptions import ConsentDeniedError, LLMUnavailableError
from app.core.logging import get_logger
from app.db.enums import ConsentType
from app.db.mongo import MongoDatabase
from app.db.session import get_session as get_db
from app.schemas.chat import (
    ChatMessageRead,
    ChatRequest,
    ChatResponse,
    ChatSessionRead,
)
from app.services.consent.service import require_consent

logger = get_logger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


@router.post("", response_model=ChatResponse)
async def post_chat(
    data: ChatRequest,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_db),
    _: None = Depends(rate_limit_chat),
) -> ChatResponse:
    return await chat(db, user.id, data.message, session_id=data.session_id, language=data.language, detail=data.detail, focus=data.focus)


@router.post("/stream")
async def stream_chat(
    data: ChatRequest,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_db),
    _: None = Depends(rate_limit_chat),
) -> StreamingResponse:
    t0 = time.monotonic()
    routing = route_intent(data.message)
    intent = str(routing["intent"])
    needs_context = bool(routing["needs_context"])

    logger.info(
        "stream_chat user=%s intent=%s needs_context=%s msg_len=%d",
        user.id, intent, needs_context, len(data.message),
    )

    if needs_context:
        await require_consent(db, user.id, ConsentType.financial_data_analysis)
        await require_consent(db, user.id, ConsentType.chat_financial_context)

    if data.session_id:
        session = await get_session(db, user.id, data.session_id)
    else:
        session = await create_session(db, user.id, title=data.message[:60])
    if data.language:
        await db.update_one(
            "chat_sessions",
            {"id": session.id, "user_id": user.id},
            {"language": data.language},
        )
        session.language = data.language
    await add_message(db, session.id, "user", data.message, intent=intent)

    if not settings.llm_configured:

        async def no_llm_generator():
            reply = await _stream_fallback_reply(db, user.id, data.message, intent, session.id)
            await add_message(db, session.id, "assistant", reply, intent=intent)
            yield f"data: {json.dumps({'delta': reply}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(no_llm_generator(), media_type="text/event-stream", headers=_SSE_HEADERS)

    history = await get_messages(db, session.id)
    llm_history = to_llm_history(history)

    context_text = None
    if needs_context:
        from app.services.finance.context import build_context_for_intent

        slice_ = await build_context_for_intent(db, user.id, intent=intent, message=data.message)
        context_text = slice_.text or None

    messages = build_messages(
        llm_history,
        financial_context=context_text,
        language=session.language,
        detail=data.detail,
        focus=data.focus,
    )
    provider = get_provider()

    async def event_generator():
        assistant_text = ""
        tool_used: str | None = None
        t_start = time.monotonic()
        try:
            logger.info("stream LLM generate user=%s model=%s tool_count=%d", user.id, getattr(provider, '_model', 'unknown'), len(TOOL_SPECS))
            first = await provider.generate(list(messages), tools=TOOL_SPECS)
            t_first = time.monotonic() - t_start
            tool_calls = first.get("tool_calls")
            first_content_len = len(first.get("content") or "")
            logger.info(
                "stream LLM first_call user=%s elapsed=%.2fs tool_calls=%s content_len=%d",
                user.id, t_first, bool(tool_calls), first_content_len,
            )

            if tool_calls:
                ctx = ToolContext(db=db, user_id=user.id, session_id=session.id)
                tool_results: list[dict[str, str]] = []
                for call in tool_calls:
                    fn = call["function"]
                    name = fn.get("name", "")
                    tool_used = name
                    try:
                        args = json.loads(fn.get("arguments") or "{}")
                    except json.JSONDecodeError:
                        args = {}
                    try:
                        result = await execute_tool(ctx, name, args)
                        content = json.dumps(result, default=str, ensure_ascii=False)
                        logger.info("stream tool_ok user=%s tool=%s result_len=%d", user.id, name, len(content))
                    except ConsentDeniedError:
                        content = json.dumps({"error": "consent_denied", "message": "Consent required."})
                        logger.warning("stream tool_consent_denied user=%s tool=%s", user.id, name)
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("stream tool_fail user=%s tool=%s error=%s", user.id, name, exc)
                        content = json.dumps({"error": "tool_failed", "message": "This calculation could not be completed."})
                    tool_results.append({"role": "tool", "content": content})

                assistant_msg = {"role": "assistant", "content": first.get("content") or "", "tool_calls": tool_calls}
                stream_messages = list(messages) + [assistant_msg] + tool_results
                t_stream = time.monotonic()
                chunk_count = 0
                async for chunk in provider.generate_stream(stream_messages):
                    assistant_text += chunk
                    chunk_count += 1
                    yield f"data: {json.dumps({'delta': chunk}, ensure_ascii=False)}\n\n"
                logger.info(
                    "stream LLM second_call user=%s elapsed=%.2fs chunks=%d total_len=%d",
                    user.id, time.monotonic() - t_stream, chunk_count, len(assistant_text),
                )
            else:
                content = first.get("content") or ""
                if content:
                    assistant_text = content
                    yield f"data: {json.dumps({'delta': content}, ensure_ascii=False)}\n\n"
                else:
                    logger.warning("stream empty_response user=%s raw=%s", user.id, first.get("raw"))
                    assistant_text = "I wasn't able to generate a response for that question. Please try rephrasing."
                    yield f"data: {json.dumps({'delta': assistant_text}, ensure_ascii=False)}\n\n"

        except LLMUnavailableError as exc:
            logger.warning(
                "LLM unavailable during stream user=%s model=%s tools=%d error=%s",
                user.id, getattr(provider, '_model', 'unknown'), len(TOOL_SPECS), exc,
                exc_info=True,
            )
            assistant_text = "I'm temporarily unable to process your request. Please try again."
            yield f"data: {json.dumps({'delta': assistant_text}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            logger.error("Stream chat error for user %s: %s", user.id, exc, exc_info=True)
            assistant_text = "An error occurred while generating your response."
            yield f"data: {json.dumps({'delta': assistant_text}, ensure_ascii=False)}\n\n"

        # Apply safety validation to the streamed reply.
        if assistant_text.strip():
            assistant_text = sanitize_financial_claims(assistant_text)
            if requires_borrowing_caution(intent):
                assistant_text = assistant_text.rstrip() + borrowing_caution_suffix()
            is_safe, replacement = validate_response(assistant_text)
            if not is_safe and replacement:
                assistant_text = replacement

        # Persist only meaningful replies — skip error placeholders and empty content.
        _error_prefixes = ("I'm temporarily", "An error occurred", "I wasn't able to")
        if assistant_text.strip() and not assistant_text.startswith(_error_prefixes):
            await add_message(
                db, session.id, "assistant", assistant_text, intent=intent, tool_used=tool_used
            )
        logger.info("stream done user=%s elapsed=%.2fs reply_len=%d", user.id, time.monotonic() - t0, len(assistant_text))
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=_SSE_HEADERS)


async def _stream_fallback_reply(
    db: MongoDatabase,
    user_id: int,
    message: str,
    intent: str,
    session_id: int,
) -> str:
    """Deterministic no-LLM stream reply (same behaviour as the non-stream fallback)."""
    from app.knowledge.base import get_knowledge_retriever

    reply: str
    if intent in ("savings", "personal_general"):
        try:
            await require_consent(db, user_id, ConsentType.financial_data_analysis)
            from app.services.readiness.factors import build_readiness_input

            ctx = ToolContext(db=db, user_id=user_id, session_id=session_id)
            data = await build_readiness_input(db, user_id)
            result = await execute_tool(
                ctx,
                "calculate_savings_capacity",
                {
                    "income": str(data.income),
                    "expenses": str(data.total_expenses),
                    "debt_payments": str(data.debt_payments),
                },
            )
            est = result.get("estimated_monthly_savings", "0")
            reply = (
                f"Based on your recorded data, estimated monthly savings capacity is "
                f"₹{est} (estimate only). Configure LLM_API_KEY, LLM_MODEL, and LLM_BASE_URL "
                "for conversational guidance."
            )
        except Exception:  # noqa: BLE001
            reply = (
                "FinAI local mode: personal analysis available via REST APIs. "
                "Set LLM_API_KEY, LLM_MODEL, and LLM_BASE_URL for full chat."
            )
        return reply

    docs = get_knowledge_retriever().search(message, top_k=1)
    if docs:
        return (
            f"From our knowledge base ({docs[0].source}): "
            f"{docs[0].content[:400]}... "
            "Configure an LLM for full conversational answers."
        )
    return (
        "FinAI is running without a language model. "
        "Financial calculators are at /api/v1/tools/*. Set LLM credentials to enable chat."
    )


@router.get("/sessions", response_model=list[ChatSessionRead])
async def get_chat_sessions(
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_db),
) -> list[ChatSessionRead]:
    sessions = await list_sessions(db, user.id)
    return [ChatSessionRead.model_validate(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=list[ChatMessageRead])
async def get_chat_session(
    session_id: int,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_db),
) -> list[ChatMessageRead]:
    await get_session(db, user.id, session_id)
    messages = await get_messages(db, session_id, limit=100)
    return [ChatMessageRead.model_validate(m) for m in messages]


@router.delete("/sessions/{session_id}", status_code=200)
async def delete_chat_session(
    session_id: int,
    user=Depends(get_current_user),
    db: MongoDatabase = Depends(get_db),
) -> dict:
    await delete_session(db, user.id, session_id)
    return {"message": "Chat session deleted."}
