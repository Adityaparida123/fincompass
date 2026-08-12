"""Email provider implementations."""

from abc import ABC, abstractmethod

from app.core.logging import get_logger

logger = get_logger(__name__)


class EmailProvider(ABC):
    @abstractmethod
    async def send(self, to: str, subject: str, body: str) -> None:
        """Send a plain-text email."""


class ConsoleEmailProvider(EmailProvider):
    """Development provider that logs emails to stdout."""

    async def send(self, to: str, subject: str, body: str) -> None:
        logger.info(
            "EMAIL (console) to=%s subject=%s\n%s",
            to,
            subject,
            body,
        )


class SMTPProvider(EmailProvider):
    """SMTP provider stub — configure via environment when needed."""

    def __init__(self, host: str, port: int, username: str | None, password: str | None):
        self.host = host
        self.port = port
        self.username = username
        self.password = password

    async def send(self, to: str, subject: str, body: str) -> None:
        import smtplib
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["To"] = to
        msg.set_content(body)
        with smtplib.SMTP(self.host, self.port, timeout=10) as server:
            if self.username and self.password:
                server.starttls()
                server.login(self.username, self.password)
            server.send_message(msg)
