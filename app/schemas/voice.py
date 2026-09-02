"""Schemas for authenticated Google Cloud voice transport."""

from typing import Literal

from pydantic import BaseModel, Field


VoiceLanguage = Literal["en-IN", "hi-IN"]


class VoiceTTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    language: VoiceLanguage


class VoiceSTTResponse(BaseModel):
    text: str
    language: VoiceLanguage
