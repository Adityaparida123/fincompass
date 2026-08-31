"""EmailService facade."""

from functools import lru_cache
from urllib.parse import urlencode

from app.core.config import settings
from app.core.logging import get_logger
from app.services.email.providers import ConsoleEmailProvider, EmailProvider, SMTPProvider

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
        logger.info(
            "PASSWORD RESET EMAIL — send attempted: provider=%s to_domain=%s",
            type(self._provider).__name__,
            recipient_domain,
        )

        try:
            await self._provider.send(to, subject, body)
            logger.info(
                "PASSWORD RESET EMAIL — provider accepted message: provider=%s to_domain=%s",
                type(self._provider).__name__,
                recipient_domain,
            )
        except Exception as exc:
            logger.error(
                "PASSWORD RESET EMAIL — provider rejected/failed: provider=%s to_domain=%s error=%s",
                type(self._provider).__name__,
                recipient_domain,
                str(exc),
            )
            raise


@lru_cache
def get_email_service() -> EmailService:
    email_provider_name = settings.EMAIL_PROVIDER
    smtp_host = settings.SMTP_HOST
    smtp_from = settings.SMTP_FROM
    smtp_username = settings.SMTP_USERNAME

    logger.info(
        "EMAIL SERVICE INIT — provider_setting=%s smtp_host_set=%s smtp_from_set=%s smtp_user_set=%s",
        email_provider_name,
        bool(smtp_host),
        bool(smtp_from),
        bool(smtp_username),
    )

    if email_provider_name == "smtp" and smtp_host:
        missing = []
        if not smtp_username:
            missing.append("SMTP_USERNAME")
        if not settings.SMTP_PASSWORD:
            missing.append("SMTP_PASSWORD")
        if not smtp_from:
            missing.append("SMTP_FROM")
        if missing:
            logger.warning(
                "EMAIL SERVICE INIT — SMTP selected but missing: %s",
                ", ".join(missing),
            )

        provider = SMTPProvider(
            smtp_host,
            settings.SMTP_PORT,
            settings.SMTP_USERNAME,
            settings.SMTP_PASSWORD,
            settings.SMTP_FROM,
        )
        logger.info("EMAIL SERVICE INIT — using SMTPProvider host=%s port=%s", smtp_host, settings.SMTP_PORT)
    else:
        if settings.is_production:
            logger.warning(
                "EMAIL SERVICE INIT — using ConsoleEmailProvider in PRODUCTION. "
                "Emails will NOT be delivered. Set EMAIL_PROVIDER=smtp and SMTP_HOST in Render."
            )
        else:
            logger.info("EMAIL SERVICE INIT — using ConsoleEmailProvider (development)")
        provider = ConsoleEmailProvider()

    return EmailService(provider)
