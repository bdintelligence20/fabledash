---
phase: 06-sage-financial-integration
plan: 03
status: complete
completed: 2026-02-25
commits:
  - "feat(06-03): P&L upload endpoints with CSV/Excel parsing"
files_modified:
  - python-backend/app/api/financial_uploads.py
  - python-backend/app/utils/excel_parser.py
  - python-backend/app/main.py
  - python-backend/requirements.txt
---

# 06-03 Summary: P&L Upload Endpoints

## What was built

### Excel/CSV parser (`app/utils/excel_parser.py`)
- **parse_pnl_file(file_content, filename, default_period)**: Parses CSV and XLSX files into `PnlRow` objects with flexible column matching:
  - Case-insensitive column detection: "category"/"account"/"line item" mapped to category, "actual"/"actuals"/"amount" mapped to actual, "forecast"/"budget" mapped to forecast
  - Calculates variance (actual - forecast) when both present
  - Skips empty, header-like, and total rows
  - Handles BOM-encoded CSVs, accounting-style negatives `(1234.56)`, and currency symbols
  - Raises `ValueError` for unrecognizable formats or missing required columns
- **parse_forecast_file(file_content, filename)**: Parses files into raw dicts for flexible forecast formats (already existed, now shares common helpers)
- Internal helpers: `_read_csv_rows`, `_read_excel_rows`, `_map_columns`, `_parse_float`, `_is_skip_row`

### P&L upload endpoints (`app/api/financial_uploads.py`)
- **POST /financial/pnl** (CEO only): Upload a P&L spreadsheet. Accepts CSV or XLSX via `UploadFile`, optional `period` query param (defaults to current YYYY-MM). Parses with `parse_pnl_file()`, stores document in Firestore `pnl_uploads` collection. Returns `{ id, row_count, period }`.
- **GET /financial/pnl**: List P&L uploads with optional `period` filter and `limit` (default 12). Returns summaries only (no row data): `{ id, filename, period, row_count, uploaded_at }`.
- **GET /financial/pnl/{upload_id}**: Retrieve full P&L upload including all parsed rows.
- **DELETE /financial/pnl/{upload_id}** (CEO only): Delete a P&L upload from Firestore.

### Dependency updates
- `openpyxl` added to `requirements.txt` for XLSX parsing support

### Router registration
- Financial uploads router mounted at `/financial` prefix in `app/main.py`

## Decisions made

1. **Column matching strategy**: Case-insensitive matching against alias sets rather than strict header names, to accommodate varied spreadsheet formats from different accounting tools.
2. **Variance calculation**: Computed server-side as `actual - forecast` to ensure consistency regardless of what the spreadsheet contains.
3. **Document structure**: P&L rows stored as a nested array within the upload document (matching the `PnlUpload` model), rather than as subcollection documents, for simpler retrieval.
4. **Period defaulting**: If no period param is provided, defaults to `YYYY-MM` of the current date at upload time.
5. **Shared file reading helpers**: Both `parse_pnl_file` and `parse_forecast_file` share `_read_csv_rows` and `_read_excel_rows` to avoid duplication.

## Deviations from plan

- The `excel_parser.py` and `requirements.txt` changes were already committed as part of plan 06-04 (which executed first). This plan's commit only adds the P&L endpoint logic to `financial_uploads.py`.
- The `main.py` router registration was also already in place from the 06-04 commit.

## Verification

All checks pass:
- `from app.api.financial_uploads import router` — OK
- `from app.utils.excel_parser import parse_pnl_file` — OK
- `from app.main import app` — OK
- Financial routes registered: `/financial/pnl` (POST, GET), `/financial/pnl/{upload_id}` (GET, DELETE), `/financial/forecast` (POST, GET), `/financial/forecast/{forecast_id}` (GET, DELETE)
