"""Email provider implementations."""

from abc import ABC, abstractmethod

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
        self.from_addr = from_addr

    async def send(self, to: str, subject: str, body: str) -> None:
        import smtplib
        from email.message import EmailMessage

        msg = EmailMessage()
        if self.from_addr:
            msg["From"] = self.from_addr
        msg["Subject"] = subject
        msg["To"] = to
        msg.set_content(body)
        with smtplib.SMTP(self.host, self.port, timeout=10) as server:
            if self.username and self.password:
                server.starttls()
                server.login(self.username, self.password)
            server.send_message(msg)
