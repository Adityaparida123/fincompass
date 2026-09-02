"""Authenticated voice transport tests with Google clients mocked."""

from unittest.mock import AsyncMock

import pytest


@pytest.mark.asyncio
async def test_stt_requires_auth(client):
    response = await client.post(
        "/api/v1/voice/stt",
        files={"audio": ("voice.webm", b"audio", "audio/webm")},
        data={"language": "en-IN"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_stt_rejects_empty_audio(client, auth_headers):
    response = await client.post(
        "/api/v1/voice/stt",
        headers=auth_headers,
        files={"audio": ("voice.webm", b"", "audio/webm")},
        data={"language": "en-IN"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_INPUT"


@pytest.mark.asyncio
async def test_stt_rejects_unsupported_audio(client, auth_headers):
    response = await client.post(
        "/api/v1/voice/stt",
        headers=auth_headers,
        files={"audio": ("voice.txt", b"not audio", "text/plain")},
        data={"language": "en-IN"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_stt_uses_mocked_google_service(client, auth_headers, monkeypatch):
    mocked = AsyncMock(return_value="What are my biggest financial risks?")
    monkeypatch.setattr("app.api.routes.voice.voice_service.transcribe_audio", mocked)
    response = await client.post(
        "/api/v1/voice/stt",
        headers=auth_headers,
        files={"audio": ("voice.webm", b"audio", "audio/webm")},
        data={"language": "hi-IN"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "text": "What are my biggest financial risks?",
        "language": "hi-IN",
    }
    mocked.assert_awaited_once()
    assert mocked.await_args.args[2] == "hi-IN"


@pytest.mark.asyncio
async def test_tts_uses_mocked_google_service(client, auth_headers, monkeypatch):
    mocked = AsyncMock(return_value=b"fake-mp3")
    monkeypatch.setattr("app.api.routes.voice.voice_service.synthesize_speech", mocked)
    response = await client.post(
        "/api/v1/voice/tts",
        headers=auth_headers,
        json={"text": "Your cash flow is stable.", "language": "en-IN"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == b"fake-mp3"
    mocked.assert_awaited_once_with("Your cash flow is stable.", "en-IN")


@pytest.mark.asyncio
async def test_tts_rejects_unsupported_language(client, auth_headers):
    response = await client.post(
        "/api/v1/voice/tts",
        headers=auth_headers,
        json={"text": "Hello", "language": "fr-FR"},
    )
    assert response.status_code == 422
