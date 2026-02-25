"""Excel/CSV parser utilities for P&L and forecast file uploads."""

import csv
import io
import logging
import re

import openpyxl

from app.models.financial import PnlRow

logger = logging.getLogger(__name__)

# --- Column name mappings (case-insensitive) ---

_CATEGORY_ALIASES = {"category", "account", "line item", "line_item", "description", "name", "item"}
_SUBCATEGORY_ALIASES = {"subcategory", "sub_category", "sub category", "detail", "sub-category"}
_ACTUAL_ALIASES = {"actual", "actuals", "amount", "actual amount", "actual_amount"}
_FORECAST_ALIASES = {"forecast", "budget", "budgeted", "forecast amount", "forecast_amount", "plan", "planned"}
_PERIOD_ALIASES = {"period", "month", "date", "reporting_period", "reporting period"}


def _normalize(name: str) -> str:
    """Normalize a column header for matching: lowercase, strip, collapse whitespace."""
    return re.sub(r"\s+", " ", name.strip().lower())


def _map_columns(headers: list[str]) -> dict[str, str | None]:
    """Map raw column headers to canonical field names.

    Returns a dict with keys: category, subcategory, actual, forecast, period.
    Values are the original header strings (or None if not found).
    Raises ValueError if 'category' cannot be identified.
    """
    mapping: dict[str, str | None] = {
        "category": None,
        "subcategory": None,
        "actual": None,
        "forecast": None,
        "period": None,
    }

    for header in headers:
        norm = _normalize(header)
        if norm in _CATEGORY_ALIASES:
            mapping["category"] = header
        elif norm in _SUBCATEGORY_ALIASES:
            mapping["subcategory"] = header
        elif norm in _ACTUAL_ALIASES:
            mapping["actual"] = header
        elif norm in _FORECAST_ALIASES:
            mapping["forecast"] = header
        elif norm in _PERIOD_ALIASES:
            mapping["period"] = header

    if mapping["category"] is None:
        raise ValueError(
            f"Cannot identify a category column. Headers found: {headers}. "
            f"Expected one of: {sorted(_CATEGORY_ALIASES)}"
        )

    if mapping["actual"] is None:
        raise ValueError(
            f"Cannot identify an actuals column. Headers found: {headers}. "
            f"Expected one of: {sorted(_ACTUAL_ALIASES)}"
        )

    return mapping


def _parse_float(value) -> float | None:
    """Safely parse a numeric value, returning None for blanks/errors."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", "").replace(" ", "")
    # Handle accounting-style negatives: (1234.56) -> -1234.56
    if text.startswith("(") and text.endswith(")"):
        text = "-" + text[1:-1]
    # Strip currency symbols
    text = re.sub(r"^[A-Z]{0,3}\s*[R$]?\s*", "", text)
    if not text or text == "-":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _is_skip_row(category_value: str | None) -> bool:
    """Check if a row should be skipped (empty, header-like, or total row)."""
    if not category_value:
        return True
    text = category_value.strip().lower()
    if not text:
        return True
    skip_patterns = {"total", "totals", "grand total", "net total", "subtotal", "sub-total", "sub total"}
    if text in skip_patterns:
        return True
    # Skip rows that look like repeated headers
    if text in _CATEGORY_ALIASES:
        return True
    return False


def _read_csv_rows(file_content: bytes) -> tuple[list[str], list[dict[str, str]]]:
    """Read CSV content and return (headers, list_of_row_dicts)."""
    # Try UTF-8 first, fallback to latin-1
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            text = file_content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("Unable to decode CSV file — unsupported encoding")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise ValueError("CSV file appears to be empty or has no header row")
    headers = list(reader.fieldnames)
    rows = list(reader)
    return headers, rows


def _read_excel_rows(file_content: bytes) -> tuple[list[str], list[dict[str, object]]]:
    """Read first sheet of an Excel workbook and return (headers, list_of_row_dicts)."""
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_content), read_only=True, data_only=True)
    except Exception as exc:
        raise ValueError(f"Failed to read Excel file: {exc}") from exc

    ws = wb.active
    if ws is None:
        wb.close()
        raise ValueError("Excel workbook has no active sheet")

    rows_iter = ws.iter_rows(values_only=True)

    # Find the header row (first row with at least 2 non-empty cells)
    headers: list[str] = []
    for row in rows_iter:
        non_empty = [str(c).strip() for c in row if c is not None and str(c).strip()]
        if len(non_empty) >= 2:
            headers = [str(c).strip() if c is not None else "" for c in row]
            break

    if not headers:
        wb.close()
        raise ValueError("Excel file has no recognizable header row")

    data_rows: list[dict[str, object]] = []
    for row in rows_iter:
        row_dict: dict[str, object] = {}
        for i, cell_value in enumerate(row):
            if i < len(headers) and headers[i]:
                row_dict[headers[i]] = cell_value
        if any(v is not None and str(v).strip() for v in row_dict.values()):
            data_rows.append(row_dict)

    wb.close()
    return headers, data_rows


# --- Public API ---


def parse_pnl_file(file_content: bytes, filename: str, default_period: str = "") -> list[PnlRow]:
    """Parse a CSV or Excel file into a list of PnlRow objects.

    Args:
        file_content: Raw bytes of the uploaded file.
        filename: Original filename (used to detect format).
        default_period: Default period string if not found in the file.

    Returns:
        List of PnlRow objects.

    Raises:
        ValueError: If the file format is unrecognizable or required columns are missing.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "csv":
        headers, raw_rows = _read_csv_rows(file_content)
    elif ext in ("xlsx", "xls"):
        headers, raw_rows = _read_excel_rows(file_content)
    else:
        raise ValueError(f"Unsupported file type: .{ext}. Expected .csv or .xlsx")

    col_map = _map_columns(headers)
    logger.info("Column mapping for %s: %s", filename, col_map)

    pnl_rows: list[PnlRow] = []
    for raw in raw_rows:
        category_val = raw.get(col_map["category"]) if col_map["category"] else None
        category_str = str(category_val).strip() if category_val is not None else ""

        if _is_skip_row(category_str):
            continue

        actual_val = _parse_float(raw.get(col_map["actual"])) if col_map["actual"] else None
        if actual_val is None:
            # Skip rows with no actual value
            continue

        forecast_val = _parse_float(raw.get(col_map["forecast"])) if col_map["forecast"] else None

        subcategory_val = None
        if col_map["subcategory"]:
            sc = raw.get(col_map["subcategory"])
            if sc is not None and str(sc).strip():
                subcategory_val = str(sc).strip()

        period_val = default_period
        if col_map["period"]:
            p = raw.get(col_map["period"])
            if p is not None and str(p).strip():
                period_val = str(p).strip()

        variance = None
        if actual_val is not None and forecast_val is not None:
            variance = round(actual_val - forecast_val, 2)

        pnl_rows.append(
            PnlRow(
                category=category_str,
                subcategory=subcategory_val,
                actual=actual_val,
                forecast=forecast_val,
                variance=variance,
                period=period_val,
            )
        )

    if not pnl_rows:
        raise ValueError("No valid P&L data rows found in the uploaded file")

    logger.info("Parsed %d P&L rows from %s", len(pnl_rows), filename)
    return pnl_rows


def parse_forecast_file(file_content: bytes, filename: str) -> list[dict]:
    """Parse a CSV or Excel file into a list of raw dicts (for flexible forecast formats).

    Args:
        file_content: Raw bytes of the uploaded file.
        filename: Original filename (used to detect format).

    Returns:
        List of dicts with column headers as keys.

    Raises:
        ValueError: If the file format is unrecognizable.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "csv":
        headers, raw_rows = _read_csv_rows(file_content)
    elif ext in ("xlsx", "xls"):
        headers, raw_rows = _read_excel_rows(file_content)
    else:
        raise ValueError(f"Unsupported file type: .{ext}. Expected .csv or .xlsx")

    # Convert all values to JSON-safe types
    result: list[dict] = []
    for raw in raw_rows:
        cleaned: dict[str, object] = {}
        for key, value in raw.items():
            if value is None:
                cleaned[key] = None
            elif isinstance(value, (int, float)):
                cleaned[key] = value
            else:
                cleaned[key] = str(value).strip()
        # Skip entirely empty rows
        if any(v is not None and str(v).strip() for v in cleaned.values()):
            result.append(cleaned)

    if not result:
        raise ValueError("No data rows found in the uploaded file")

    logger.info("Parsed %d forecast rows from %s", len(result), filename)
    return result
