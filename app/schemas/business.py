"""Business Hub schemas for rural microentrepreneurs."""

from datetime import date as date_type
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


# ============================================================
# BUSINESS PROFILE
# ============================================================

class BusinessProfileCreate(BaseModel):
    business_name: str = Field(min_length=1, max_length=150)
    business_type: str = Field(min_length=1, max_length=100)
    location: str | None = Field(default=None, max_length=200)
    opening_cash: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        max_digits=16,
        decimal_places=2,
    )


class BusinessProfileRead(BusinessProfileCreate):
    id: int
    user_id: int

    model_config = {"from_attributes": True}


# ============================================================
# SALE ITEMS
# ============================================================

class SaleItem(BaseModel):
    name: str | None = Field(default=None, max_length=150)

    quantity: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=3,
    )

    unit: str | None = Field(default=None, max_length=30)

    unit_price: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=16,
        decimal_places=2,
    )

    amount: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=16,
        decimal_places=2,
    )

    @model_validator(mode="after")
    def validate_item(self):
        if self.amount is None:
            if self.quantity is None or self.unit_price is None:
                raise ValueError(
                    "Enter an item amount, or enter both quantity and unit price."
                )

        return self


# ============================================================
# SALES
# ============================================================

class SaleCreate(BaseModel):
    customer_id: int | None = None

    customer_name: str | None = Field(
        default=None,
        max_length=150,
    )

    # Quick sale:
    # {"amount": 500}
    amount: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=16,
        decimal_places=2,
    )

    # Detailed sale:
    # multiple items can be added.
    items: list[SaleItem] = Field(
        default_factory=list,
    )

    paid_amount: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=16,
        decimal_places=2,
    )

    payment_method: str | None = Field(
        default=None,
        max_length=30,
    )

    date: date_type | None = None

    notes: str | None = Field(
        default=None,
        max_length=500,
    )

    @model_validator(mode="after")
    def validate_sale(self):
        if not self.items and self.amount is None:
            raise ValueError(
                "Enter a sale amount or add at least one item."
            )

        return self


class SaleItemRead(SaleItem):
    total: Decimal


class SaleRead(BaseModel):
    id: int
    user_id: int

    customer_id: int | None = None
    customer_name: str | None = None

    items: list[SaleItemRead]

    total_amount: Decimal

    paid_amount: Decimal
    due_amount: Decimal

    payment_method: str | None = None

    date: date_type

    notes: str | None = None

    model_config = {"from_attributes": True}


# ============================================================
# CUSTOMERS
# ============================================================

class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)

    phone: str | None = Field(
        default=None,
        max_length=20,
    )

    address: str | None = Field(
        default=None,
        max_length=250,
    )


class CustomerRead(CustomerCreate):
    id: int
    user_id: int

    total_purchased: Decimal = Decimal("0")
    total_paid: Decimal = Decimal("0")
    total_due: Decimal = Decimal("0")

    model_config = {"from_attributes": True}


# ============================================================
# PURCHASE ITEMS
# ============================================================

class PurchaseItem(BaseModel):
    name: str | None = Field(default=None, max_length=150)

    quantity: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=3,
    )

    unit: str | None = Field(
        default=None,
        max_length=30,
    )

    unit_price: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=16,
        decimal_places=2,
    )

    amount: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=16,
        decimal_places=2,
    )

    @model_validator(mode="after")
    def validate_item(self):
        if self.amount is None:
            if self.quantity is None or self.unit_price is None:
                raise ValueError(
                    "Enter an item amount, or enter both quantity and unit price."
                )

        return self


class PurchaseCreate(BaseModel):
    amount: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=16,
        decimal_places=2,
    )

    items: list[PurchaseItem] = Field(
        default_factory=list,
        max_length=100,
    )

    supplier_name: str | None = Field(
        default=None,
        max_length=150,
    )

    date: date_type | None = None

    notes: str | None = Field(
        default=None,
        max_length=500,
    )

    @model_validator(mode="after")
    def validate_purchase(self):
        if not self.items and self.amount is None:
            raise ValueError(
                "Enter a purchase amount or add at least one item."
            )

        return self


class PurchaseItemRead(PurchaseItem):
    total: Decimal


class PurchaseRead(BaseModel):
    id: int
    user_id: int

    items: list[PurchaseItemRead]

    total_amount: Decimal

    supplier_name: str | None = None

    date: date_type

    notes: str | None = None

    model_config = {"from_attributes": True}
