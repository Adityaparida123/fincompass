"""Authenticated voice transport tests.

STT (Sarvam AI) and TTS (Google) are exercised with mocked HTTP clients so no
real external API calls are made during tests.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.exceptions import (
    InvalidInputError,
    STTAuthError,
    STTConfigError,
    STTUpstreamError,
)
from app.services import voice as voice_service


def _sarvam_response(status_code: int = 200, payload=None) -> MagicMock:
    response = MagicMock()
    response.status_code = status_code
    response.json.return_value = payload if payload is not None else {}
    return response


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
async def test_stt_uses_mocked_service(client, auth_headers, monkeypatch):
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
async def test_stt_reports_no_speech(client, auth_headers, monkeypatch):
    mocked = AsyncMock(side_effect=InvalidInputError("I couldn't hear anything. Please try again."))
    monkeypatch.setattr("app.api.routes.voice.voice_service.transcribe_audio", mocked)
    response = await client.post(
        "/api/v1/voice/stt",
        headers=auth_headers,
        files={"audio": ("voice.webm", b"audio", "audio/webm")},
        data={"language": "en-IN"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["message"] == "I couldn't hear anything. Please try again."


def test_sarvam_missing_api_key_raises_config_error(monkeypatch):
    monkeypatch.setattr(voice_service.settings, "SARVAM_API_KEY", None)
    with pytest.raises(STTConfigError):
        voice_service._stt_sync(b"audio", "audio/webm", "en-IN")


def test_sarvam_success_response(monkeypatch):
    monkeypatch.setattr(voice_service.settings, "SARVAM_API_KEY", "test-key")
    with patch.object(
        voice_service.httpx.Client, "post",
        return_value=_sarvam_response(200, {"transcript": "hello world"}),
    ) as mock_post:
        result = voice_service._stt_sync(b"audio", "audio/webm", "en-IN")
    assert result == "hello world"
    _, kwargs = mock_post.call_args
    assert kwargs["headers"]["api-subscription-key"] == "test-key"
    assert kwargs["files"]["file"][0] == "finai-voice.webm"


def test_sarvam_success_sends_language_and_model(monkeypatch):
    monkeypatch.setattr(voice_service.settings, "SARVAM_API_KEY", "test-key")
    with patch.object(
        voice_service.httpx.Client, "post",
        return_value=_sarvam_response(200, {"transcript": "namaste"}),
    ) as mock_post:
        voice_service._stt_sync(b"audio", "audio/webm", "hi-IN")
    _, kwargs = mock_post.call_args
    assert kwargs["files"]["language_code"] == (None, "hi-IN")
    assert kwargs["files"]["model"] == (None, "saaras:v3")
    assert kwargs["headers"]["api-subscription-key"] == "test-key"


def test_sarvam_auth_failure(monkeypatch):
    monkeypatch.setattr(voice_service.settings, "SARVAM_API_KEY", "bad-key")
    with patch.object(
        voice_service.httpx.Client, "post",
        return_value=_sarvam_response(401, {"message": "unauthorized"}),
    ):
        with pytest.raises(STTAuthError):
            voice_service._stt_sync(b"audio", "audio/webm", "en-IN")


def test_sarvam_forbidden_treated_as_auth_failure(monkeypatch):
    monkeypatch.setattr(voice_service.settings, "SARVAM_API_KEY", "bad-key")
    with patch.object(
        voice_service.httpx.Client, "post",
        return_value=_sarvam_response(403, {"message": "forbidden"}),
    ):
        with pytest.raises(STTAuthError):
            voice_service._stt_sync(b"audio", "audio/webm", "en-IN")


def test_sarvam_upstream_failure(monkeypatch):
    monkeypatch.setattr(voice_service.settings, "SARVAM_API_KEY", "test-key")
    with patch.object(
        voice_service.httpx.Client, "post",
        return_value=_sarvam_response(503, {"message": "upstream down"}),
    ):
        with pytest.raises(STTUpstreamError):
            voice_service._stt_sync(b"audio", "audio/webm", "en-IN")


def test_sarvam_http_error_treated_as_upstream(monkeypatch):
    from httpx import ConnectError
    monkeypatch.setattr(voice_service.settings, "SARVAM_API_KEY", "test-key")
    with patch.object(voice_service.httpx.Client, "post", side_effect=ConnectError("boom")):
        with pytest.raises(STTUpstreamError):
            voice_service._stt_sync(b"audio", "audio/webm", "en-IN")


def test_sarvam_malformed_response_raises_upstream(monkeypatch):
    monkeypatch.setattr(voice_service.settings, "SARVAM_API_KEY", "test-key")
    response = MagicMock()
    response.status_code = 200
    response.json.side_effect = ValueError("bad json")
    with patch.object(voice_service.httpx.Client, "post", return_value=response):
        with pytest.raises(STTUpstreamError):
            voice_service._stt_sync(b"audio", "audio/webm", "en-IN")


def test_sarvam_malformed_transcript_raises_no_speech(monkeypatch):
    monkeypatch.setattr(voice_service.settings, "SARVAM_API_KEY", "test-key")
    with patch.object(
        voice_service.httpx.Client, "post",
        return_value=_sarvam_response(200, {"transcript": "   "}),
    ):
        with pytest.raises(InvalidInputError):
            voice_service._stt_sync(b"audio", "audio/webm", "en-IN")


@pytest.mark.asyncio
async def test_sarvam_empty_recording_rejected_at_service():
    with pytest.raises(InvalidInputError):
        await voice_service.transcribe_audio(b"", "audio/webm", "en-IN")


def test_sarvam_api_key_never_in_logs_or_errors(caplog, monkeypatch):
    monkeypatch.setattr(voice_service.settings, "SARVAM_API_KEY", "super-secret-key-12345")
    with patch.object(voice_service.httpx.Client, "post", return_value=_sarvam_response(500, {"error": "boom"})):
        with pytest.raises(STTUpstreamError):
            voice_service._stt_sync(b"audio", "audio/webm", "en-IN")
    assert "super-secret-key-12345" not in caplog.text


def test_english_language_mapping_accepted():
    assert "en-IN" in voice_service._LANGUAGE_CODES


def test_hindi_language_mapping_accepted():
    assert "hi-IN" in voice_service._LANGUAGE_CODES


@pytest.mark.asyncio
async def test_language_rejected_unsupported():
    with pytest.raises(InvalidInputError):
        await voice_service.transcribe_audio(b"audio", "audio/webm", "fr-FR")


@pytest.mark.asyncio
async def test_stt_missing_api_key_returns_503(client, auth_headers, monkeypatch):
    async def _raise(*args, **kwargs):
        raise STTConfigError("Voice input is not configured yet.")
    monkeypatch.setattr("app.api.routes.voice.voice_service.transcribe_audio", _raise)
    response = await client.post(
        "/api/v1/voice/stt",
        headers=auth_headers,
        files={"audio": ("voice.webm", b"audio", "audio/webm")},
        data={"language": "en-IN"},
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "STT_NOT_CONFIGURED"


@pytest.mark.asyncio
async def test_stt_provider_auth_failure_returns_401(client, auth_headers, monkeypatch):
    async def _raise(*args, **kwargs):
        raise STTAuthError("Voice input could not be authorized.")
    monkeypatch.setattr("app.api.routes.voice.voice_service.transcribe_audio", _raise)
    response = await client.post(
        "/api/v1/voice/stt",
        headers=auth_headers,
        files={"audio": ("voice.webm", b"audio", "audio/webm")},
        data={"language": "en-IN"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "STT_AUTH_FAILED"


@pytest.mark.asyncio
async def test_tts_uses_mocked_service(client, auth_headers, monkeypatch):
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
