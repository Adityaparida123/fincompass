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
        logger.info("EMAIL PROVIDER — SMTPProvider initialized: host=%s port=%s username_set=%s", 
                   host, port, bool(username))

    async def send(self, to: str, subject: str, body: str) -> None:
        import smtplib
        import asyncio

        msg = EmailMessage()
        msg["From"] = self.from_addr or self.username or "noreply@fincompass.app"
        msg["Subject"] = subject
        msg["To"] = to
        msg.set_content(body)
        
        logger.info("EMAIL — SMTP send attempted: to_domain=%s", to.split("@")[-1] if "@" in to else "unknown")
        
        try:
            # Use asyncio.to_thread to run blocking SMTP operations in a thread pool
            await asyncio.to_thread(self._send_sync, msg)
            logger.info("EMAIL — SMTP accepted: to_domain=%s", to.split("@")[-1] if "@" in to else "unknown")
        except Exception as exc:
            logger.error("EMAIL — SMTP rejected/failed: to_domain=%s error=%s error_type=%s", 
                        to.split("@")[-1] if "@" in to else "unknown", 
                        str(exc), type(exc).__name__)
            raise

    def _send_sync(self, msg: EmailMessage) -> None:
        """Synchronous SMTP send that runs in a thread pool."""
        import smtplib
        with smtplib.SMTP(self.host, self.port, timeout=15) as server:
            if self.username and self.password:
                server.starttls()
                server.login(self.username, self.password)
            server.send_message(msg)


class ResendProvider(EmailProvider):
    """Resend.com HTTP API provider."""
    
    def __init__(self, api_key: str, from_addr: str):
        self.api_key = api_key
        self.from_addr = from_addr
        self.base_url = "https://api.resend.com"
        logger.info("EMAIL PROVIDER — ResendProvider initialized: from=%s", from_addr)
    
    async def send(self, to: str, subject: str, body: str) -> None:
        import httpx
        import asyncio
        
        logger.info("EMAIL — Resend send attempted: to_domain=%s", to.split("@")[-1] if "@" in to else "unknown")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/emails",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": self.from_addr,
                        "to": [to],
                        "subject": subject,
                        "text": body,
                    }
                )
                
                if response.status_code == 200:
                    logger.info("EMAIL — Resend accepted: to_domain=%s", to.split("@")[-1] if "@" in to else "unknown")
                else:
                    error_msg = f"HTTP {response.status_code}: {response.text[:100]}"
                    logger.error("EMAIL — Resend rejected: to_domain=%s error=%s", 
                                to.split("@")[-1] if "@" in to else "unknown",
                                error_msg)
                    raise Exception(f"Resend API error: {error_msg}")
                    
        except httpx.TimeoutException:
            logger.error("EMAIL — Resend timeout: to_domain=%s", to.split("@")[-1] if "@" in to else "unknown")
            raise Exception("Resend API timeout")
        except Exception as exc:
            logger.error("EMAIL — Resend failed: to_domain=%s error=%s error_type=%s", 
                        to.split("@")[-1] if "@" in to else "unknown",
                        str(exc), type(exc).__name__)
            raise
