---
phase: 06-sage-financial-integration
plan: 01
status: complete
completed: 2026-02-25
commits:
  - "feat(06-01): financial data models and Sage API client"
  - "feat(06-01): Sage connection management endpoints"
files_modified:
  - python-backend/app/config.py
  - python-backend/requirements.txt
  - python-backend/app/models/financial.py
  - python-backend/app/utils/sage_client.py
  - python-backend/app/api/sage.py
  - python-backend/app/main.py
---

# 06-01 Summary: Sage API Connection Setup

## What was built

### Financial data models (`app/models/financial.py`)
- **Collection name constants**: `financial_snapshots`, `sage_credentials`, `invoices`, `payments`, `pnl_uploads`, `revenue_forecasts`
- **SageCredentials**: OAuth2 token storage (access_token, refresh_token, expires_at, scope)
- **InvoiceResponse**: Full invoice document model with Sage ID mapping, status, amounts, dates
- **PaymentResponse**: Payment document model with invoice/client linking
- **FinancialSnapshot**: Aggregated period financial data (revenue, expenses, profit, receivables/payables)
- **PnlRow / PnlUpload**: Profit-and-loss spreadsheet upload with parsed rows
- **RevenueForecast**: Revenue forecast upload with flexible entry structure

### Sage API client (`app/utils/sage_client.py`)
- **SageClient** class with full OAuth2 lifecycle:
  - `exchange_code()` — exchanges authorization code for tokens
  - `refresh_token()` — refreshes expired access tokens
  - `_ensure_valid_token()` — checks expiry and refreshes automatically
  - `get()` / `get_paginated()` — authenticated API requests with auto-retry on 401
  - `build_authorization_url()` — constructs the Sage OAuth2 authorization URL
  - `is_connected()` — checks for stored credentials
- Credentials stored in Firestore under `sage_credentials/current`
- Cached singleton via `get_sage_client()`

### Connection management endpoints (`app/api/sage.py`)
- `GET /sage/status` — connection status (any authenticated user)
- `GET /sage/connect` — initiate OAuth2 flow (CEO only)
- `GET /sage/callback` — OAuth2 redirect handler (no auth, returns HTML success page)
- `POST /sage/disconnect` — remove credentials (CEO only)
- `POST /sage/sync` — placeholder for data sync (CEO only, implemented in 06-02)

### Configuration updates
- Added `SAGE_CLIENT_ID`, `SAGE_CLIENT_SECRET`, `SAGE_API_BASE_URL`, `SAGE_REDIRECT_URI` to Settings
- Updated httpx version constraint from `<0.24.0,>=0.23.0` to `>=0.24.0` for modern async support

## Decisions made

1. **Credential storage**: Sage OAuth2 tokens stored as a single Firestore document (`sage_credentials/current`) rather than per-user, since FableDash connects to one Sage company account.
2. **Token refresh strategy**: Automatic refresh on expiry check before each request, plus retry on 401 as a fallback.
3. **httpx version**: Relaxed the version pin from `<0.24.0` to `>=0.24.0` since the old constraint was too restrictive for the async client features needed by SageClient.
4. **OAuth2 callback**: Returns an HTML page instead of a JSON response since the browser is redirected here directly by Sage.
5. **Pagination**: Handles Sage's `$items` / `$next` pagination pattern for bulk data retrieval.

## Deviations from plan

- Added `build_authorization_url()` as a separate method on SageClient to keep URL construction logic co-located with other Sage API details, rather than inlining it in the endpoint handler.
- Made `is_connected()` an async method (plan specified non-async) since it reads from Firestore.

## Verification

All checks pass:
- `from app.main import app` — OK
- `from app.models.financial import FinancialSnapshot, InvoiceResponse` — OK
- `from app.utils.sage_client import SageClient` — OK
- Sage routes registered: `/sage/status`, `/sage/connect`, `/sage/callback`, `/sage/disconnect`, `/sage/sync`
