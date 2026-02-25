---
phase: 07-financial-dashboards
plan: 03
status: complete
completed: 2026-02-25
commits:
  - "feat(07-03): cash position dashboard page"
files_modified:
  - src/pages/CashPositionPage.tsx (new)
  - src/router.tsx
  - python-backend/app/api/financial_data.py
---

# 07-03 Summary: Cash Position Dashboard

## What was built

### Frontend: CashPositionPage (`src/pages/CashPositionPage.tsx`)

A cash position dashboard accessible at `/finances/cash`, providing real-time cash visibility for the agency CEO.

**Current Cash Display (top):**
- Large text-4xl ZAR amount from the latest financial snapshot's `cash_on_hand` field
- Color-coded: green (`colors.success[600]`) when positive, red (`colors.danger[600]`) when negative
- Subtitle displays "As of [date]" using the snapshot's `period_end` formatted to long date
- Empty state: "No cash position data available. Connect Sage or upload financial reports."

**Accounts Overview (middle):**
- 3 StatCards in a responsive 3-column grid:
  - Cash on Hand (Banknote icon) — from `snapshot.cash_on_hand`
  - Accounts Receivable (ArrowDownLeft icon) — from `snapshot.accounts_receivable`
  - Accounts Payable (ArrowUpRight icon) — from `snapshot.accounts_payable`
- Net Position card below: Cash + AR - AP, color-coded green/red
- All values formatted with `currency.format()` from design tokens
- Dash character shown when data is unavailable

**Cash Trend bar chart (bottom):**
- Fetches `GET /financial-data/revenue-trend?months=6` for historical snapshot data
- Pure CSS horizontal bar chart showing `cash_on_hand` per month
- Green bars for positive months, red bars for negative months
- Month labels (e.g. "Jan '26") on the left, ZAR amounts on the right
- Bar widths proportional to the maximum absolute cash value across all months
- Minimum 2% bar width to keep small values visible
- Single data point handled gracefully with centered display and note
- Legend with green/red color swatches for Positive/Negative Cash

**Outstanding Invoices Alert:**
- Amber left-bordered Card shown when `accounts_receivable > 0`
- Alert icon in warning-colored circle
- Displays total outstanding receivables amount in bold
- Shows overdue invoice count (red, bold) from `/financial-data/summary` invoices data
- Falls back to "All outstanding invoices are within due date" when no overdue invoices

**Data fetching:**
- Parallel `Promise.all` for both `/financial-data/summary` and `/financial-data/revenue-trend?months=6`
- Full-page Spinner during loading
- Silent error handling with empty state fallbacks

### Backend: revenue-trend endpoint update (`python-backend/app/api/financial_data.py`)

Added `cash_on_hand` field to the revenue-trend response. The endpoint already reads from the `financial_snapshots` collection which contains `cash_on_hand`, but the field was not previously projected into the response.

### Route registration (`src/router.tsx`)

- Imported `CashPositionPage` from `./pages/CashPositionPage`
- Registered at `/finances/cash` after `/finances/cost-benefit`, following the sub-route pattern

## Decisions made

1. **Parallel data fetching**: Both summary and trend endpoints are fetched in `Promise.all` to minimize page load time rather than sequential requests.
2. **Backend field addition**: Extended the `/revenue-trend` response with `cash_on_hand` (defaulting to 0) since the data is already in the Firestore document but was not projected. This is the minimal backend change needed to support the cash trend chart.
3. **Bar proportional scaling**: Uses maximum absolute value across all months so both positive and negative bars scale correctly against each other.
4. **Minimum bar width**: 2% minimum ensures even very small cash values remain visible in the chart.
5. **Net position formula**: Cash + AR - AP follows standard accounting convention for net working capital position.
6. **Empty states**: Each section handles missing data independently with appropriate fallback text or dash characters.

## Deviations from plan

- **Backend change**: The plan listed only frontend files (`src/pages/CashPositionPage.tsx`, `src/router.tsx`), but a minor backend addition was necessary to include `cash_on_hand` in the revenue-trend response. This was a single-line field addition with no structural changes.

## Verification

- `npx tsc --noEmit` passes
- `npx vite build` succeeds
- Route registered at `/finances/cash` in router.tsx
- Uses `currency.format()` from `../styles/tokens` for all ZAR formatting
- UI components imported from `../components/ui` (StatCard, Card, Spinner)
- API calls use `apiClient.get()` from `../lib/api`
- Relative imports throughout
