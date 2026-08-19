"""Thin re-export of contextvar helpers so service-layer modules do not
import from app.core.middleware (which pulls in Starlette)."""

from app.core.middleware import current_endpoint, current_request_id

__all__ = ["current_endpoint", "current_request_id"]
