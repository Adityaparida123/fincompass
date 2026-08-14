"""Application configuration loaded from environment variables.

Uses pydantic-settings. Never store secrets in code; always read from
the environment or a `.env` file (which must never be committed).
"""

from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Secrets/values that are never acceptable in production.
_WEAK_JWT_SECRETS = frozenset({
    "",
    "change-me",
    "change_me",
    "changeme",
    "secret",
    "test-secret-key",
    "dev-secret",
    "dev-local-secret-change-in-production",
})


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "FinAI Backend"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # Runtime database is MongoDB (Atlas in production).
    # DATABASE_URL remains for Alembic / data-migration tooling only.
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str | None = None

    DATABASE_URL: str = "sqlite+aiosqlite:///./finai_dev.sqlite"
    REDIS_URL: str = "redis://localhost:6379/0"

    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    # Development fallback only. Production requires a strong JWT_SECRET_KEY
    # (enforced by the model_validator below — the app fails fast, it never
    # silently falls back to a weak secret).
    JWT_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS_REMEMBER: int = 90

    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    # LLM provider (Groq by default, OpenAI-compatible). Override via env:
    # LLM_API_KEY, LLM_MODEL, LLM_BASE_URL.
    LLM_API_KEY: str | None = None
    LLM_MODEL: str = "llama-3.3-70b-versatile"
    LLM_BASE_URL: str = "https://api.groq.com/openai/v1"
    LLM_TIMEOUT_SECONDS: float = 60.0
    LLM_READ_TIMEOUT_SECONDS: float = 90.0
    LLM_MAX_RETRIES: int = 2

    CORS_ORIGINS: str = "http://localhost:3000"

    DEFAULT_CURRENCY: str = "INR"
    DEFAULT_TIMEZONE: str = "Asia/Kolkata"

    LOG_LEVEL: str = "INFO"

    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_AUTH_LIMIT: int = 20
    RATE_LIMIT_AUTH_WINDOW: int = 60
    RATE_LIMIT_CHAT_LIMIT: int = 30
    RATE_LIMIT_CHAT_WINDOW: int = 60
    RATE_LIMIT_ML_LIMIT: int = 60
    RATE_LIMIT_ML_WINDOW: int = 60

    CACHE_ENABLED: bool = True
    CACHE_TTL_SECONDS: int = 300

    EMAIL_PROVIDER: str = "console"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None

    KNOWLEDGE_BASE_DIR: str = "knowledge_base"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        """Normalize Render/Heroku-style URLs to SQLAlchemy async drivers."""
        if not isinstance(v, str):
            return v
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql://", 1)
        if v.startswith("postgresql://") and "+asyncpg" not in v:
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("CORS_ORIGINS")
    @classmethod
    def parse_cors_origins(cls, v: str) -> list[str]:
        return [origin.strip() for origin in v.split(",") if origin.strip()]

    @field_validator("LLM_MODEL", "LLM_BASE_URL", mode="before")
    @classmethod
    def llm_blank_to_default(cls, v: str, info) -> str:
        """Treat blank env values as unset so the Groq defaults apply."""
        if isinstance(v, str) and not v.strip():
            return cls.model_fields[info.field_name].default
        return v

    @field_validator("LLM_API_KEY", mode="before")
    @classmethod
    def llm_blank_key_to_none(cls, v: str) -> str | None:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @model_validator(mode="after")
    def enforce_production_safety(self) -> "Settings":
        """Fail fast (at startup) when production settings are unsafe.

        Never silently fall back to a weak JWT secret or an unsupported
        database in production.
        """
        if self.is_production:
            secret = self.JWT_SECRET_KEY or ""
            if secret in _WEAK_JWT_SECRETS or len(secret) < 32:
                raise ValueError(
                    "APP_ENV=production requires a strong JWT_SECRET_KEY "
                    "(at least 32 random characters). Refusing to start with a weak secret."
                )
            mongo_uri = (self.MONGODB_URI or "").strip()
            if not mongo_uri or mongo_uri == "mongodb://localhost:27017":
                raise ValueError(
                    "APP_ENV=production requires MONGODB_URI pointing to a "
                    "managed MongoDB instance (e.g. MongoDB Atlas). "
                    "Refusing to start with a local/empty Mongo URI."
                )
        return self

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

    @property
    def is_postgresql(self) -> bool:
        return "postgresql" in self.DATABASE_URL

    @property
    def is_mongodb(self) -> bool:
        return bool(self.MONGODB_URI)

    @property
    def mongo_database(self) -> str:
        return self.MONGODB_DATABASE or ("fincompass" if self.is_production else "fincompass_dev")

    @property
    def database_backend(self) -> str:
        return "mongodb"

    @property
    def cookie_secure(self) -> bool:
        return self.COOKIE_SECURE or self.is_production

    @property
    def database_url(self) -> str:
        return self.DATABASE_URL

    @property
    def llm_configured(self) -> bool:
        return bool(self.LLM_API_KEY and self.LLM_MODEL)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
