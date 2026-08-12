"""Safety validation for FinAI outputs.

Ensures the assistant never encourages unnecessary borrowing or exposes
sensitive material, regardless of what the LLM produces.
"""

import re

_PHONE_KEYWORDS = ["otp", "one time password", "cvv", "pin", "password", "passcode", "private key", "card number"]

_STRONG_REJECT = [
    "take the loan immediately",
    "you should definitely borrow",
    "loan is always a good idea",
    "sabse achha hai loan lena",
]

_DEFAULT_SAFE_REPLY = (
    "I can't provide that answer as asked. FinAI focuses on understanding your finances "
    "and making safe, informed decisions. Please rephrase, or ask about budgeting, savings, "
    "or cash flow."
)


def validate_response(text: str) -> tuple[bool, str | None]:
    """Returns (is_safe, replacement). When unsafe, returns a safe replacement."""
    lowered = text.lower()
    for keyword in _STRONG_REJECT:
        if keyword in lowered:
            return False, _DEFAULT_SAFE_REPLY
    for keyword in _PHONE_KEYWORDS:
        if f"your {keyword}" in lowered or f"your {keyword} is" in lowered:
            return False, (
                "FinAI never requests passwords, OTPs, PINs, CVVs, or banking credentials. "
                "If a message asked you for these, ignore it. Banks will never ask for them."
            )
    return True, None


def sanitize_financial_claims(text: str) -> str:
    """Strip unsupported precision claims like 'guaranteed 12% return'."""
    lowered = text.lower()
    if re.search(r"guarantee[^.]*\d+\s*%", lowered):
        return (
            "FinAI does not make or endorse guaranteed return claims. Investment returns "
            "are uncertain. Please consult a registered advisor for specifics."
        )
    return text


def requires_borrowing_caution(intent: str) -> bool:
    return intent == "loan"


def borrowing_caution_suffix() -> str:
    return (
        "\n\nImportant: Before borrowing, ensure you have an emergency buffer, that the EMI "
        "fits comfortably within your cash flow, and that you have considered non-credit "
        "alternatives. Borrowing is a responsibility, not a default option."
    )
