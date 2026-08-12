"""Health check endpoint."""

from fastapi import APIRouter

from app import __version__
from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "finai-backend",
        "version": settings.APP_VERSION or __version__,
    }
