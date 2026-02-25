---
phase: 06-sage-financial-integration
plan: 04
status: complete
completed: 2026-02-25
commits:
  - "feat(06-04): revenue forecast upload endpoint with CSV/Excel parsing"
files_modified:
  - python-backend/app/utils/excel_parser.py
  - python-backend/app/api/financial_uploads.py
  - python-backend/app/main.py
  - python-backend/requirements.txt
---

# 06-04 Summary: Revenue Forecast Upload Endpoint

## What was built

### Excel/CSV parser utility (`app/utils/excel_parser.py`)
- **parse_forecast_file(file_content, filename)**: Detects format by file extension (.csv, .xlsx, .xls) and dispatches to the appropriate internal parser.
- **_parse_csv()**: Decodes bytes with BOM-safe UTF-8 (fallback Latin-1), uses `csv.DictReader` to preserve original column headers, strips whitespace, skips empty rows.
- **_parse_excel()**: Uses `openpyxl` in read-only/data-only mode, reads headers from the first row, converts all cell values to strings, skips empty rows.
- All parsers raise `ValueError` with user-friendly messages on unsupported formats or empty files.

### Revenue forecast endpoints (`app/api/financial_uploads.py`)
- **POST /financial/forecast** (CEO only): Accepts `UploadFile` and optional `forecast_date` (defaults to today). Parses the file via `parse_forecast_file()`, creates a `RevenueForecast` document with a UUID-hex ID, stores it in Firestore `revenue_forecasts` collection. Returns `{ id, entry_count, forecast_date }`.
- **GET /financial/forecast**: Lists forecasts ordered by `uploaded_at` descending with configurable `limit` (default 12). Returns summary objects: `{ id, filename, forecast_date, entry_count, uploaded_at }`.
- **GET /financial/forecast/{forecast_id}**: Returns the full forecast document including all entries.
- **DELETE /financial/forecast/{forecast_id}** (CEO only): Deletes a forecast after verifying it exists.

### Router registration (`app/main.py`)
- Imported `financial_uploads_router` and registered it under the `/financial` prefix with the `financial` tag.

## Decisions made

1. **Flexible column parsing**: The parser preserves original column headers exactly as they appear in the uploaded file rather than enforcing a rigid schema. This allows the CEO to upload forecasts from any source without needing to reformat columns.
2. **String conversion for Excel values**: All Excel cell values are converted to strings for consistent storage in the `entries` list[dict]. Numeric formatting can be applied at the frontend or reporting layer.
3. **Router prefix**: Used `/financial` as the prefix (shared with future P&L upload endpoints from 06-03) to group all financial upload endpoints under one namespace.
4. **UUID-hex IDs**: Forecast document IDs use `uuid4().hex` (32-char hex string) for URL-safe, collision-free identifiers.

## Deviations from plan

- None. All four endpoints implemented as specified.

## Verification

All checks pass:
- `from app.api.financial_uploads import router` -- OK
- Routes: `/forecast` (POST), `/forecast` (GET), `/forecast/{forecast_id}` (GET), `/forecast/{forecast_id}` (DELETE)
- Full app routes confirmed: `POST /financial/forecast`, `GET /financial/forecast`, `GET /financial/forecast/{forecast_id}`, `DELETE /financial/forecast/{forecast_id}`
