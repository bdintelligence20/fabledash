---
phase: 07-financial-dashboards
plan: 01
status: complete
completed: 2026-02-25
commits:
  - "feat(07-01): revenue tracking dashboard page"
files_modified:
  - src/pages/RevenueTrackingPage.tsx (new)
  - src/router.tsx
---

# 07-01 Summary: Revenue Tracking Dashboard Page

## What was built

### RevenueTrackingPage (`src/pages/RevenueTrackingPage.tsx`)

A dedicated revenue tracking dashboard accessible at `/finances/revenue`, fetching 12 months of trend data from the existing `GET /financial-data/revenue-trend?months=12` endpoint.

**Section 1: Revenue Growth Rate (top)**
- Large QoQ growth percentage displayed prominently at center
- Green (`success-600`) for positive growth, red (`danger-600`) for negative
- TrendingUp / TrendingDown icon from lucide-react alongside the percentage
- "Quarter over Quarter" subtitle with specific quarter labels (e.g., "2026-Q1 vs 2025-Q4")
- Falls back to "Insufficient data to calculate growth rate" when fewer than two quarters exist

**Section 2: Revenue Trend (middle)**
- Pure CSS horizontal bar chart — no external chart library
- One bar per month with two segments: revenue (primary-500 blue) and expenses (danger-300 red tint)
- Month label left-aligned (e.g., "Jan '26"), ZAR amount right-aligned with tabular-nums for alignment
- Bar widths proportional to the highest month total (revenue + expenses)
- Smooth `transition-all duration-300` animation on bar widths
- Legend below showing color key for Revenue and Expenses

**Section 3: Period Comparison (bottom)**
- Two-column responsive grid (stacks on mobile): Current Quarter vs Previous Quarter
- Each column is a Card containing three StatCards: Revenue, Expenses, Net Profit
- Current quarter card has "Current" primary badge; previous quarter has "Previous" default badge
- Delta badges on current quarter StatCards showing percentage change from previous quarter
- Quarter grouping: Jan-Mar = Q1, Apr-Jun = Q2, Jul-Sep = Q3, Oct-Dec = Q4
- QoQ growth calculated as `((current - previous) / previous) * 100`
- Expenses delta direction is inverted (lower expenses = up/green)
- Falls back to "At least two quarters of data are needed" when insufficient data

### Route registration (`src/router.tsx`)
- Imported `RevenueTrackingPage` and registered at `/finances/revenue`
- Placed immediately after the `/finances` route, following the sub-route pattern used by `/time/*`

## Decisions made

1. **Pure CSS bar chart**: Used CSS `width` percentages within flex containers rather than a charting library, keeping the bundle lean and matching the plan requirement. Each bar's width is proportional to `(total / maxMonthValue) * 100%`.
2. **Quarter calculation from trend data**: Quarters are derived client-side from the `period` (YYYY-MM) field using `Math.ceil(month / 3)`, avoiding a dedicated API endpoint for quarterly aggregation.
3. **Expenses delta direction**: For the expenses StatCard, `direction: 'up'` is assigned when current expenses are lower than previous (i.e., reducing expenses is positive). This provides correct green/red semantics.
4. **Loading state**: A single full-page spinner is shown while the revenue trend API call is in-flight, since all three sections depend on the same data source.
5. **Relative imports only**: All imports use relative paths (`../components/ui`, `../lib/api`, `../styles/tokens`) as required.

## Deviations from plan

None. All specified sections, data sources, and patterns were implemented as described.

## Verification

- Route registered at `/finances/revenue` in router.tsx after `/finances`
- Uses `currency.format()` from `../styles/tokens` for all ZAR formatting
- UI components imported from `../components/ui` (StatCard, Card, Badge, Spinner)
- API call uses `apiClient.get()` from `../lib/api`
- No external chart dependencies — pure CSS horizontal bars
