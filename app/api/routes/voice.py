"""Authenticated voice endpoints (Sarvam STT + Google TTS)."""

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response

from app.api.dependencies import get_current_user, rate_limit_voice
from app.core.config import settings
from app.core.exceptions import InvalidInputError
from app.schemas.voice import VoiceSTTResponse, VoiceTTSRequest
from app.services import voice as voice_service

router = APIRouter(
    prefix="/voice",
    tags=["voice"],
    dependencies=[Depends(rate_limit_voice)],
)


@router.post("/stt", response_model=VoiceSTTResponse)
async def speech_to_text(
    audio: UploadFile = File(...),  # noqa: B008
    language: str = Form("en-IN"),
    _user=Depends(get_current_user),  # noqa: B008
) -> VoiceSTTResponse:
    content_type = audio.content_type or ""
    if content_type.split(";", 1)[0].lower() not in voice_service._AUDIO_ENCODINGS:
        raise InvalidInputError("This audio format is not supported for voice input.")

    payload = await audio.read(settings.VOICE_MAX_AUDIO_SIZE + 1)
    if len(payload) > settings.VOICE_MAX_AUDIO_SIZE:
        raise InvalidInputError("The voice recording is too large. Please try a shorter recording.")
    text = await voice_service.transcribe_audio(payload, content_type, language)
    return VoiceSTTResponse(text=text, language=language)


@router.post("/tts")
async def text_to_speech(
    data: VoiceTTSRequest,
    _user=Depends(get_current_user),  # noqa: B008
) -> Response:
    if len(data.text) > settings.VOICE_TTS_MAX_CHARACTERS:
        raise InvalidInputError("The response is too long to read aloud.")
    audio = await voice_service.synthesize_speech(data.text, data.language)
    return Response(content=audio, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})
