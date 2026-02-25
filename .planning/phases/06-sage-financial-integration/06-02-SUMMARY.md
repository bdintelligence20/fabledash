---
phase: 06-sage-financial-integration
plan: 02
status: complete
completed: 2026-02-25
commits:
  - "feat(06-02): Sage data sync service for invoices, payments, and snapshots"
  - "feat(06-02): wire financial data sync into Sage API endpoints"
files_modified:
  - python-backend/app/utils/sage_sync.py
  - python-backend/app/api/sage.py
---

# 06-02 Summary: Financial Data Sync from Sage API

## What was built

### Sage data sync service (`app/utils/sage_sync.py`)
- **SageSyncService** class that orchestrates all data synchronization:
  - `sync_invoices(since)` — fetches `/sales_invoices` from Sage with optional date filter, maps to `InvoiceResponse`, performs best-effort client name matching against FableDash clients collection, and upserts to Firestore using `sage_id` as the document ID.
  - `sync_payments(since)` — fetches `/contact_payments` from Sage, maps to `PaymentResponse`, links payments to invoices via Sage's `allocated_artefacts`, and upserts to Firestore.
  - `sync_balances()` — fetches `/ledger_accounts` from Sage, categorizes accounts by type (bank/cash, receivables, payables), and returns aggregated balance figures.
  - `create_snapshot(period_start, period_end)` — queries Firestore invoices and payments for the given date range, calculates totals, fetches current balances, and creates a `FinancialSnapshot` document.
  - `full_sync()` — orchestrates a complete sync: invoices, payments, and a current-month snapshot.

- **Client name matching**: Loads all FableDash clients into a lowercase name map and performs case-insensitive exact matching against Sage contact display names.
- **Sage status mapping**: Converts Sage invoice statuses (DRAFT, SENT, PARTIALLY_PAID, PAID, VOID, DELETED) to FableDash statuses (draft, sent, paid, overdue, void), with overdue detection based on due date.
- **Error handling**: All sync methods return `{ synced, errors }` dicts. Individual record failures are caught and logged without aborting the full batch. If Sage is not connected, returns an error dict instead of throwing.

### Updated Sage API endpoints (`app/api/sage.py`)

1. **POST /sage/sync** (replaced placeholder):
   - CEO-only. Query param `full` (bool, default False).
   - `full=True`: runs `full_sync()` (all invoices, all payments, snapshot).
   - `full=False`: incremental sync of the last 7 days (invoices + payments only).
   - Returns 400 if Sage is not connected.

2. **GET /sage/invoices** (new):
   - Any authenticated user.
   - Query params: `status`, `client_id`, `date_from`, `date_to`, `limit` (default 50).
   - Returns invoices from Firestore ordered by `issued_date` descending.

3. **GET /sage/payments** (new):
   - Any authenticated user.
   - Query params: `date_from`, `date_to`, `limit` (default 50).
   - Returns payments from Firestore ordered by `payment_date` descending.

4. **GET /sage/snapshots** (new):
   - Any authenticated user.
   - Query param: `limit` (default 12).
   - Returns financial snapshots from Firestore ordered by `created_at` descending.

## Decisions made

1. **Upsert strategy**: Uses Firestore `set(..., merge=True)` with the Sage ID as the document ID. This makes syncs idempotent — re-running a sync updates existing records rather than creating duplicates.
2. **Incremental sync window**: Default incremental sync uses `updated_or_created_since` with a 7-day lookback, matching Sage's recommended approach for frequent syncs.
3. **Balance categorization**: Ledger accounts are matched by both Sage account type ID (BANK, CASH, ACCOUNTS_RECEIVABLE, etc.) and display name keywords (bank, cash, receivable, payable, trade debtor, trade creditor) for broad compatibility across different Sage chart-of-accounts configurations.
4. **Firestore queries**: Used `FieldFilter` for Firestore queries in the API endpoints instead of the deprecated positional `where()` syntax, ensuring forward compatibility with the Firestore SDK.
5. **Snapshot net profit**: Uses a simplified calculation (revenue from invoices minus payment amounts as expense proxy). Full expense tracking would require purchase invoice sync, which can be added later.

## Deviations from plan

- Added `_map_sage_invoice_status()` helper for mapping Sage's status object (which can be a nested dict with an `id` field) to FableDash's flat status strings.
- The `sync_balances()` method also checks display names in addition to type IDs for balance categorization, providing more robust matching across different Sage configurations.
- Used `google.cloud.firestore_v1.FieldFilter` in the API endpoints for modern Firestore query syntax.

## Verification

All checks pass:
- `from app.utils.sage_sync import SageSyncService` — OK
- `from app.api.sage import router` — OK
- Routes: `/status`, `/connect`, `/callback`, `/disconnect`, `/sync`, `/invoices`, `/payments`, `/snapshots`
