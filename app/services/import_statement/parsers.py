"""File format detection and bank-statement parsing (PDF / XLSX / XLS / CSV).

Parsing is deliberately conservative: rows that cannot be confidently mapped
(date/description/amount) are skipped rather than guessed, and the counts are
reported back to the review screen.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path

from app.core.exceptions import InvalidInputError
from app.services.import_statement.normalize import (
    clean_description,
    enforce_row_limit,
    normalize_reference,
    parse_amount,
    parse_date,
)

DATE_HINTS = (
    "date",
    "txn date",
    "trans date",
    "transaction date",
    "posting date",
    "value date",
    "date of",
    "dt",
)
DESC_HINTS = (
    "description",
    "narration",
    "particulars",
    "particular",
    "details",
    "transaction details",
    "narrative",
    "remarks",
    "note",
    "merchant",
    "payee",
    "transaction",
)
AMOUNT_HINTS = ("amount", "transaction amount", "amount (inr)", "amount(inr)", "amt", "value")
DEBIT_HINTS = ("debit", "debit amount", "withdrawal", "withdrawals", "withdrawal (dr)", "dr")
CREDIT_HINTS = ("credit", "credit amount", "deposit", "deposits", "deposit (cr)", "cr")
TYPE_HINTS = ("type", "tran type", "txn type", "transaction type", "dr/cr", "drcr")
BALANCE_HINTS = ("balance", "closing balance", "running balance", "available balance", "balance amount")
REF_HINTS = ("reference", "utr", "ref no", "ref number", "ref", "transaction id", "txn id", "cheque no", "chq no", "receipt no")

_SUMMARY_RE = re.compile(
    r"^\s*(total|subtotal|opening balance|closing balance|balance carried|"
    r"balance brought|carried forward|brought forward|grand total|"
    r"available balance|account balance|statement period|page)\b",
    re.IGNORECASE,
)

_DECIMAL_RE = re.compile(r"^\d[\d.,]*\s*(dr|db|cr|cd|debited|credited)?$", re.IGNORECASE)


@dataclass
class RawRow:
    date: date | None
    description: str
    amount: Decimal | None
    transaction_type: str | None = None  # "income" | "expense"
    reference: str | None = None


def _is_summary(text: str) -> bool:
    return bool(_SUMMARY_RE.search(text or ""))


def _norm(text) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip().lower()


def _match_hints(text: str, hints: tuple[str, ...]) -> bool:
    return any(hint in text for hint in hints)


def detect_format(filename: str, head: bytes) -> str:
    """Return a supported format key or raise for unsupported files."""
    ext = Path(filename or "").suffix.lstrip(".").lower()

    if head.startswith(b"%PDF"):
        return "pdf"
    if head[:2] == b"\x50\x4b":  # ZIP container -> xlsx
        return "xlsx"
    if head[:4] == b"\xd0\xcf\x11\xe0":  # OLE2 container -> legacy xls
        return "xls"
    if ext == "csv":
        return "csv"

    sample = head[:4096]
    try:
        text = sample.decode("utf-8", errors="ignore")
    except Exception:
        text = ""
    if text and ("," in text or ";" in text) and ("\n" in text or "\r" in text):
        return "csv"
    if ext in {"pdf", "xlsx", "xls"}:
        return ext

    raise InvalidInputError(
        "Unsupported file format. Please upload a PDF, XLSX, XLS or CSV bank statement."
    )


def _map_columns(cells: list[str]) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for idx, cell in enumerate(cells):
        t = _norm(cell)
        if not t:
            continue
        if "date" not in mapping and _match_hints(t, DATE_HINTS):
            mapping["date"] = idx
        elif "description" not in mapping and _match_hints(t, DESC_HINTS):
            mapping["description"] = idx
        elif "reference" not in mapping and _match_hints(t, REF_HINTS):
            mapping["reference"] = idx
        elif "type" not in mapping and _match_hints(t, TYPE_HINTS):
            mapping["type"] = idx
        elif "debit" not in mapping and _match_hints(t, DEBIT_HINTS):
            mapping["debit"] = idx
        elif "credit" not in mapping and _match_hints(t, CREDIT_HINTS):
            mapping["credit"] = idx
        elif "amount" not in mapping and _match_hints(t, AMOUNT_HINTS):
            mapping["amount"] = idx
        elif "balance" not in mapping and _match_hints(t, BALANCE_HINTS):
            mapping["balance"] = idx
    return mapping


def _looks_like_header(cells: list[str], mapping: dict[str, int]) -> bool:
    return (
        "date" in mapping
        and ("amount" in mapping or "debit" in mapping or "credit" in mapping)
        and ("description" in mapping or "type" in mapping or "reference" in mapping)
    )


def _find_header_row(rows: list[list[str]]) -> tuple[int, dict[str, int]]:
    best_idx = -1
    best = {}
    for idx, row in enumerate(rows[:60]):
        mapping = _map_columns(row)
        if _looks_like_header(row, mapping):
            score = len(mapping)
            if score > len(best):
                best = mapping
                best_idx = idx
    if best_idx < 0:
        raise InvalidInputError(
            "Could not locate the transaction header row in this file. "
            "Please ensure it is a standard bank statement export."
        )
    return best_idx, best


def _cell(value) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.endswith(".0") and text[:-2].isdigit():
        return text[:-2]
    return text


def _detect_type_flag(raw: str) -> str | None:
    t = _norm(raw)
    if re.search(r"\b(dr|db|debit|wd|withdrawal)\b", t):
        return "expense"
    if re.search(r"\b(cr|cd|credit|dep|deposit)\b", t):
        return "income"
    return None


def _row_from_cells(cells: list[str], mapping: dict[str, int]) -> RawRow:
    date_raw = cells[mapping["date"]] if "date" in mapping else ""
    desc_raw = cells[mapping["description"]] if "description" in mapping else " ".join(cells)
    ref_raw = cells[mapping["reference"]] if "reference" in mapping else ""

    parsed_date = parse_date(date_raw)
    description = clean_description(desc_raw)
    reference = normalize_reference(ref_raw)

    txn_type = None
    if "type" in mapping:
        txn_type = _detect_type_flag(cells[mapping["type"]])

    amount: Decimal | None = None
    if "debit" in mapping:
        amount = parse_amount(cells[mapping["debit"]])
        if amount is not None:
            if txn_type is None:
                txn_type = "expense"
            amount = abs(amount)
    if amount is None and "credit" in mapping:
        amount = parse_amount(cells[mapping["credit"]])
        if amount is not None:
            if txn_type is None:
                txn_type = "income"
            amount = abs(amount)
    if amount is None and "amount" in mapping:
        amount = parse_amount(cells[mapping["amount"]])
        if amount is not None and amount < 0:
            amount = abs(amount)
            if txn_type is None:
                txn_type = "expense"
        elif amount is not None and txn_type is None:
            txn_type = "income"

    if amount is not None and txn_type is None:
        txn_type = "expense"

    return RawRow(date=parsed_date, description=description, amount=amount, transaction_type=txn_type, reference=reference)


def _is_data_row(raw: RawRow) -> bool:
    if raw.date is None or raw.amount is None:
        return False
    if not raw.description:
        return False
    if _is_summary(raw.description):
        return False
    return True


def _parse_grid(rows: list[list[str]]) -> list[RawRow]:
    header_idx, mapping = _find_header_row(rows)
    data = []
    for row in rows[header_idx + 1 :]:
        if not row:
            continue
        cells = [_cell(c) for c in row]
        if not any(cells):
            continue
        raw = _row_from_cells(cells, mapping)
        if _is_data_row(raw):
            data.append(raw)
    return data


def parse_tabular_file(path: str, fmt: str) -> list[RawRow]:
    import pandas as pd

    if fmt == "csv":
        df = pd.read_csv(path, header=None, dtype=str, keep_default_na=False, engine="python")
    else:
        df = pd.read_excel(path, header=None, dtype=str)

    grid = [[str(v) if v is not None else "" for v in row] for row in df.values.tolist()]
    return _parse_grid(grid)


def parse_pdf_file(path: str) -> list[RawRow]:
    import pdfplumber

    rows: list[RawRow] = []
    any_text = False
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                any_text = True
            tables = page.extract_tables() or []
            for table in tables:
                grid = [[str(c) if c is not None else "" for c in row] for row in table]
                if any(any(cells) for cells in grid):
                    rows.extend(_parse_grid(grid))
    if not any_text:
        raise InvalidInputError(
            "This PDF appears to be scanned or image-based and could not be read "
            "automatically. Please upload a text-based (exported) PDF, or use a "
            "CSV/XLSX export from your bank."
        )
    return rows


def parse_file(path: str, fmt: str) -> list[RawRow]:
    if fmt == "pdf":
        rows = parse_pdf_file(path)
    elif fmt in {"xlsx", "xls", "csv"}:
        rows = parse_tabular_file(path, fmt)
    else:
        raise InvalidInputError("Unsupported file format.")
    enforce_row_limit(len(rows))
    return rows
