"""EmailService facade."""

from functools import lru_cache

from app.core.config import settings
from app.services.email.providers import ConsoleEmailProvider, EmailProvider, SMTPProvider


class EmailService:
    def __init__(self, provider: EmailProvider):
        self._provider = provider

    async def send_password_reset(self, to: str, reset_token: str) -> None:
        subject = "FinAI password reset"
        body = (
            "You requested a password reset for your FinAI account.\n\n"
            f"Reset token (valid for 30 minutes):\n{reset_token}\n\n"
            "If you did not request this, ignore this email."
        )
        await self._provider.send(to, subject, body)


@lru_cache
def get_email_service() -> EmailService:
    if settings.EMAIL_PROVIDER == "smtp" and settings.SMTP_HOST:
        provider = SMTPProvider(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            settings.SMTP_USERNAME,
            settings.SMTP_PASSWORD,
        )
    else:
        provider = ConsoleEmailProvider()
    return EmailService(provider)
