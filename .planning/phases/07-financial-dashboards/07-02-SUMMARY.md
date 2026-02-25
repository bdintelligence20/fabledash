---
phase: 07-financial-dashboards
plan: 02
status: complete
completed: 2026-02-25
commits:
  - "feat(07-02): cost-benefit analysis endpoint"
  - "feat(07-02): cost-benefit dashboard page"
files_modified:
  - python-backend/app/api/financial_data.py
  - src/pages/CostBenefitPage.tsx (new)
  - src/router.tsx
---

# 07-02 Summary: Cost-Benefit Analysis Dashboard

## What was built

### Backend: GET /cost-benefit endpoint (`python-backend/app/api/financial_data.py`)

Added to the existing `financial_data` router. Performs a three-way join across Firestore collections to calculate per-client ZAR/Hr rankings.

**Logic:**
1. Fetches all clients from `clients` collection for name and partner_group resolution
2. Fetches paid invoices (optionally filtered by `date_from`/`date_to` on `issued_date`) and accumulates revenue and invoice count by `client_id`
3. Fetches time logs (optionally filtered by `date_from`/`date_to` on `date`) and accumulates minutes by `client_id`
4. For each client present in either invoices or time logs: calculates `zar_per_hour = revenue / hours`
5. Identifies pass-through projects: `revenue > 0` and `hours < 2`
6. Sorts by `zar_per_hour` descending, with pass-through clients grouped at the end

**Returns:**
- `clients[]`: per-client objects with `client_id`, `client_name`, `partner_group`, `total_revenue`, `total_hours`, `zar_per_hour`, `invoice_count`, `is_pass_through`
- `summary`: `total_revenue`, `total_hours`, `average_zar_per_hour`, `pass_through_count`, `pass_through_revenue`

**Imports added:**
- `defaultdict` from `collections`
- `CLIENT_COLLECTION` from `app.models.client`
- `TIME_LOG_COLLECTION` from `app.models.time_log`

### Frontend: CostBenefitPage (`src/pages/CostBenefitPage.tsx`)

A full cost-benefit analysis dashboard accessible at `/finances/cost-benefit`.

**Period selector (top):**
- Quick presets: This Month, This Quarter, Year to Date, Custom
- Default: This Quarter
- Custom mode shows date inputs with Apply button

**Summary section:**
- 4 StatCards in responsive grid: Total Revenue (ZAR), Total Hours, Avg ZAR/Hr, Pass-Through Revenue
- Pass-Through Revenue card shows a warning badge with the count when pass-through clients exist
- All currency values formatted via `currency.format()` from tokens

**Revenue Distribution bar:**
- Stacked horizontal bar showing each client's share of total revenue
- Color-coded using `chartColors.categorical` from tokens
- Client initials displayed inside segments when >= 8% width
- Legend below with color swatches and client names

**Client Value Rankings table:**
- Columns: Rank, Client, Partner Group (Badge), Revenue, Hours, ZAR/Hr, Invoices, Type
- Top 3 non-pass-through rows: subtle green tint (`bg-success-50/60`)
- Bottom 3 non-pass-through rows: subtle red tint (`bg-danger-50/60`)
- Pass-through clients: "Pass-through" Badge in ZAR/Hr column instead of numeric value
- Partner group badges: collab -> primary, edcp -> default, direct_clients -> success, separate_businesses -> warning
- Footer row with totals
- Type column: "Billable" (success dot badge) or "Pass-through" (warning dot badge)

### Route registration (`src/router.tsx`)
- Imported `CostBenefitPage` and registered at `/finances/cost-benefit`
- Placed after `/finances/revenue` following the sub-route pattern

## Decisions made

1. **Sort order**: Non-pass-through clients sorted by ZAR/Hr descending; pass-through clients are placed at the end of the list since they lack meaningful ZAR/Hr values.
2. **Pass-through threshold**: Revenue > 0 and total hours < 2 flags a client as pass-through. This matches the plan specification.
3. **Row tinting**: Computed via `useMemo` that builds a tint function indexing only into non-pass-through clients, ensuring pass-through rows never receive green/red tints.
4. **Value distribution bar**: Uses `chartColors.categorical` (6-color palette) from design tokens, cycling for more than 6 clients. Client initials displayed for segments >= 8% width.
5. **Firestore date filtering**: Invoices filtered on `issued_date`; time logs filtered on `date`. Both use ISO string comparisons consistent with the existing codebase pattern.

## Deviations from plan

None. All specified sections, endpoints, and patterns were implemented as described.

## Verification

- Backend: `/cost-benefit` route present in `financial_data` router (verified with import test)
- Route registered at `/finances/cost-benefit` in router.tsx
- Uses `currency.format()` from `../styles/tokens` for all ZAR formatting
- UI components imported from `../components/ui` (StatCard, Card, Badge, Button, Input, Spinner, Table)
- API call uses `apiClient.get()` from `../lib/api`
- Relative imports throughout
