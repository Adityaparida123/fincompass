"""FinAI Backend application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    auth,
    budget,
    cashflow,
    chat,
    consent,
    credit_readiness,
    debt,
    expenses,
    financial_health,
    health,
    loans,
    ml,
    notifications,
    recommendations,
    recycle_bin,
    savings,
    schemes,
    transactions,
    users,
)
from app.core.config import settings
from app.core.exceptions import (
    AppError,
    app_exception_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.core.logging import setup_logging
from app.core.middleware import AuditContextMiddleware, RequestIDMiddleware
from app.db.mongo import connect, disconnect, get_database


def _redact_uri(message: str) -> str:
    """Redact any configured credential-bearing URLs from a log message."""
    for url in (settings.MONGODB_URI, settings.REDIS_URL, settings.DATABASE_URL):
        if url and url in message:
            message = message.replace(url, "<redacted-url>")
    return message


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    from app.core.logging import get_logger

    logger = get_logger("app.main")

    # Connect to MongoDB, ensure indexes, seed reference schemes, and
    # backfill consent records for any users created before the consent
    # system was introduced.
    try:
        await connect()
        db = get_database()
        from app.db.indexes import ensure_indexes

        await ensure_indexes(db)
        from app.services.schemes.service import ensure_seed_schemes, migrate_scheme_urls

        count = await ensure_seed_schemes(db)
        if count:
            logger.info("Seeded %d reference schemes.", count)
        migrated = await migrate_scheme_urls(db)
        if migrated:
            logger.info("Migrated source_url for %d schemes.", migrated)
        from app.services.consent.service import backfill_consents

        backfilled = await backfill_consents(db)
        if backfilled:
            logger.info("Backfilled %d missing consent records.", backfilled)
    except Exception as exc:  # noqa: BLE001
        # Production must fail fast: a running app without its database is a
        # broken deployment that health checks would otherwise mask as healthy.
        # Log the error class and a redacted message — never the raw exception,
        # which can embed the MongoDB connection string (and its credentials).
        detail = f"{type(exc).__name__}: {_redact_uri(str(exc))}"
        if settings.is_production:
            logger.error(
                "MongoDB startup failed in production; aborting startup (%s).",
                detail,
            )
            raise
        logger.warning("Mongo connect/scheme seeding failed (database not ready?): %s", detail)

    logger.info("%s v%s starting (%s)", settings.APP_NAME, settings.APP_VERSION, settings.APP_ENV)
    yield
    try:
        await disconnect()
    except Exception:  # noqa: BLE001
        logger.debug("Mongo disconnect error ignored.", exc_info=True)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Responsible personal-finance platform and AI financial assistant backend.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditContextMiddleware)
app.add_middleware(RequestIDMiddleware)

app.add_exception_handler(AppError, app_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)
app.add_exception_handler(422, validation_exception_handler)
from starlette.exceptions import HTTPException as StarletteHTTPException

app.add_exception_handler(StarletteHTTPException, http_exception_handler)

API_PREFIX = "/api/v1"

app.include_router(health.router)
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(transactions.router, prefix=API_PREFIX)
app.include_router(expenses.router, prefix=API_PREFIX)
app.include_router(cashflow.router, prefix=API_PREFIX)
app.include_router(savings.router, prefix=API_PREFIX)
app.include_router(budget.router, prefix=API_PREFIX)
app.include_router(debt.router, prefix=API_PREFIX)
app.include_router(loans.router, prefix=API_PREFIX)
app.include_router(credit_readiness.router, prefix=API_PREFIX)
app.include_router(financial_health.router, prefix=API_PREFIX)
app.include_router(recommendations.router, prefix=API_PREFIX)
app.include_router(schemes.router, prefix=API_PREFIX)
app.include_router(consent.router, prefix=API_PREFIX)
app.include_router(chat.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)
app.include_router(recycle_bin.router, prefix=API_PREFIX)
app.include_router(ml.router, prefix=API_PREFIX)


@app.api_route("/", methods=["GET", "HEAD"])
async def root() -> dict:
    return {
        "service": "finai-backend",
        "docs": "/docs",
        "health": "/health",
    }
