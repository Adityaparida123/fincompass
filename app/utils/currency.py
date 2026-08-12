"""Currency handling. Monetary values are Decimal in INR/₹ by default."""

from decimal import ROUND_HALF_UP, Decimal

CURRENCY_SYMBOLS = {
    "INR": "₹",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "JPY": "¥",
    "AED": "AED ",
    "SGD": "S$",
}

CENTS = Decimal("0.01")


def to_decimal(value) -> Decimal:
    return Decimal(value).quantize(CENTS, rounding=ROUND_HALF_UP)


def money_string(amount: Decimal, currency: str = "INR") -> str:
    symbol = CURRENCY_SYMBOLS.get(currency.upper(), f"{currency.upper()} ")
    return f"{symbol}{amount:,.2f}"


def percent_string(value: Decimal) -> str:
    return f"{value:.2f}%"
