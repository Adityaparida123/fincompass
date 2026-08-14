"""Integration tests for the FinAI chat endpoints."""

from app.core.config import settings


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
    fake = await _enable_llm(monkeypatch)
    response = await client.post(
        "/api/v1/chat",
        json={"message": "How much can I save this month?"},
        headers=auth_headers,
    )
    assert response.status_code == 403
    assert fake.messages == []  # nothing sent to the model without consent


async def test_chat_stream_personal_requires_consent(client, auth_headers, monkeypatch):
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
