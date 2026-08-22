"""User profile schemas."""

from datetime import date

from pydantic import BaseModel, EmailStr, Field, field_validator

CURRENCIES = {"INR", "USD", "EUR", "GBP", "JPY", "AED", "SGD"}
LANGUAGES = {"en", "hi"}
TIMEZONES = {"Asia/Kolkata", "Asia/Kathmandu", "Asia/Dubai", "UTC"}

BUSINESS_TYPES = {
    "agriculture",
    "dairy",
    "food",
    "retail",
    "handicrafts",
    "tailoring",
    "transportation",
    "repair",
    "manufacturing",
    "services",
    "livestock",
    "fishing",
    "other",
}


class UserProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    preferred_language: str | None = None
    currency: str | None = None
    timezone: str | None = None

    @field_validator("preferred_language")
    @classmethod
    def validate_language(cls, v: str | None) -> str | None:
        if v is not None and v.lower() not in LANGUAGES:
            raise ValueError(f"Unsupported language. Supported: {', '.join(sorted(LANGUAGES))}")
        return v.lower() if v else v

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str | None) -> str | None:
        if v is not None and v.upper() not in CURRENCIES:
            raise ValueError(f"Unsupported currency. Supported: {', '.join(sorted(CURRENCIES))}")
        return v.upper() if v else v


class BusinessProfileOut(BaseModel):
    """Lightweight business profile used to personalize advice.

    Every field is optional — the profile progressively improves
    recommendations but is never required.
    """

    business_name: str | None = Field(default=None, max_length=200)
    business_type: str | None = None
    main_products: str | None = Field(default=None, max_length=500)
    village: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    started_on: date | None = None
    avg_monthly_sales: float | None = Field(default=None, ge=0)
    avg_monthly_expenses: float | None = Field(default=None, ge=0)
    workers_count: int | None = Field(default=None, ge=0, le=10000)
    typical_customers: str | None = Field(default=None, max_length=300)
    seasonal: bool = False
    season_note: str | None = Field(default=None, max_length=200)


class BusinessProfileUpdate(BusinessProfileOut):
    pass

    @field_validator("business_type")
    @classmethod
    def validate_business_type(cls, v: str | None) -> str | None:
        if v is not None and v.lower() not in BUSINESS_TYPES:
            raise ValueError(f"Unsupported business type. Supported: {', '.join(sorted(BUSINESS_TYPES))}")
        return v.lower() if v else v
