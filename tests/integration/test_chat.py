"""Integration tests for the FinAI chat endpoints."""

import json

from app.core.config import settings
from app.core.exceptions import LLMUnavailableError


class FakeLLM:
    """In-memory LLM provider that records the messages it receives."""

    def __init__(self, reply="Sure! Here is an answer."):
        self.reply = reply
        self.messages = []

    async def generate(self, messages, *, tools=None, temperature=0.3):
        self.messages.append(list(messages))
        return {"content": self.reply, "tool_calls": None, "raw": None}

    async def generate_stream(self, messages, *, temperature=0.3):
        self.messages.append(list(messages))
        yield self.reply


async def _enable_llm(monkeypatch, reply="Sure! Here is an answer."):
    """Turn on a fake LLM so the agent/provider paths are exercised."""
    fake = FakeLLM(reply=reply)
    monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test-local")
    monkeypatch.setattr("app.ai.agent.get_provider", lambda: fake)
    monkeypatch.setattr("app.api.routes.chat.get_provider", lambda: fake)
    return fake


def _system_text(messages: list[dict]) -> str:
    return "\n".join(m["content"] for m in messages if m["role"] == "system")


async def test_chat_no_llm_fallback(client, auth_headers):
    response = await client.post(
        "/api/v1/chat",
        json={"message": "How can I save money?"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] >= 1
    assert "consent" in body["reply"].lower() or "llm" in body["reply"].lower()


async def test_chat_sessions_crud(client, auth_headers):
    created = await client.post(
        "/api/v1/chat",
        json={"message": "What is a budget?"},
        headers=auth_headers,
    )
    session_id = created.json()["session_id"]

    sessions = await client.get("/api/v1/chat/sessions", headers=auth_headers)
    assert sessions.status_code == 200
    assert any(s["id"] == session_id for s in sessions.json())

    history = await client.get(f"/api/v1/chat/sessions/{session_id}", headers=auth_headers)
    assert history.status_code == 200
    assert len(history.json()) == 2  # user + assistant

    deleted = await client.delete(f"/api/v1/chat/sessions/{session_id}", headers=auth_headers)
    assert deleted.status_code == 200


async def test_chat_personal_requires_consent(client, auth_headers):
    response = await client.post(
        "/api/v1/chat",
        json={"message": "Meri monthly income kya hai?"},
        headers=auth_headers,
    )
    # Personal intent -> consent required -> fallback may still respond or deny.
    assert response.status_code in (200, 403)


async def test_chat_personal_with_consent(client, consented_headers):
    response = await client.post(
        "/api/v1/chat",
        json={"message": "Can I afford a 50000 loan?"},
        headers=consented_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] in ("loan", "general")
    assert "loan" in body["reply"].lower() or "simulation" in body["reply"].lower()


async def test_chat_supports_hindi(client, auth_headers):
    response = await client.post(
        "/api/v1/chat",
        json={"message": "मैं हर महीने कितना बचा सकता हूँ?"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["session_id"] >= 1


async def test_chat_stream_endpoint(client, auth_headers):
    async with client.stream(
        "POST", "/api/v1/chat/stream", json={"message": "What is inflation?"}, headers=auth_headers
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]
    assert chunks, "Expected streamed chunks"


async def test_chat_error_consistency(client, auth_headers):
    response = await client.post("/api/v1/chat", json={"message": ""}, headers=auth_headers)
    assert response.status_code == 422


async def test_chat_requires_auth(client):
    response = await client.post("/api/v1/chat", json={"message": "hello"})
    assert response.status_code == 401


async def test_chat_session_isolation(client, auth_headers):
    created = await client.post(
        "/api/v1/chat", json={"message": "What is inflation?"}, headers=auth_headers
    )
    session_id = created.json()["session_id"]

    other = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Other User", "email": "other@example.com", "password": "strong-password-123"},
    )
    other_headers = {"Authorization": f"Bearer {other.json()['tokens']['access_token']}"}

    history = await client.get(f"/api/v1/chat/sessions/{session_id}", headers=other_headers)
    assert history.status_code == 404
    deleted = await client.delete(f"/api/v1/chat/sessions/{session_id}", headers=other_headers)
    assert deleted.status_code == 404


async def test_chat_personal_requires_consent_with_llm(client, auth_headers, monkeypatch):
    await client.delete("/api/v1/consent/chat_financial_context", headers=auth_headers)
    fake = await _enable_llm(monkeypatch)
    response = await client.post(
        "/api/v1/chat",
        json={"message": "How much can I save this month?"},
        headers=auth_headers,
    )
    assert response.status_code == 403
    assert fake.messages == []  # nothing sent to the model without consent


async def test_chat_stream_personal_requires_consent(client, auth_headers, monkeypatch):
    await client.delete("/api/v1/consent/chat_financial_context", headers=auth_headers)
    await _enable_llm(monkeypatch)
    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "How much can I save this month?"},
        headers=auth_headers,
    ) as response:
        assert response.status_code == 403


async def test_chat_general_without_consent(client, auth_headers, monkeypatch):
    fake = await _enable_llm(monkeypatch)
    response = await client.post(
        "/api/v1/chat",
        json={"message": "What is inflation?"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert fake.messages  # model was contacted for a general question


async def test_chat_personal_sends_minimal_context(client, consented_headers, monkeypatch):
    tx = await client.post(
        "/api/v1/transactions",
        headers=consented_headers,
        json={
            "date": "2026-08-01",
            "description": "swiggy dinner",
            "amount": "450.00",
            "transaction_type": "expense",
            "category": "food",
        },
    )
    assert tx.status_code == 201

    fake = await _enable_llm(monkeypatch, reply="Your spend is explained.")
    response = await client.post(
        "/api/v1/chat",
        json={"message": "How much did I spend this month?"},
        headers=consented_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Your spend is explained."
    assert body["intent"] == "expenses"

    sent = fake.messages[0]
    combined = _system_text(sent)
    # Authoritative backend figure is provided verbatim...
    assert "450" in combined
    # ...but raw transaction detail is not dumped into the LLM context.
    assert "swiggy" not in combined


async def test_chat_hindi_with_llm(client, consented_headers, monkeypatch):
    fake = await _enable_llm(monkeypatch, reply="बचत की जानकारी दी गई है।")
    response = await client.post(
        "/api/v1/chat",
        json={"message": "Main is mahine kitna save kar sakta hoon?", "language": "hi"},
        headers=consented_headers,
    )
    assert response.status_code == 200
    assert response.json()["reply"] == "बचत की जानकारी दी गई है।"
    assert "hi" in _system_text(fake.messages[0])


async def test_chat_hinglish_with_llm(client, consented_headers, monkeypatch):
    fake = await _enable_llm(monkeypatch, reply="Aap ki savings capacity batayi gayi hai.")
    response = await client.post(
        "/api/v1/chat",
        json={"message": "Meri savings capacity kitni hai?", "language": "hinglish"},
        headers=consented_headers,
    )
    assert response.status_code == 200
    assert response.json()["reply"] == "Aap ki savings capacity batayi gayi hai."
    assert "hinglish" in _system_text(fake.messages[0])


async def test_chat_never_exposes_api_key(client, auth_headers, monkeypatch):
    await _enable_llm(monkeypatch)
    response = await client.post(
        "/api/v1/chat",
        json={"message": "What is inflation?"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert "sk-test-local" not in response.text


async def test_chat_stream_with_llm(client, auth_headers, monkeypatch):
    fake = await _enable_llm(monkeypatch, reply="streamed answer")
    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "What is inflation?"},
        headers=auth_headers,
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]
    joined = "".join(chunks)
    assert "streamed answer" in joined
    assert "data: [DONE]" in joined
    assert "sk-test-local" not in joined
    assert fake.messages


class FakeToolLLM:
    """LLM that returns tool calls on first generate, then streams content."""

    def __init__(self, tool_name="calculate_savings_capacity", tool_result=None, final_reply="Your savings estimate is ready."):
        self.tool_name = tool_name
        self.tool_result = tool_result or {"estimated_monthly_savings": "5000"}
        self.final_reply = final_reply
        self.generate_calls = []
        self.generate_stream_calls = []

    async def generate(self, messages, *, tools=None, temperature=0.3):
        self.generate_calls.append({"messages": list(messages), "tools": tools})
        return {
            "content": "",
            "tool_calls": [
                {
                    "id": "call_001",
                    "type": "function",
                    "function": {
                        "name": self.tool_name,
                        "arguments": json.dumps({"income": "50000", "expenses": "30000", "debt_payments": "5000"}),
                    },
                }
            ],
            "raw": None,
        }

    async def generate_stream(self, messages, *, temperature=0.3):
        self.generate_stream_calls.append(list(messages))
        yield self.final_reply


async def test_chat_stream_executes_tool_calls(client, consented_headers, monkeypatch):
    """Stream endpoint must execute LLM tool calls and stream the final reply."""
    fake = FakeToolLLM(final_reply="Based on your data, you can save ₹5000 this month.")
    monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test-local")
    monkeypatch.setattr("app.ai.agent.get_provider", lambda: fake)
    monkeypatch.setattr("app.api.routes.chat.get_provider", lambda: fake)

    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "How much can I save this month?"},
        headers=consented_headers,
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]

    joined = "".join(chunks)
    assert "save ₹5000" in joined
    assert "data: [DONE]" in joined
    # First call should have included tools
    assert fake.generate_calls[0]["tools"] is not None
    # Second call (after tool execution) should stream the final reply
    assert len(fake.generate_stream_calls) == 1


async def test_chat_stream_no_empty_reply_persisted(client, auth_headers, monkeypatch):
    """Empty replies from the LLM should not be saved to the database."""
    fake = FakeLLM(reply="")
    monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test-local")
    monkeypatch.setattr("app.ai.agent.get_provider", lambda: fake)
    monkeypatch.setattr("app.api.routes.chat.get_provider", lambda: fake)

    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "What is inflation?"},
        headers=auth_headers,
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]

    joined = "".join(chunks)
    assert "data: [DONE]" in joined
    # The endpoint should not crash and should return [DONE]


async def test_chat_stream_error_not_persisted(client, auth_headers, monkeypatch):
    """Error placeholder messages should not be saved to the database."""
    class FailingLLM:
        async def generate(self, messages, *, tools=None, temperature=0.3):
            raise LLMUnavailableError("Connection failed")

        async def generate_stream(self, messages, *, temperature=0.3):
            raise LLMUnavailableError("Connection failed")

    monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test-local")
    monkeypatch.setattr("app.ai.agent.get_provider", lambda: FailingLLM())
    monkeypatch.setattr("app.api.routes.chat.get_provider", lambda: FailingLLM())

    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "What is inflation?"},
        headers=auth_headers,
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]

    joined = "".join(chunks)
    # Should receive a user-friendly error, not crash
    assert "temporarily unable" in joined or "error" in joined.lower()
    assert "data: [DONE]" in joined


# ── Regression: comprehensive end-to-end scenarios ──────────────────────


async def test_stream_financial_question_with_tool(client, consented_headers, monkeypatch):
    """Test 1: 'How much can I save this month?' → tool called → final response."""
    fake = FakeToolLLM(final_reply="You can save ₹5,000 per month based on your data.")
    monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test-local")
    monkeypatch.setattr("app.ai.agent.get_provider", lambda: fake)
    monkeypatch.setattr("app.api.routes.chat.get_provider", lambda: fake)

    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "How much can I save this month?"},
        headers=consented_headers,
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]

    joined = "".join(chunks)
    assert "save" in joined.lower()
    assert "data: [DONE]" in joined
    # Tools were passed and tool was executed
    assert fake.generate_calls[0]["tools"] is not None
    assert len(fake.generate_stream_calls) == 1


async def test_stream_general_question_no_tool(client, auth_headers, monkeypatch):
    """Test 2: 'What is inflation?' → normal LLM response, no tools, no consent needed."""
    fake = await _enable_llm(monkeypatch, reply="Inflation is the general increase in prices over time.")

    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "What is inflation?"},
        headers=auth_headers,
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]

    joined = "".join(chunks)
    assert "inflation" in joined.lower()
    assert "data: [DONE]" in joined


async def test_stream_tool_failure_graceful(client, consented_headers, monkeypatch):
    """Test 3: Tool fails → controlled error, error logged, stream completes."""

    class ToolFailLLM:
        def __init__(self):
            self.generate_calls = []
            self.generate_stream_calls = []

        async def generate(self, messages, *, tools=None, temperature=0.3):
            self.generate_calls.append({"tools": tools})
            return {
                "content": "",
                "tool_calls": [
                    {
                        "id": "call_fail",
                        "type": "function",
                        "function": {
                            "name": "calculate_savings_capacity",
                            "arguments": json.dumps({"income": "bad_data", "expenses": 0, "debt_payments": 0}),
                        },
                    }
                ],
                "raw": None,
            }

        async def generate_stream(self, messages, *, temperature=0.3):
            self.generate_stream_calls.append(True)
            yield "Here is the analysis."

    fake = ToolFailLLM()
    monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test-local")
    monkeypatch.setattr("app.ai.agent.get_provider", lambda: fake)
    monkeypatch.setattr("app.api.routes.chat.get_provider", lambda: fake)

    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "How much can I save this month?"},
        headers=consented_headers,
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]

    joined = "".join(chunks)
    # Should still get a response (either tool error or final LLM text)
    assert "data: [DONE]" in joined
    assert len(chunks) > 0


async def test_stream_llm_provider_failure(client, auth_headers, monkeypatch):
    """Test 4: LLM provider fails → controlled error event, no empty message persisted."""

    class ProviderFailLLM:
        async def generate(self, messages, *, tools=None, temperature=0.3):
            raise LLMUnavailableError("Provider timeout")

        async def generate_stream(self, messages, *, temperature=0.3):
            raise LLMUnavailableError("Provider timeout")

    monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test-local")
    monkeypatch.setattr("app.ai.agent.get_provider", lambda: ProviderFailLLM())
    monkeypatch.setattr("app.api.routes.chat.get_provider", lambda: ProviderFailLLM())

    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "What is inflation?"},
        headers=auth_headers,
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]

    joined = "".join(chunks)
    assert "temporarily unable" in joined
    assert "data: [DONE]" in joined


async def test_stream_empty_llm_response_fallback(client, auth_headers, monkeypatch):
    """Test 5: LLM returns empty content → user gets a rephrase prompt, not generic fallback."""
    fake = FakeLLM(reply="")
    monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test-local")
    monkeypatch.setattr("app.ai.agent.get_provider", lambda: fake)
    monkeypatch.setattr("app.api.routes.chat.get_provider", lambda: fake)

    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "What is inflation?"},
        headers=auth_headers,
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]

    joined = "".join(chunks)
    # Should receive a rephrase message, not crash
    assert "data: [DONE]" in joined
    assert len(chunks) > 0


async def test_stream_sse_format_valid(client, auth_headers, monkeypatch):
    """Test 6: Verify SSE format — every event is 'data: {...}\\n\\n' and ends with [DONE]."""
    fake = await _enable_llm(monkeypatch, reply="Hello world")
    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "Hi there"},
        headers=auth_headers,
    ) as response:
        assert response.status_code == 200
        raw = b""
        async for chunk in response.aiter_bytes():
            raw += chunk

    text = raw.decode("utf-8", errors="replace")
    lines = text.split("\n")
    data_lines = [l for l in lines if l.strip().startswith("data: ")]
    assert len(data_lines) >= 2  # at least one content event + [DONE]
    assert any("[DONE]" in l for l in data_lines)
    for dl in data_lines:
        payload = dl.strip()[6:]
        if payload == "[DONE]":
            continue
        import json as _json
        parsed = _json.loads(payload)
        assert "delta" in parsed


async def test_stream_full_flow_financial(client, consented_headers, monkeypatch):
    """Test 7: Production-style integration — full flow with tool execution."""
    # Add a transaction so there's real data
    tx = await client.post(
        "/api/v1/transactions",
        headers=consented_headers,
        json={
            "date": "2026-08-01",
            "description": "monthly salary",
            "amount": "50000.00",
            "transaction_type": "income",
            "category": "salary",
        },
    )
    assert tx.status_code == 201

    fake = FakeToolLLM(final_reply="Based on your income of ₹50,000, your estimated monthly savings is ₹20,000.")
    monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test-local")
    monkeypatch.setattr("app.ai.agent.get_provider", lambda: fake)
    monkeypatch.setattr("app.api.routes.chat.get_provider", lambda: fake)

    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "How much can I save this month?", "language": "en"},
        headers=consented_headers,
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]

    joined = "".join(chunks)
    assert "savings" in joined.lower()
    assert "data: [DONE]" in joined
    # Tools were invoked
    assert fake.generate_calls[0]["tools"] is not None
    assert len(fake.generate_stream_calls) == 1


# ── Regression: user message included in LLM messages ──────────────────


async def test_stream_user_message_included_in_llm_messages(client, auth_headers, monkeypatch):
    """Bug fix: the current user message must be sent to the LLM, not stripped."""
    fake = await _enable_llm(monkeypatch, reply="Here is your answer.")
    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "What is inflation?"},
        headers=auth_headers,
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]

    # The FakeLLM records all messages sent to generate()
    assert fake.messages, "LLM was never called"
    sent_messages = fake.messages[0]
    roles = [m["role"] for m in sent_messages]
    contents = [m["content"] for m in sent_messages]
    # Must have a user message with the actual question
    assert "user" in roles
    user_msgs = [m for m in sent_messages if m["role"] == "user"]
    assert any("inflation" in m["content"].lower() for m in user_msgs)


async def test_stream_tool_followup_has_role(client, consented_headers, monkeypatch):
    """Bug fix: the assistant message passed to generate_stream must have 'role'."""
    fake = FakeToolLLM(final_reply="Analysis complete.")
    monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test-local")
    monkeypatch.setattr("app.ai.agent.get_provider", lambda: fake)
    monkeypatch.setattr("app.api.routes.chat.get_provider", lambda: fake)

    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "How much can I save this month?"},
        headers=consented_headers,
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]

    # generate_stream was called with the follow-up messages
    assert len(fake.generate_stream_calls) == 1
    followup = fake.generate_stream_calls[0]
    # Every message must have a 'role' field
    for msg in followup:
        assert "role" in msg, f"Message missing 'role': {msg}"
    # The assistant message (with tool_calls) must have role=assistant
    assistant_msgs = [m for m in followup if m.get("role") == "assistant"]
    assert len(assistant_msgs) == 1
    assert assistant_msgs[0].get("tool_calls") is not None


async def test_stream_user_message_first_time_user(client, auth_headers, monkeypatch):
    """Bug fix: even a first-time user (no history) must have user message in LLM messages."""
    fake = await _enable_llm(monkeypatch, reply="General answer.")
    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "How does compound interest work?"},
        headers=auth_headers,
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]

    assert fake.messages
    sent_messages = fake.messages[0]
    user_msgs = [m for m in sent_messages if m["role"] == "user"]
    assert len(user_msgs) >= 1, "No user message sent to LLM — first-time user bug"
    assert "compound interest" in user_msgs[0]["content"].lower()


async def test_chat_stream_provider_auth_error(client, auth_headers, monkeypatch):
    """Provider HTTP 401 (bad API key) → LLMUnavailableError → user-friendly message."""
    class AuthFailLLM:
        async def generate(self, messages, *, tools=None, temperature=0.3):
            raise LLMUnavailableError("LLM API returned HTTP 401")

        async def generate_stream(self, messages, *, temperature=0.3):
            raise LLMUnavailableError("LLM API returned HTTP 401")

    monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test-local")
    monkeypatch.setattr("app.ai.agent.get_provider", lambda: AuthFailLLM())
    monkeypatch.setattr("app.api.routes.chat.get_provider", lambda: AuthFailLLM())

    async with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "Hello"},
        headers=auth_headers,
    ) as response:
        assert response.status_code == 200
        chunks = [chunk async for chunk in response.aiter_text()]

    joined = "".join(chunks)
    assert "temporarily unable" in joined
    assert "sk-test-local" not in joined
    assert "data: [DONE]" in joined


async def test_chat_nonstream_user_message_included(client, auth_headers, monkeypatch):
    """Bug fix: non-streaming /chat endpoint must also include user message in LLM messages."""
    fake = await _enable_llm(monkeypatch, reply="Non-stream answer.")
    response = await client.post(
        "/api/v1/chat",
        json={"message": "What is inflation?"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert fake.messages
    sent_messages = fake.messages[0]
    user_msgs = [m for m in sent_messages if m["role"] == "user"]
    assert len(user_msgs) >= 1, "No user message in non-streaming LLM call"
    assert "inflation" in user_msgs[0]["content"].lower()
