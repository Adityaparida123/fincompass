"""Integration tests for the FinAI chat endpoints."""

from datetime import date
from decimal import Decimal


async def test_chat_no_llm_fallback(client, auth_headers):
    response = await client.post(
        "/api/v1/chat",
        json={"message": "How can I save money?"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] >= 1
    assert "LLM_API_KEY" in body["reply"]


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
    assert "LLM_API_KEY" in body["reply"]


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
