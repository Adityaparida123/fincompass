"""Emergency fund calculations."""

from decimal import Decimal

from app.schemas.savings import EmergencyBufferInput, EmergencyBufferResult

RECOMMENDED_MONTHS = 6


def calculate_emergency_buffer(input_data: EmergencyBufferInput) -> EmergencyBufferResult:
    months = input_data.savings / input_data.essential_monthly_expenses
    months = months.quantize(Decimal("0.01"))
    return EmergencyBufferResult(
        savings=input_data.savings,
        essential_monthly_expenses=input_data.essential_monthly_expenses,
        months_covered=months,
        recommended_months=RECOMMENDED_MONTHS,
        is_adequate=months >= RECOMMENDED_MONTHS,
    )
