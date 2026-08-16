"""Merchant / entity extraction from noisy Indian bank-statement narrations.

Bank descriptions embed a merchant inside transfer plumbing:

    "UPI/DR/450/SWIGGY/ABC123"          -> Swiggy
    "UPI-DR-1200-AMAZON-PAY"            -> Amazon
    "POS/UBER INDIA/..."                -> Uber
    "NEFT SALARY ABC PVT LTD"           -> ABC Pvt Ltd
    "REFUND FROM AMAZON"                -> Amazon

The original narration is always preserved on the transaction; this module only
derives a clean display merchant for review, categorization and analytics.
"""

from __future__ import annotations

import re

# Brand-first lookup: the exact marketable name wins over raw narration text.
# Keys are matched as whole words so "cred" never matches "credit".
_KNOWN_MERCHANTS: list[tuple[tuple[str, ...], str]] = [
    (("amazon prime",), "Amazon Prime"),
    (("cafe coffee day",), "Cafe Coffee Day"),
    (("pizza hut",), "Pizza Hut"),
    (("swiggy",), "Swiggy"),
    (("zomato",), "Zomato"),
    (("amazon",), "Amazon"),
    (("flipkart",), "Flipkart"),
    (("myntra",), "Myntra"),
    (("ajio",), "AJIO"),
    (("uber",), "Uber"),
    (("ola",), "Ola"),
    (("rapido",), "Rapido"),
    (("netflix",), "Netflix"),
    (("spotify",), "Spotify"),
    (("hotstar",), "Disney+ Hotstar"),
    (("sony liv",), "Sony LIV"),
    (("z5",), "Zee5"),
    (("bigbasket",), "BigBasket"),
    (("dmart",), "DMart"),
    (("blinkit",), "Blinkit"),
    (("zepto",), "Zepto"),
    (("instamart",), "Instamart"),
    (("reliance fresh",), "Reliance Fresh"),
    (("dominos",), "Domino's"),
    (("domin",), "Domino's"),
    (("kfc",), "KFC"),
    (("mcdonald",), "McDonald's"),
    (("starbucks",), "Starbucks"),
    (("biryani by kilo",), "Biryani By Kilo"),
    (("irctc",), "IRCTC"),
    (("makemytrip",), "MakeMyTrip"),
    (("cleartrip",), "Cleartrip"),
    (("paytm",), "Paytm"),
    (("phonepe",), "PhonePe"),
    (("google pay",), "Google Pay"),
    (("cred",), "CRED"),
    (("airtel",), "Airtel"),
    (("jio",), "Jio"),
    (("bsnl",), "BSNL"),
    (("tneb",), "TNEB"),
    (("apollo",), "Apollo"),
]

_BRAND_RES: list[tuple[re.Pattern, str]] = [
    (re.compile(rf"\b{re.escape(key)}\b", re.IGNORECASE), name)
    for keys, name in _KNOWN_MERCHANTS
    for key in keys
]

# Tokens that are transfer plumbing / filler rather than a merchant name.
_STRIP_TOKENS = re.compile(
    r"^(upi|dr|cr|db|cd|pos|neft|imps|rtgs|nach|aeps|a2a|p2a|p2p|qpr|tfr|ftr|"
    r"transfer|payment|pay|paid|via|by|to|from|for|salary|wages|credit|debit|"
    r"credited|debited|deposit|withdrawal|cash|redeemed|refund|reversal|"
    r"cashback|charges|fee|int|interest|amount|amt|inr|rs|rcvd|received|"
    r"trf|otr|sct|recr|payer|payee|bank|acct|account|mob|mobile|bharat)\b",
    re.IGNORECASE,
)

# Reference-like noise: UTR/RRN/codes, pure-digit tokens (amounts/references),
# txn ids, alphanumeric codes mixed with digits.
_REF_TOKEN_RE = re.compile(r"^\d+$")
_REF_PREFIX_RE = re.compile(r"^(utr|rrn|ref|txn|id|trn|ord|inv)[-_.]?\d", re.IGNORECASE)
_MIXED_CODE_RE = re.compile(r"^\d+[a-z]+$|^[a-z]+\d+$", re.IGNORECASE)

_BANK_PATTERNS = (
    ("upi", r"upi"),
    ("pos", r"\bpos\b"),
    ("atm", r"\batm\b"),
    ("neft", r"\bneft\b"),
    ("imps", r"\bimps\b"),
    ("rtgs", r"\brtgs\b"),
)


def _is_noise(token: str) -> bool:
    if not token:
        return True
    if _REF_TOKEN_RE.match(token):
        return True
    if _REF_PREFIX_RE.match(token):
        return True
    if _MIXED_CODE_RE.match(token):
        return True
    return bool(_STRIP_TOKENS.match(token))


def _title(token: str) -> str:
    token = token.strip(" .-_/")
    if not token:
        return ""
    if token.isupper() and len(token) <= 4:
        return token
    return token.capitalize()


def _brand_lookup(text: str) -> str | None:
    for pattern, name in _BRAND_RES:
        if pattern.search(text):
            return name
    return None


def _split_candidates(text: str) -> list[str]:
    """Split a narration on common plumbing separators, dropping noise."""
    parts = re.split(r"[/\-|,;]", text)
    tokens: list[str] = []
    for part in parts:
        for word in part.split():
            tokens.append(word)
    return [t for t in tokens if not _is_noise(t)]


def extract_merchant(description: str | None) -> str | None:
    """Return a clean merchant name, or ``None`` when nothing is identifiable."""
    if not description:
        return None
    text = re.sub(r"\s+", " ", str(description)).strip()
    if not text:
        return None
    lowered = text.lower()

    brand = _brand_lookup(text)
    if brand:
        return brand

    if re.search(r"\batm\b", lowered) and re.search(r"(cash|withdraw|withdrawal)", lowered):
        return "ATM"

    # UPI: token after the plumbing prefix/amount is the merchant (or payer on
    # incoming credits).
    if re.search(r"\bupi\b", lowered):
        tokens = _split_candidates(text)
        for token in tokens:
            if _is_noise(token) or token.lower() in {"upi", "pay", "paytm", "phonepe", "gpay"}:
                continue
            return _title(token)
        return None

    # POS: brand scan already handled the well-known names; otherwise the first
    # non-noise segment is the merchant.
    if re.search(r"\bpos\b", lowered):
        tokens = _split_candidates(text)
        return _title(tokens[0]) if tokens else None

    # NEFT/IMPS/RTGS outward or inward: drop plumbing, keep the counterparty.
    for _name, pattern in _BANK_PATTERNS:
        if re.search(pattern, lowered):
            tokens = _split_candidates(text)
            meaningful = [t for t in tokens if t.lower() not in {"neft", "imps", "rtgs", "ach"}]
            if not meaningful:
                return None
            joined = " ".join(_title(t) for t in meaningful)
            return joined or None

    # Generic fallback: strip noise and title-case whatever remains.
    tokens = _split_candidates(text)
    meaningful = [t for t in tokens if not _is_noise(t)]
    if not meaningful:
        return None
    joined = " ".join(_title(t) for t in meaningful[:4])
    if len(joined.strip()) < 3:
        return None
    return joined
