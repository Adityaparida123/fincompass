"""Google Cloud Speech-to-Text and Text-to-Speech transport."""

from __future__ import annotations

import asyncio
import json
import logging

from app.core.config import settings
from app.core.exceptions import InvalidInputError, LLMUnavailableError

logger = logging.getLogger(__name__)

_LANGUAGE_CODES = {"en-IN", "hi-IN"}
_AUDIO_ENCODINGS = {
    "audio/webm": "WEBM_OPUS",
    "audio/ogg": "OGG_OPUS",
    "audio/mpeg": "MP3",
    "audio/mp3": "MP3",
    "audio/wav": "LINEAR16",
    "audio/x-wav": "LINEAR16",
    "audio/flac": "FLAC",
}


def _validate_language(language: str) -> None:
    if language not in _LANGUAGE_CODES:
        raise InvalidInputError("Voice language is not supported.")


def _google_credentials_configured() -> bool:
    # The SDK supports ADC, workload identity, and service-account files. Let
    # the client attempt those mechanisms instead of requiring one env var.
    return True


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


def _stt_sync(audio: bytes, content_type: str, language: str) -> str:
    try:
        from google.cloud import speech
    except ImportError as exc:
        raise LLMUnavailableError("Voice input is temporarily unavailable.") from exc

    encoding_name = _AUDIO_ENCODINGS.get(content_type.split(";", 1)[0].lower())
    if encoding_name is None:
        raise InvalidInputError("This audio format is not supported for voice input.")
    try:
        client_kwargs = {}
        credentials = _google_credentials()
        if credentials is not None:
            client_kwargs["credentials"] = credentials
        client = speech.SpeechClient(**client_kwargs)
        config_kwargs = {
            "encoding": getattr(speech.RecognitionConfig.AudioEncoding, encoding_name),
            "language_code": language,
            "enable_automatic_punctuation": True,
        }
        if encoding_name in {"WEBM_OPUS", "OGG_OPUS"}:
            config_kwargs["sample_rate_hertz"] = 48000
        response = client.recognize(
            config=speech.RecognitionConfig(**config_kwargs),
            audio=speech.RecognitionAudio(content=audio),
        )
        transcript = " ".join(
            result.alternatives[0].transcript.strip()
            for result in response.results
            if result.alternatives and result.alternatives[0].transcript.strip()
        ).strip()
        if not transcript:
            raise InvalidInputError("I couldn't hear anything. Please try again.")
        return transcript
    except InvalidInputError:
        raise
    except Exception as exc:  # Google SDK errors must not reach the client.
        logger.warning("Google STT request failed: %s", type(exc).__name__)
        raise LLMUnavailableError("Voice input is temporarily unavailable.") from exc


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


async def transcribe_audio(audio: bytes, content_type: str, language: str) -> str:
    _validate_language(language)
    if not audio:
        raise InvalidInputError("No audio was recorded. Please try again.")
    if not _google_credentials_configured():
        raise LLMUnavailableError("Voice input is not configured yet.")
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_stt_sync, audio, content_type, language),
            timeout=settings.VOICE_TIMEOUT_SECONDS,
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
