"""Smart UPI / SMS text parser for receipt capture.

Best-effort text parsing only — it NEVER claims OCR or statement-grade
accuracy. Results always require the user's review before anything is saved.
Regex rules cover the common patterns in Indian UPI/bank SMS messages; anything
unrecognised is returned unparsed so the user can type the details manually.
"""

from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, InvalidOperation

from app.schemas.advisor import SmartParseOut
from app.services.import_statement.categorize import categorize_row

ZERO = Decimal("0")

_AMOUNT_PATTERNS = [
    re.compile(r"(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE),
    re.compile(r"\b([\d,]+(?:\.\d{1,2})?)\s*(?:rs|rupees)\b", re.IGNORECASE),
    re.compile(
        r"\b(?:received|credited with|credited by|debited by|paid|spent|withdrawn|sent\s+you)\s+"
        r"(?:₹\s*|Rs\.?\s*|INR\s*)?([\d,]+(?:\.\d{1,2})?)",
        re.IGNORECASE,
    ),
]

_ENTRY_PATTERNS = [
    re.compile(r"paid\s+(?:₹\s*|rs\.?\s*)?[\d,]+\.?\d*\s+to\s+(.+?)(?:\s+via|\s+on|\s+at|\s+dt|\s+ref|\s*$)", re.IGNORECASE),
    re.compile(r"(?:₹\s*|rs\.?\s*)?[\d,]+\.?\d*\s+debited(?: from .+?)?\s+to\s+(.+?)(?:\s+on|\s+at|\s+ref|\s*$)", re.IGNORECASE),
    re.compile(r"(?:received|credited|sent you)\s+(?:₹\s*|rs\.?\s*)?[\d,]+\.?\d*\s+from\s+(.+?)(?:\s+via|\s+on|\s+at|\s+ref|\s*$)", re.IGNORECASE),
    re.compile(r"from\s+(.+?)(?:\s+via|\s+on|\s+at|\s+ref|\s*$)", re.IGNORECASE),
    re.compile(r"\bok\s+(?:to\s+)?(.+?)(?:\s+via|\s+on|\s+at|\s+ref|\s*$)", re.IGNORECASE),
]

_DATE_PATTERNS = [
    re.compile(r"\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b"),
    re.compile(r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b"),
    re.compile(r"\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b", re.IGNORECASE),
]

_TRANSACTION_HINTS = {
    "income": ("received", "credited", "sent you", "upi credit", "credited by", "refund", "cashback", "added to"),
    "expense": ("paid", "debited", "spent", "sent to", "payment", "purchased", "purchase", "withdrawn", "debit"),
}

_AMOUNT_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _parse_amount(text: str) -> Decimal | None:
    for pattern in _AMOUNT_PATTERNS:
        match = pattern.search(text)
        if match:
            try:
                cleaned = match.group(1).replace(",", "")
                value = Decimal(cleaned)
                if value > ZERO:
                    return value
            except InvalidOperation:
                continue
    return None


def _parse_merchant(text: str) -> str | None:
    for pattern in _ENTRY_PATTERNS:
        match = pattern.search(text)
        if match:
            merchant = re.sub(r"\s+", " ", match.group(1)).strip(" ,.;:()\"'").strip()
            merchant = re.split(r"\s+upi(?:/| ref| no|#)?\b", merchant, flags=re.IGNORECASE)[0].strip()
            merchant = re.sub(r"\s+ref(?: no)?[.:#]?[\s\w-]*$", "", merchant, flags=re.IGNORECASE).strip()
            if merchant and merchant.lower() not in {"upi", "your account", "account"}:
                return merchant[:80]
    return None


def _parse_date(text: str) -> str | None:
    for pattern, fmt in ((_DATE_PATTERNS[0], "ymd"), (_DATE_PATTERNS[1], "dmy"), (_DATE_PATTERNS[2], "dmonthy")):
        match = pattern.search(text)
        if match:
            try:
                if fmt == "ymd":
                    parsed = date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
                    return parsed.isoformat()
                if fmt == "dmy":
                    day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
                    if year < 100:
                        year += 2000
                    parsed = date(year, month, day)
                    return parsed.isoformat()
                return date(int(match.group(3)), _AMOUNT_MONTHS[match.group(2).lower()], int(match.group(1))).isoformat()
            except ValueError:
                continue
    return None


async def parse_text(text: str) -> SmartParseOut:
    """Parse an UPI/bank-SMS snippet into a reviewable transaction draft."""
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return SmartParseOut(parsed=False, message="No text provided.", needs_review=True)

    amount = _parse_amount(cleaned)
    merchant = _parse_merchant(cleaned)

    transaction_type = None
    # "from X"/"received" suggest inflow unless the text clearly says paid/debited.
    if "received" in cleaned.lower() or "credited" in cleaned.lower() or "sent you" in cleaned.lower():
        transaction_type = "income"
    elif "paid" in cleaned.lower() or "debited" in cleaned.lower() or "spent" in cleaned.lower():
        transaction_type = "expense"
    elif "from" in cleaned.lower() and "to" not in cleaned.lower():
        transaction_type = "income"
    elif "to " in cleaned.lower():
        transaction_type = "expense"

    amount_date = _parse_date(cleaned) or date.today().isoformat()

    if amount is None:
        return SmartParseOut(
            parsed=False,
            message="Could not find a clear amount. Please enter the details manually.",
            needs_review=True,
        )

    description = merchant or cleaned[:80]
    try:
        category_result = await categorize_row(description, amount, transaction_type or "expense")
    except Exception:  # noqa: BLE001 - categorization must never fail receipt capture
        category_result = None

    category = category_result.category if category_result else None
    category_confidence = category_result.confidence_label if category_result else None

    if merchant:
        message = f"Recognised a payment of {amount} to '{merchant}'."
    else:
        message = f"Recognised an amount of {amount}. Please confirm the merchant/label."

    return SmartParseOut(
        parsed=True,
        message=message,
        amount=amount,
        transaction_type=transaction_type or ("expense" if merchant else None),
        description=description,
        amount_date=amount_date,
        category=category,
        category_confidence=category_confidence,
        needs_review=True,
        review_hint="Review the amount, merchant and category before saving.",
    )