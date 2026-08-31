"""Email provider implementations."""

from abc import ABC, abstractmethod
from email.message import EmailMessage

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class EmailProvider(ABC):
    @abstractmethod
    async def send(self, to: str, subject: str, body: str) -> None:
        """Send a plain-text email."""


class ConsoleEmailProvider(EmailProvider):
    """Development provider that logs emails to stdout.

    In production this provider must never leak email bodies (they can contain
    password-reset tokens). If EMAIL_PROVIDER is left at the console default in
    production, we log a warning and skip delivery so secrets never reach the logs.
    """

    async def send(self, to: str, subject: str, body: str) -> None:
        if settings.is_production:
            logger.warning(
                "EMAIL (console) attempted in production to=%s subject=%s — "
                "message NOT delivered and body NOT logged. Configure a real "
                "EMAIL_PROVIDER (SMTP) for production.",
                to,
                subject,
            )
            return
        logger.info(
            "EMAIL (console) to=%s subject=%s\n%s",
            to,
            subject,
            body,
        )


class SMTPProvider(EmailProvider):
    """SMTP provider — configure via environment when needed."""

    def __init__(self, host: str, port: int, username: str | None, password: str | None, from_addr: str | None = None):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.from_addr = from_addr or username

    async def send(self, to: str, subject: str, body: str) -> None:
        import smtplib
        import asyncio

        msg = EmailMessage()
        msg["From"] = self.from_addr or self.username or "noreply@fincompass.app"
        msg["Subject"] = subject
        msg["To"] = to
        msg.set_content(body)
        
        # Use asyncio.to_thread to run blocking SMTP operations in a thread pool
        await asyncio.to_thread(self._send_sync, msg)

    def _send_sync(self, msg: EmailMessage) -> None:
        """Synchronous SMTP send that runs in a thread pool."""
        import smtplib
        with smtplib.SMTP(self.host, self.port, timeout=15) as server:
            if self.username and self.password:
                server.starttls()
                server.login(self.username, self.password)
            server.send_message(msg)
