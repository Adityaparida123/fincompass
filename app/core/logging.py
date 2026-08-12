"""Structured logging configuration.

All loggers go through a single configured formatter so request IDs and
structured fields are captured consistently.
"""

import logging
import sys

from app.core.config import settings

_LOG_FORMAT = "%(asctime)s | %(levelname)s | %(name)s | %(request_id)s | %(message)s"


class RequestIdFilter(logging.Filter):
    """Injects the current request_id (from contextvars) into log records."""

    def __init__(self) -> None:
        super().__init__()

    def filter(self, record: logging.LogRecord) -> bool:
        from app.core.middleware import current_request_id

        record.request_id = current_request_id() or "-"
        return True


def setup_logging() -> None:
    root = logging.getLogger()
    root.setLevel(settings.LOG_LEVEL.upper())

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_LOG_FORMAT))
    handler.addFilter(RequestIdFilter())
    root.handlers = [handler]

    # Keep third-party libraries reasonably quiet.
    for name in ("uvicorn", "uvicorn.access", "sqlalchemy.engine"):
        lg = logging.getLogger(name)
        lg.handlers.clear()
        lg.propagate = True

    logging.getLogger("uvicorn.access").disabled = False


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
