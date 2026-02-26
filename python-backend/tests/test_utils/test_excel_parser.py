"""Tests for Excel/CSV parser utility."""

import pytest

from app.utils.excel_parser import parse_pnl_file, parse_forecast_file


class TestParsePnlFile:
    def test_parse_csv_valid(self):
        csv_content = (
            "Category,Actual,Forecast,Period\n"
            "Revenue,100000,90000,2026-01\n"
            "Salaries,60000,55000,2026-01\n"
        ).encode("utf-8")

        rows = parse_pnl_file(csv_content, "pnl.csv", default_period="2026-01")
        assert len(rows) == 2
        assert rows[0].category == "Revenue"
        assert rows[0].actual == 100000.0
        assert rows[0].forecast == 90000.0
        assert rows[0].variance == 10000.0
        assert rows[0].period == "2026-01"

    def test_parse_csv_no_forecast_column(self):
        csv_content = (
            "Category,Amount\n"
            "Revenue,100000\n"
            "Expenses,60000\n"
        ).encode("utf-8")

        rows = parse_pnl_file(csv_content, "pnl.csv", default_period="2026-01")
        assert len(rows) == 2
        assert rows[0].forecast is None
        assert rows[0].variance is None

    def test_parse_csv_with_subcategory(self):
        csv_content = (
            "Category,Sub Category,Actual,Period\n"
            "Revenue,Consulting,100000,2026-01\n"
        ).encode("utf-8")

        rows = parse_pnl_file(csv_content, "pnl.csv")
        assert len(rows) == 1
        assert rows[0].subcategory == "Consulting"

    def test_parse_csv_skips_total_rows(self):
        csv_content = (
            "Category,Actual,Period\n"
            "Revenue,100000,2026-01\n"
            "Total,160000,2026-01\n"
            "Grand Total,160000,2026-01\n"
        ).encode("utf-8")

        rows = parse_pnl_file(csv_content, "pnl.csv")
        assert len(rows) == 1

    def test_parse_csv_skips_empty_category(self):
        csv_content = (
            "Category,Actual\n"
            ",50000\n"
            "Revenue,100000\n"
        ).encode("utf-8")

        rows = parse_pnl_file(csv_content, "pnl.csv")
        assert len(rows) == 1

    def test_parse_csv_empty_file_raises(self):
        csv_content = b""
        with pytest.raises(ValueError):
            parse_pnl_file(csv_content, "pnl.csv")

    def test_parse_csv_no_data_rows_raises(self):
        csv_content = (
            "Category,Actual\n"
            "Total,100000\n"
        ).encode("utf-8")
        with pytest.raises(ValueError, match="No valid P&L data rows"):
            parse_pnl_file(csv_content, "pnl.csv")

    def test_parse_csv_missing_category_column_raises(self):
        csv_content = (
            "Amount,Period\n"
            "100000,2026-01\n"
        ).encode("utf-8")
        with pytest.raises(ValueError, match="Cannot identify a category column"):
            parse_pnl_file(csv_content, "pnl.csv")

    def test_parse_csv_missing_actual_column_raises(self):
        csv_content = (
            "Category,Period\n"
            "Revenue,2026-01\n"
        ).encode("utf-8")
        with pytest.raises(ValueError, match="Cannot identify an actuals column"):
            parse_pnl_file(csv_content, "pnl.csv")

    def test_unsupported_file_type_raises(self):
        with pytest.raises(ValueError, match="Unsupported file type"):
            parse_pnl_file(b"data", "pnl.json")

    def test_parse_csv_accounting_negatives(self):
        csv_content = (
            "Category,Actual\n"
            "Loss,(5000)\n"
        ).encode("utf-8")
        rows = parse_pnl_file(csv_content, "pnl.csv")
        assert rows[0].actual == -5000.0

    def test_parse_csv_with_bom(self):
        # utf-8-sig encoding adds BOM automatically; do not include \ufeff in the string
        csv_content = (
            "Category,Actual\n"
            "Revenue,100000\n"
        ).encode("utf-8-sig")
        rows = parse_pnl_file(csv_content, "pnl.csv")
        assert len(rows) == 1

    def test_parse_csv_alternate_column_names(self):
        csv_content = (
            "Account,Actuals,Budget,Month\n"
            "Revenue,100000,90000,2026-01\n"
        ).encode("utf-8")
        rows = parse_pnl_file(csv_content, "pnl.csv")
        assert len(rows) == 1
        assert rows[0].actual == 100000.0
        assert rows[0].forecast == 90000.0

    def test_parse_csv_default_period_used(self):
        csv_content = (
            "Category,Actual\n"
            "Revenue,100000\n"
        ).encode("utf-8")
        rows = parse_pnl_file(csv_content, "pnl.csv", default_period="2026-02")
        assert rows[0].period == "2026-02"

    def test_parse_csv_currency_symbols_stripped(self):
        csv_content = (
            "Category,Actual\n"
            "Revenue,R 100 000\n"
        ).encode("utf-8")
        rows = parse_pnl_file(csv_content, "pnl.csv")
        assert rows[0].actual == 100000.0


class TestParseForecastFile:
    def test_parse_csv_forecast_valid(self):
        csv_content = (
            "Client,Month,Amount\n"
            "Acme,2026-01,50000\n"
            "Beta,2026-02,30000\n"
        ).encode("utf-8")
        entries = parse_forecast_file(csv_content, "forecast.csv")
        assert len(entries) == 2
        assert entries[0]["Client"] == "Acme"

    def test_parse_forecast_empty_file_raises(self):
        with pytest.raises(ValueError):
            parse_forecast_file(b"", "forecast.csv")

    def test_parse_forecast_unsupported_type_raises(self):
        with pytest.raises(ValueError, match="Unsupported file type"):
            parse_forecast_file(b"data", "forecast.txt")

    def test_parse_forecast_empty_data_raises(self):
        csv_content = (
            "Client,Month,Amount\n"
        ).encode("utf-8")
        with pytest.raises(ValueError, match="No data rows"):
            parse_forecast_file(csv_content, "forecast.csv")
