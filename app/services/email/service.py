"""EmailService facade."""

from functools import lru_cache
from urllib.parse import urlencode

from app.core.config import settings
from app.core.logging import get_logger
from app.services.email.providers import ConsoleEmailProvider, EmailProvider, SMTPProvider, ResendProvider

logger = get_logger(__name__)


class EmailService:
    def __init__(self, provider: EmailProvider):
        self._provider = provider

    async def send_password_reset(self, to: str, reset_token: str) -> None:
        reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/en/reset-password?{urlencode({'token': reset_token})}"
        subject = "FinCompass password reset"
        body = (
            "You requested a password reset for your FinCompass account.\n\n"
            f"Click the link below to reset your password (valid for 30 minutes):\n\n"
            f"{reset_url}\n\n"
            "If you did not request this, ignore this email."
        )

        recipient_domain = to.split("@")[-1] if "@" in to else "unknown"
        provider_name = type(self._provider).__name__
        
        logger.info(
            "PASSWORD RESET EMAIL — send attempted: provider=%s to_domain=%s token_length=%s",
            provider_name,
            recipient_domain,
            len(reset_token),
        )

        try:
            await self._provider.send(to, subject, body)
            logger.info(
                "PASSWORD RESET EMAIL — provider accepted: provider=%s to_domain=%s",
                provider_name,
                recipient_domain,
            )
        except Exception as exc:
            error_type = type(exc).__name__
            error_message = str(exc)
            
            # Classify error types for better diagnostics
            if "timeout" in error_message.lower() or error_type in ["TimeoutError", "TimeoutException"]:
                error_category = "TIMEOUT"
            elif "connection" in error_message.lower() or "network" in error_message.lower():
                error_category = "NETWORK"
            elif "auth" in error_message.lower() or "login" in error_message.lower():
                error_category = "AUTHENTICATION"
            elif "101" in error_message or "unreachable" in error_message.lower():
                error_category = "NETWORK_UNREACHABLE"
            else:
                error_category = "GENERIC"
            
            logger.error(
                "PASSWORD RESET EMAIL — provider failed: provider=%s to_domain=%s error_type=%s error_category=%s error=%s",
                provider_name,
                recipient_domain,
                error_type,
                error_category,
                error_message[:200],  # Limit error message length
            )
            raise


@lru_cache
def get_email_service() -> EmailService:
    email_provider_name = settings.EMAIL_PROVIDER
    smtp_host = settings.SMTP_HOST
    smtp_from = settings.SMTP_FROM
    smtp_username = settings.SMTP_USERNAME
    resend_api_key = settings.RESEND_API_KEY
    resend_from = settings.RESEND_FROM

    logger.info(
        "EMAIL SERVICE INIT — provider=%s smtp_host=%s resend_key=%s",
        email_provider_name,
        "set" if smtp_host else "not_set",
        "set" if resend_api_key else "not_set",
    )

    # Handle SMTP provider
    if email_provider_name == "smtp":
        if smtp_host:
            missing = []
            if not smtp_username:
                missing.append("SMTP_USERNAME")
            if not settings.SMTP_PASSWORD:
                missing.append("SMTP_PASSWORD")
            if not smtp_from:
                missing.append("SMTP_FROM")
            
            if missing:
                logger.warning(
                    "EMAIL SERVICE INIT — SMTP selected but missing credentials: %s. Falling back to ConsoleEmailProvider.",
                    ", ".join(missing),
                )
                provider = _get_fallback_provider()
            else:
                provider = SMTPProvider(
                    smtp_host,
                    settings.SMTP_PORT,
                    settings.SMTP_USERNAME,
                    settings.SMTP_PASSWORD,
                    settings.SMTP_FROM,
                )
                logger.info("EMAIL SERVICE INIT — using SMTPProvider host=%s port=%s", smtp_host, settings.SMTP_PORT)
        else:
            logger.warning(
                "EMAIL SERVICE INIT — EMAIL_PROVIDER=smtp but SMTP_HOST not set. Falling back to ConsoleEmailProvider."
            )
            provider = _get_fallback_provider()
    
    # Handle Resend provider
    elif email_provider_name == "resend":
        if resend_api_key and resend_from:
            provider = ResendProvider(resend_api_key, resend_from)
            logger.info("EMAIL SERVICE INIT — using ResendProvider from=%s", resend_from)
        else:
            missing = []
            if not resend_api_key:
                missing.append("RESEND_API_KEY")
            if not resend_from:
                missing.append("RESEND_FROM")
            logger.warning(
                "EMAIL SERVICE INIT — Resend selected but missing credentials: %s. Falling back to ConsoleEmailProvider.",
                ", ".join(missing),
            )
            provider = _get_fallback_provider()
    
    # Handle console provider (default)
    else:
        provider = _get_fallback_provider()

    logger.info("EMAIL SERVICE — initialized with provider=%s", type(provider).__name__)
    return EmailService(provider)


def _get_fallback_provider() -> EmailProvider:
    """Get console provider with appropriate warnings for production."""
    if settings.is_production:
        logger.warning(
            "EMAIL SERVICE INIT — using ConsoleEmailProvider in PRODUCTION. "
            "Emails will NOT be delivered. Configure a real email provider (SMTP or Resend)."
        )
    else:
        logger.info("EMAIL SERVICE INIT — using ConsoleEmailProvider (development)")
    return ConsoleEmailProvider()
