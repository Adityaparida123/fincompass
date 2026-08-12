"""Deterministic lending calculations: EMI, amortization, affordability.

EMI formula (reducing balance):
    EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
where r is the monthly interest rate. Zero-interest loans divide P by n.
"""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from app.core.exceptions import InvalidInputError
from app.schemas.loan import EMIResult

_CENT = Decimal("0.01")


def monthly_interest_rate(annual_rate: Decimal) -> Decimal:
    return annual_rate / Decimal("1200")


def _pow(value: Decimal, exp: int) -> Decimal:
    return Decimal(value ** exp)


def calculate_emi(principal: Decimal, annual_rate: Decimal, tenure_months: int) -> Decimal:
    """Return the monthly EMI rounded to 2 decimals."""
    if principal <= 0:
        raise InvalidInputError("principal must be greater than zero.")
    if annual_rate < 0:
        raise InvalidInputError("annual_interest_rate must be zero or greater.")
    if tenure_months <= 0:
        raise InvalidInputError("tenure_months must be greater than zero.")

    if annual_rate == 0:
        emi = principal / Decimal(tenure_months)
        return emi.quantize(_CENT, rounding=ROUND_HALF_UP)

    r = monthly_interest_rate(annual_rate)
    factor = _pow(Decimal(1) + r, tenure_months)
    emi = principal * r * factor / (factor - Decimal(1))
    return emi.quantize(_CENT, rounding=ROUND_HALF_UP)


def emi_result(principal: Decimal, annual_rate: Decimal, tenure_months: int) -> EMIResult:
    emi = calculate_emi(principal, annual_rate, tenure_months)
    total_payment = (emi * Decimal(tenure_months)).quantize(_CENT, rounding=ROUND_HALF_UP)
    total_interest = (total_payment - principal).quantize(_CENT, rounding=ROUND_HALF_UP)
    return EMIResult(
        principal=principal,
        annual_interest_rate=annual_rate,
        tenure_months=tenure_months,
        monthly_emi=emi,
        total_interest=total_interest,
        total_payment=total_payment,
        zero_interest=annual_rate == 0,
    )


def parse_emi_request(principal, annual_rate, tenure_months) -> tuple[Decimal, Decimal, int]:
    try:
        principal_dec = Decimal(str(principal))
        rate_dec = Decimal(str(annual_rate))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise InvalidInputError("Invalid numeric values provided.") from exc
    tenure = int(tenure_months)
    return principal_dec, rate_dec, tenure
