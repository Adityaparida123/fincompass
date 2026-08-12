"""FinAI agent orchestration.

Flow:
  User message -> intent router -> consent check -> context retrieval
  -> deterministic tool execution -> LLM explanation -> safety validation
  -> response

The LLM only explains; all figures come from deterministic backend tools.
"""

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.memory import add_message, create_session, get_session, get_messages, list_sessions
from app.ai.prompts import build_messages
from app.ai.providers.openai_compatible import OpenAICompatibleProvider
from app.ai.router import route_intent
from app.ai.safety import (
    borrowing_caution_suffix,
    requires_borrowing_caution,
    sanitize_financial_claims,
    validate_response,
)
from app.ai.tools import TOOL_REGISTRY, TOOL_SPECS, ToolContext, execute_tool
from app.core.config import settings
from app.core.exceptions import ConsentDeniedError, LLMUnavailableError
from app.core.logging import get_logger
from app.db.models.consent import ConsentType
from app.schemas.chat import ChatResponse
from app.services.audit import log_audit
from app.services.consent.service import require_consent

logger = get_logger(__name__)


def get_provider() -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider()


async def _financial_context(db: AsyncSession, user_id: int) -> str:
    """Build a consented one-line financial summary for grounding."""
    from app.services.readiness.factors import build_readiness_input
    from app.services.readiness.engine import compute_readiness

    data = await build_readiness_input(db, user_id)
    readiness = compute_readiness(data)
    return (
        f"Monthly income ~{data.income:,.0f}; total expenses ~{data.total_expenses:,.0f}; "
        f"essential expenses ~{data.essential_monthly_expenses:,.0f}; debt payments ~{data.debt_payments:,.0f}; "
        f"savings ~{data.savings:,.0f}; readiness score {readiness.score}/100."
    )


async def chat(
    db: AsyncSession,
    user_id: int,
    message: str,
    *,
    session_id: int | None = None,
    language: str | None = None,
) -> ChatResponse:
    routing = route_intent(message)

    if not settings.llm_configured:
        return await _no_llm_fallback(db, user_id, message, routing, session_id)

    try:
        provider = get_provider()
    except Exception as exc:  # noqa: BLE001
        logger.error("LLM provider init failed: %s", exc)
        return await _no_llm_fallback(db, user_id, message, routing, session_id)

    # Consent: personal analysis requires financial_data_analysis + chat context
    needs_context = bool(routing["needs_context"])
    if needs_context:
        await require_consent(db, user_id, ConsentType.financial_data_analysis)
        await require_consent(db, user_id, ConsentType.chat_financial_context)

    session = await _ensure_session(db, user_id, message, session_id, language)
    await add_message(db, session.id, "user", message, intent=str(routing["intent"]))

    history = await get_messages(db, session.id)
    llm_history = [{"role": m.role, "content": m.content} for m in history if m.role in ("user", "assistant")]
    if llm_history and llm_history[-1]["role"] == "user":
        llm_history = llm_history[:-1]

    context_text = await _financial_context(db, user_id) if needs_context else None
    tool_results: list[dict[str, str]] = []
    tool_used: str | None = None

    messages = build_messages(llm_history, financial_context=context_text)
    llm_messages = list(messages)

    try:
        first = await provider.generate(llm_messages, tools=TOOL_SPECS)
    except LLMUnavailableError:
        return await _no_llm_fallback(db, user_id, message, routing, session_id)

    tool_calls = first.get("tool_calls")
    ctx = ToolContext(db=db, user_id=user_id, session_id=session.id)

    if tool_calls:
        for call in tool_calls:
            fn = call["function"]
            name = fn.get("name", "")
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            tool_used = name
            try:
                result = await execute_tool(ctx, name, args)
                content = json.dumps(result, default=str, ensure_ascii=False)
            except ConsentDeniedError:
                content = json.dumps({"error": "consent_denied", "message": "Consent required."})
            except Exception as exc:  # noqa: BLE001
                logger.warning("Tool %s failed: %s", name, exc)
                content = json.dumps({"error": "tool_failed", "message": "This calculation could not be completed."})
            tool_results.append({"role": "tool", "content": content})

        llm_messages.append(first)
        for result in tool_results:
            llm_messages.append(result)

        try:
            second = await provider.generate(llm_messages, tools=None)
        except LLMUnavailableError:
            return await _no_llm_fallback(db, user_id, message, routing, session_id)
        reply = second.get("content") or ""
    else:
        reply = first.get("content") or ""

    reply = sanitize_financial_claims(reply)
    if requires_borrowing_caution(str(routing["intent"])):
        reply = reply.rstrip() + borrowing_caution_suffix()

    is_safe, replacement = validate_response(reply)
    if not is_safe and replacement:
        reply = replacement

    await add_message(
        db,
        session.id,
        "assistant",
        reply,
        intent=str(routing["intent"]),
        tool_used=tool_used,
    )
    await log_audit(
        db,
        action="chat.message",
        resource_type="chat_session",
        user_id=user_id,
        resource_id=session.id,
        metadata={"intent": routing["intent"], "tool_used": tool_used},
    )
    await db.commit()

    return ChatResponse(
        reply=reply,
        session_id=session.id,
        intent=str(routing["intent"]),
        tool_used=tool_used,
        tool_result=json.loads(tool_results[0]["content"]) if tool_results else None,
        needs_financial_context=needs_context,
    )


async def _ensure_session(
    db: AsyncSession,
    user_id: int,
    message: str,
    session_id: int | None,
    language: str | None,
):
    if session_id is not None:
        session = await get_session(db, user_id, session_id)
        if language:
            session.language = language
        return session
    title = message[:60].strip() or "New conversation"
    lang = language or "en"
    return await create_session(db, user_id, title=title, language=lang)


async def _no_llm_fallback(
    db: AsyncSession,
    user_id: int,
    message: str,
    routing: dict[str, object],
    session_id: int | None,
) -> ChatResponse:
    """Deterministic fallback when no LLM is configured (dev/tests)."""
    from app.schemas.chat import ChatResponse as CR

    session = await _ensure_session(db, user_id, message, session_id, None)
    await add_message(db, session.id, "user", message, intent=str(routing["intent"]))

    reply = (
        "FinAI is running in local mode without a language model. Financial tools are "
        "available via the REST API (e.g. /api/v1/tools/emi, /api/v1/tools/loan-simulation). "
        "Set LLM_API_KEY, LLM_MODEL, and LLM_BASE_URL to enable conversational answers."
    )
    await add_message(db, session.id, "assistant", reply, intent=str(routing["intent"]))
    await db.commit()
    return CR(reply=reply, session_id=session.id, intent=str(routing["intent"]))
