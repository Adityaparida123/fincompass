"""Sarvam AI Speech-to-Text and Google Cloud Text-to-Speech transport.

STT (voice input) uses Sarvam AI's `/speech-to-text` REST API with a
server-side `SARVAM_API_KEY`. TTS (read aloud) uses Google Cloud
Text-to-Speech. Credentials are never returned to the client or logged.
"""

from __future__ import annotations

import asyncio
import json
import logging

import httpx

from app.core.config import settings
from app.core.exceptions import (
    InvalidInputError,
    LLMUnavailableError,
    STTAuthError,
    STTConfigError,
    STTUpstreamError,
)

logger = logging.getLogger(__name__)

_LANGUAGE_CODES = {"en-IN", "hi-IN"}

# Content types the browser MediaRecorder can produce with the current
# frontend. Sarvam auto-detects most codec formats (WebM, OGG, MP3, WAV,
# FLAC, ...), so we only gate on the set the frontend is known to send.
_AUDIO_ENCODINGS = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/flac": "flac",
}


def _validate_language(language: str) -> None:
    # English and Hindi use the same codes as the frontend, so no conversion is
    # required; reject anything outside the supported set.
    if language not in _LANGUAGE_CODES:
        raise InvalidInputError("Voice language is not supported.")


def _sarvam_api_key() -> str:
    if not settings.SARVAM_API_KEY:
        raise STTConfigError("Voice input is not configured yet.")
    return settings.SARVAM_API_KEY


def _stt_sync(audio: bytes, content_type: str, language: str) -> str:
    api_key = _sarvam_api_key()
    extension = _AUDIO_ENCODINGS.get(content_type.split(";", 1)[0].lower())
    if extension is None:
        raise InvalidInputError("This audio format is not supported for voice input.")

    headers = {
        "api-subscription-key": api_key,
        "Accept": "application/json",
    }
    files = {
        "file": (f"finai-voice.{extension}", audio, content_type.split(";", 1)[0].lower()),
        "language_code": (None, language),
        "model": (None, settings.SARVAM_STT_MODEL),
    }
    try:
        with httpx.Client(timeout=settings.SARVAM_STT_TIMEOUT_SECONDS) as client:
            response = client.post(settings.SARVAM_STT_URL, headers=headers, files=files)
    except httpx.HTTPError as exc:
        raise STTUpstreamError("Voice input is temporarily unavailable.") from exc

    if response.status_code in (401, 403):
        raise STTAuthError("Voice input could not be authorized.")
    if response.status_code >= 400:
        raise STTUpstreamError("Voice input is temporarily unavailable.")

    try:
        payload = response.json()
    except ValueError as exc:
        raise STTUpstreamError("Voice input is temporarily unavailable.") from exc

    transcript = payload.get("transcript")
    if not isinstance(transcript, str) or not transcript.strip():
        raise InvalidInputError("I couldn't hear anything. Please try again.")
    return transcript.strip()


def _tts_sync(text: str, language: str) -> bytes:
    try:
        from google.cloud import texttospeech
    except ImportError as exc:
        raise LLMUnavailableError("Read aloud is temporarily unavailable.") from exc
    try:
        client_kwargs = {}
        credentials = _google_credentials()
        if credentials is not None:
            client_kwargs["credentials"] = credentials
        client = texttospeech.TextToSpeechClient(**client_kwargs)
        response = client.synthesize_speech(
            request={
                "input": texttospeech.SynthesisInput(text=text),
                "voice": texttospeech.VoiceSelectionParams(
                    language_code=language,
                    ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL,
                ),
                "audio_config": texttospeech.AudioConfig(
                    audio_encoding=texttospeech.AudioEncoding.MP3,
                ),
            }
        )
        return response.audio_content
    except Exception as exc:  # Google SDK errors must not reach the client.
        logger.warning("Google TTS request failed: %s", type(exc).__name__)
        raise LLMUnavailableError("Read aloud is temporarily unavailable.") from exc


def _google_credentials():
    if settings.GOOGLE_APPLICATION_CREDENTIALS_JSON:
        from google.oauth2 import service_account

        info = json.loads(settings.GOOGLE_APPLICATION_CREDENTIALS_JSON)
        return service_account.Credentials.from_service_account_info(info)
    if settings.GOOGLE_APPLICATION_CREDENTIALS:
        from google.oauth2 import service_account

        return service_account.Credentials.from_service_account_file(
            settings.GOOGLE_APPLICATION_CREDENTIALS
        )
    return None


def _google_credentials_configured() -> bool:
    # The SDK supports ADC, workload identity, and service-account files. Let
    # the client attempt those mechanisms instead of requiring one env var.
    return True


async def transcribe_audio(audio: bytes, content_type: str, language: str) -> str:
    _validate_language(language)
    if not audio:
        raise InvalidInputError("No audio was recorded. Please try again.")
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_stt_sync, audio, content_type, language),
            timeout=settings.SARVAM_STT_TIMEOUT_SECONDS,
        )
    except TimeoutError as exc:
        raise LLMUnavailableError("Voice input timed out. Please try again.") from exc


async def synthesize_speech(text: str, language: str) -> bytes:
    _validate_language(language)
    text = text.strip()
    if not text:
        raise InvalidInputError("There is no response to read aloud.")
    if not _google_credentials_configured():
        raise LLMUnavailableError("Read aloud is not configured yet.")
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_tts_sync, text, language),
            timeout=settings.VOICE_TIMEOUT_SECONDS,
        )
    except TimeoutError as exc:
        raise LLMUnavailableError("Read aloud timed out. Please try again.") from exc
