"""User profile schemas."""

from pydantic import BaseModel, EmailStr, Field, field_validator

CURRENCIES = {"INR", "USD", "EUR", "GBP", "JPY", "AED", "SGD"}
LANGUAGES = {"en", "hi"}
TIMEZONES = {"Asia/Kolkata", "Asia/Kathmandu", "Asia/Dubai", "UTC"}


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
