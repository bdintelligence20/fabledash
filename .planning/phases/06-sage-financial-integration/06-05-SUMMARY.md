---
phase: 06-sage-financial-integration
plan: 05
status: complete
completed: 2026-02-25
commits:
  - "feat(06-05): financial summary and revenue trend API endpoints"
  - "feat(06-05): Finances page with Sage connection, uploads, and invoice display"
files_modified:
  - python-backend/app/api/financial_data.py
  - python-backend/app/main.py
  - src/pages/FinancesPage.tsx
---

# 06-05 Summary: Financial Data API & Finances Page

## What was built

### Financial data API (`app/api/financial_data.py`)
- **GET /financial-data/summary**: Aggregated financial overview returning:
  - Latest financial snapshot (most recent by period_end, with optional period filter)
  - Invoice statistics: total count, paid, outstanding, overdue, total revenue, total outstanding amount
  - Latest P&L upload summary (with optional period filter)
  - Latest revenue forecast summary
  - Sage connection status (checks `sage_credentials/current` doc existence)
- **GET /financial-data/revenue-trend**: Monthly revenue trend data:
  - Query param: `months` (default 6, max 24)
  - Returns array of `{ period, revenue, expenses, net_profit }` from financial snapshots ordered by period ascending

### Router registration (`app/main.py`)
- Imported `financial_data_router` and registered at `/financial-data` prefix with `financial-data` tag

### Finances page (`src/pages/FinancesPage.tsx`)
Complete rewrite from stub to full-featured page with three sections:

**Section 1: Financial Overview**
- 4 StatCards in a responsive grid: Total Revenue, Total Outstanding, Cash on Hand, Net Profit
- Values fetched from `/financial-data/summary` via apiClient
- ZAR currency formatting via `currency.format()` from tokens
- Graceful "—" display when no data exists
- Loading spinners on each card

**Section 2: Data Sources (tabbed panel)**
- Tab "Sage Connection":
  - Shows green "Connected" badge with last sync date, Sync Now and Disconnect buttons
  - Shows amber "Not Connected" badge with Connect Sage button (opens OAuth URL in new window)
- Tab "P&L Reports":
  - File upload form with CSV/Excel file input and month picker for period
  - POSTs multipart FormData to `/financial/pnl`
  - Table of existing uploads with filename, period, row count, upload date, delete button
  - Success/error feedback after upload
- Tab "Revenue Forecasts":
  - File upload form with CSV/Excel file input
  - POSTs multipart FormData to `/financial/forecast`
  - Table of existing forecasts with filename, forecast date, entry count, upload date, delete button
  - Success/error feedback after upload

**Section 3: Recent Invoices**
- Table fetched from `/sage/invoices?limit=20`
- Columns: invoice number, status (Badge with variant mapping), amount (ZAR), issued date, due date
- Status badge colors: draft=default, sent=primary, paid=success, overdue=danger, void=default
- Empty state: "Connect Sage to see invoices, or upload P&L reports manually"

**Data fetching pattern:**
- On mount: parallel fetch of `/financial-data/summary`, `/sage/status`, `/financial/pnl`, `/financial/forecast`, `/sage/invoices`
- Individual loading states per section (no single global spinner)
- All errors handled gracefully with try/catch, stat cards show "—" on error

## Decisions made

1. **Separate loading states**: Each data source has its own loading boolean, so sections render independently as data arrives rather than waiting for all fetches.
2. **FormData for uploads**: Uses `new FormData()` with `apiClient.post()` which automatically skips `Content-Type: application/json` for FormData bodies (handled by the api client's isFormData check).
3. **Sage connection check in summary**: Uses Firestore document existence check on `sage_credentials/current` combined with `firebase_admin._apps` check, matching the pattern established in `sage.py`.
4. **Invoice stats computation**: Iterates all invoices in Firestore for aggregate stats. For small-to-medium invoice volumes this is acceptable; a dedicated aggregation would be needed at scale.
5. **Revenue trend date calculation**: Walks back N months from the first day of the current month to calculate the start date, avoiding edge cases with varying month lengths.

## Deviations from plan

- The plan mentioned using `Modal` component but no modal was needed for the page functionality — all interactions are inline (uploads, connection management).
- Revenue growth calculation from multiple snapshots was not implemented as a separate field; instead the `/revenue-trend` endpoint provides the raw data series that can be used for trend analysis in future chart components.

## Verification

All checks pass:
- `python3 -c "from app.main import app; ..."` — Routes confirmed: `/financial-data/summary`, `/financial-data/revenue-trend`
- `npx tsc --noEmit` — No TypeScript errors
- `npx vite build` — Build succeeds (1838 modules, built in 1.41s)
