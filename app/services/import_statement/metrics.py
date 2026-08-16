"""PII-safe processing metrics for statement imports.

Only aggregate counts and format/duration are logged — never descriptions,
amounts, account numbers or anything personally identifying.
"""

from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)


class ImportTimings:
    def __init__(self) -> None:
        self.started = time.perf_counter()

    def elapsed_ms(self) -> int:
        return int((time.perf_counter() - self.started) * 1000)


def log_import_metrics(
    *,
    file_type: str,
    elapsed_ms: int,
    rows_extracted: int,
    valid_rows: int,
    duplicates: int,
    possible_duplicates: int,
    needs_review: int,
    imported: int = 0,
    stage: str = "analyze",
) -> None:
    logger.info(
        "statement_import",
        extra={
            "event": "statement_import",
            "stage": stage,
            "file_type": file_type,
            "duration_ms": elapsed_ms,
            "rows_extracted": rows_extracted,
            "valid_rows": valid_rows,
            "duplicates": duplicates,
            "possible_duplicates": possible_duplicates,
            "needs_review": needs_review,
            "imported": imported,
        },
    )
