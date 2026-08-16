"""Reusable Indian bank-statement fixtures for import tests.

Covers realistic narrations: salary, UPI (Swiggy/Zomato/Amazon/Uber),
ATM withdrawals, rent, utilities (electricity/internet), groceries,
subscriptions, EMI, bank charges, refunds, transfers and investments.

Deliberately includes:
- a same-day same-amount different-merchant pair (possible duplicate)
- two Netflix debits a month apart (recurring)
All dates are in the past so validation never flags ``date_in_future``.
"""

from __future__ import annotations

INDIAN_STATEMENT_ROWS = [
    ["Date", "Narration", "Withdrawal (Dr)", "Deposit (Cr)", "Balance"],
    ["01/08/2026", "UPI/DR/450/SWIGGY/XYZ123", "450.00", "", "54,550.00"],
    ["02/08/2026", "UPI/DR/320/ZOMATO/ABC", "320.00", "", "54,230.00"],
    ["02/08/2026", "UPI/DR/320/UBER/RIDE", "320.00", "", "53,910.00"],
    ["02/08/2026", "ATM CASH WITHDRAWAL SBI 0011", "2,000.00", "", "51,910.00"],
    ["03/08/2026", "NEFT RENT PAYMENT TO RAVI", "18,000.00", "", "33,910.00"],
    ["04/08/2026", "ELECTRICITY BILL TNEB", "1,240.00", "", "32,670.00"],
    ["05/08/2026", "INTERNET BROADBAND JIO", "899.00", "", "31,771.00"],
    ["06/08/2026", "UPI/DR/1500/BIGBASKET/MM", "1,500.00", "", "30,271.00"],
    ["07/08/2026", "UPI/DR/2100/AMAZON/PAY", "2,100.00", "", "28,171.00"],
    ["08/08/2026", "UPI/DR/180/UBER/RIDE", "180.00", "", "27,991.00"],
    ["09/08/2026", "NETFLIX SUBSCRIPTION", "649.00", "", "27,342.00"],
    ["10/08/2026", "EMI HDFC LOAN 2088", "12,500.00", "", "14,842.00"],
    ["11/08/2026", "BANK CHARGES OCT", "60.00", "", "14,782.00"],
    ["12/08/2026", "REFUND FROM AMAZON", "", "210.00", "14,992.00"],
    ["13/08/2026", "TRANSFER TO OWN ACCOUNT", "5,000.00", "", "9,992.00"],
    ["14/08/2026", "UPI/SIP/MUTUAL FUND/HDFC", "2,000.00", "", "7,992.00"],
    ["15/08/2026", "CASH DEPOSIT", "", "3,000.00", "10,992.00"],
    ["09/07/2026", "NETFLIX SUBSCRIPTION", "649.00", "", "55,000.00"],
    ["01/08/2026", "SALARY CREDIT ABC PVT LTD", "", "45,000.00", "55,000.00"],
]

INDIAN_STATEMENT_CSV = "\n".join(
    ",".join(cell for cell in row) for row in INDIAN_STATEMENT_ROWS
)

INDIAN_STATEMENT_CSV_SEMICOLON = "\n".join(
    ";".join(cell for cell in row) for row in INDIAN_STATEMENT_ROWS
)
