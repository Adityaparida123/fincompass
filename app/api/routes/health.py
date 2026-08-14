"""Health check endpoint with optional database and Redis probes."""

from fastapi import APIRouter

from app import __version__
from app.core.config import settings
from app.db.mongo import get_database

router = APIRouter(tags=["health"])


async def _check_database() -> str:
    try:
        db = get_database()
        if await db.ping():
            return "connected"
        return "disconnected"
    except Exception:
        return "disconnected"


async def _check_redis() -> str:
    try:
        from redis.asyncio import Redis

        client = Redis.from_url(settings.REDIS_URL, socket_connect_timeout=0.5)
        try:
            pong = await client.ping()
            return "connected" if pong else "disconnected"
        finally:
            await client.aclose()
    except Exception:
        return "disconnected"


def _check_ml() -> dict:
    from ml.config import ARTIFACTS_DIR

    required = [
        "transaction_classifier.joblib",
        "anomaly_detector.joblib",
        "cashflow_forecaster.joblib",
        "savings_predictor.joblib",
    ]
    return {
        "models_available": all((ARTIFACTS_DIR / name).exists() for name in required),
    }


@router.get("/health")
async def health() -> dict:
    db_status = await _check_database()
    redis_status = await _check_redis()
    overall = "healthy" if db_status == "connected" else "degraded"

    return {
        "status": overall,
        "service": "finai-backend",
        "version": settings.APP_VERSION or __version__,
        "environment": settings.APP_ENV,
        "database": {
            "backend": settings.database_backend,
            "status": db_status,
        },
        "redis": {
            "status": redis_status,
        },
        "ml": _check_ml(),
    }
