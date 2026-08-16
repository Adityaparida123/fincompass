"""Unit tests for statement file parsing (CSV, XLSX, PDF, format detection)."""

import csv
from datetime import date
from decimal import Decimal

import pandas as pd
import pytest

from app.core.exceptions import InvalidInputError
from app.services.import_statement.parsers import (
    detect_format,
    parse_file,
    parse_pdf_file,
    parse_tabular_file,
)


def _write_csv(tmp_path, rows):
    path = tmp_path / "statement.csv"
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerows(rows)
    return str(path)


CSV_ROWS = [
    ["Date", "Narration", "Reference No", "Withdrawal (Dr)", "Deposit (Cr)", "Balance"],
    ["01/08/2026", "Zomato", "UTR123", "350.00", "", "9,650.00"],
    ["02/08/2026", "Salary credit", "", "", "45,000.00", "54,650.00"],
    ["03/08/2026", "BigBasket groceries", "", "1,200.50", "", "53,449.50"],
    ["04/08/2026", "Total", "", "", "", "53,449.50"],
    ["garbage row with no amount", "", "", "", "", ""],
]


def test_detect_format_magic_bytes():
    assert detect_format("stmt.pdf", b"%PDF-1.4\n") == "pdf"
    assert detect_format("stmt.xlsx", b"PK\x03\x04rest") == "xlsx"
    assert detect_format("stmt.xls", b"\xd0\xcf\x11\xe0rest") == "xls"
    assert detect_format("stmt.csv", b"Date,Narration\n") == "csv"
    with pytest.raises(InvalidInputError):
        detect_format("stmt.doc", b"\xff\xd8\xff\xe0junk")


def test_parse_csv_debit_credit(tmp_path):
    path = _write_csv(tmp_path, CSV_ROWS)
    rows = parse_tabular_file(path, "csv")
    assert len(rows) == 3
    first = rows[0]
    assert first.date == date(2026, 8, 1)
    assert first.description == "Zomato"
    assert first.amount == Decimal("350.00")
    assert first.transaction_type == "expense"
    assert first.reference == "UTR123"

    second = rows[1]
    assert second.transaction_type == "income"
    assert second.amount == Decimal("45000.00")

    third = rows[2]
    assert third.description == "BigBasket groceries"
    assert third.transaction_type == "expense"


def test_parse_csv_single_amount_with_sign(tmp_path):
    rows = [
        ["Transaction Date", "Particulars", "Amount"],
        ["01-Aug-2026", "UPI DR Airtel", "-299.00"],
        ["02-Aug-2026", "UPI CR Refund", "150.00"],
    ]
    path = _write_csv(tmp_path, rows)
    parsed = parse_tabular_file(path, "csv")
    assert len(parsed) == 2
    assert parsed[0].transaction_type == "expense"
    assert parsed[0].amount == Decimal("299.00")
    assert parsed[1].transaction_type == "income"
    assert parsed[1].amount == Decimal("150.00")


def test_parse_csv_type_column(tmp_path):
    rows = [
        ["Date", "Narration", "Type", "Amount"],
        ["05/08/2026", "Swiggy", "Dr", "420.00"],
        ["06/08/2026", "Freelance income", "Cr", "8000.00"],
    ]
    path = _write_csv(tmp_path, rows)
    parsed = parse_tabular_file(path, "csv")
    assert parsed[0].transaction_type == "expense"
    assert parsed[1].transaction_type == "income"


def test_parse_csv_no_header(tmp_path):
    path = _write_csv(tmp_path, [["Date", "Name", "Some value"]])
    with pytest.raises(InvalidInputError):
        parse_tabular_file(path, "csv")


def test_parse_xlsx(tmp_path):
    path = tmp_path / "statement.xlsx"
    pd.DataFrame(
        [
            ["Date", "Description", "Debit", "Credit"],
            ["01/08/2026", "Amazon", "1,000.00", ""],
            ["02/08/2026", "Refund", "", "500.00"],
        ]
    ).to_excel(path, index=False, header=False)
    rows = parse_tabular_file(str(path), "xlsx")
    assert len(rows) == 2
    assert rows[0].transaction_type == "expense"
    assert rows[1].transaction_type == "income"


def test_parse_file_csv_dispatch(tmp_path):
    path = _write_csv(tmp_path, CSV_ROWS)
    rows = parse_file(path, "csv")
    assert len(rows) == 3


def test_parse_pdf_tables(monkeypatch):
    class FakePage:
        def __init__(self, tables, text="statement text"):
            self._tables = tables
            self._text = text

        def extract_text(self):
            return self._text

        def extract_tables(self):
            return self._tables

    class FakePDF:
        def __init__(self, pages):
            self.pages = pages

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    tables = [
        [
            ["Date", "Narration", "Debit", "Credit"],
            ["01/08/2026", "Grocery", "1,500.00", ""],
            ["02/08/2026", "Cashback", "", "75.00"],
        ]
    ]
    fake = FakePDF([FakePage(tables)])
    monkeypatch.setattr("pdfplumber.open", lambda path: fake)
    rows = parse_pdf_file("ignored.pdf")
    assert len(rows) == 2
    assert rows[0].transaction_type == "expense"
    assert rows[1].transaction_type == "income"


def test_parse_pdf_scanned_raises(monkeypatch):
    class FakePage:
        def extract_text(self):
            return "   "

        def extract_tables(self):
            return []

    class FakePDF:
        def __init__(self):
            self.pages = [FakePage()]

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr("pdfplumber.open", lambda path: FakePDF())
    with pytest.raises(InvalidInputError, match="scanned"):
        parse_pdf_file("scanned.pdf")


def test_parse_empty_csv(tmp_path):
    path = _write_csv(tmp_path, [["Date", "Narration", "Amount"]])
    assert parse_tabular_file(path, "csv") == []
