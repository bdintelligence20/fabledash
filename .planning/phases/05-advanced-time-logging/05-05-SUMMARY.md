---
phase: 05-advanced-time-logging
plan: 05
subsystem: api, ui
tags: [fastapi, firestore, react, typescript, time-tracking, utilization, leaderboard, dashboard]

# Dependency graph
requires:
  - phase: 05-01
    provides: is_billable field on TimeLog model and API filter
  - phase: 05-04
    provides: TimeAllocationPage period preset pattern, allocation endpoint pattern
  - phase: 02-04
    provides: Time log CRUD API endpoints at /time-logs, _doc_to_time_log helper
  - phase: 02-02
    provides: Client CRUD API with partner_group field
  - phase: 03-02
    provides: UI components (Button, Card, Input, StatCard, Table, Badge, Spinner)
  - phase: 01-04
    provides: apiClient with typed request/ApiError pattern
provides:
  - GET /time-logs/utilization endpoint with utilization rate, saturation leaderboards, and daily trend
  - UtilizationPage at /time/utilization with circular gauge, stat cards, bar chart, and leaderboard tables
affects: [06-financial-tracking, 07-dashboard-analytics, 11-operational-reports]

# Tech tracking
tech-stack:
  added: []
  patterns: [backend multi-aggregation endpoint, CSS conic-gradient gauge, pure CSS horizontal bar chart]

key-files:
  modified: [python-backend/app/api/time_logs.py, src/router.tsx]
  created: [src/pages/UtilizationPage.tsx]

key-decisions:
  - "Utilization rate color-coded: green >= 75%, amber 50-74%, red < 50%"
  - "Circular gauge built with CSS conic-gradient — no SVG or chart library needed"
  - "Daily trend bar chart built with pure CSS/Tailwind — two segments per day (billable + non-billable)"
  - "Saturation leaderboards show top 5 with ranked badges (primary/success/warning/default)"
  - "Daily trend limited to last 14 days for readability"

patterns-established:
  - "CSS conic-gradient gauge pattern: color-coded circular progress indicator"
  - "Multi-aggregation endpoint: single API call returns utilization, leaderboards, and daily trend data"

issues-created: []

# Metrics
duration: 3min
completed: 2026-02-25
---

# Plan 05-05: Utilization Rate & Saturation Leaderboards Summary

**Utilization rate dashboard with billable vs total hours gauge, daily trend bar chart, and top 5 client/task saturation leaderboards at /time/utilization**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-25
- **Completed:** 2026-02-25
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added GET /time-logs/utilization endpoint that calculates utilization rate (billable/total), top 5 clients by hours, top 5 tasks by hours, and daily trend with billable/non-billable split
- Built UtilizationPage with period presets, CSS conic-gradient circular gauge, 3 stat cards, horizontal bar chart for daily trends, and two leaderboard tables with ranked badges
- No new npm dependencies added — all visualizations use pure CSS/Tailwind

## Task Commits

Each task was committed atomically:

1. **Task 1: Create utilization rate and saturation leaderboard endpoint** - `9ecf6bb` (feat)
2. **Task 2: Build UtilizationPage with rate display, leaderboards, and route** - `e1cfecc` (feat)

## Files Created/Modified
- `python-backend/app/api/time_logs.py` - Added GET /utilization endpoint with multi-aggregation (utilization metrics, client/task leaderboards, daily trend), placed before /{time_log_id} route
- `src/pages/UtilizationPage.tsx` - New dashboard page with period selector, circular gauge, stat cards, daily trend bar chart, and two leaderboard tables
- `src/router.tsx` - Added /time/utilization route and UtilizationPage import

## Decisions Made
- Utilization rate displayed as a CSS conic-gradient circular gauge with color coding: green (>= 75%), amber (50-74%), red (< 50%)
- Daily trend uses a pure CSS horizontal bar chart with two segments per day (billable in primary color, non-billable in gray), limited to last 14 days
- Saturation leaderboards show top 5 entries with ranked Badge components (1st = primary, 2nd = success, 3rd = warning, rest = default)
- Backend resolves client and task names via cross-collection Firestore joins (same pattern as allocation endpoint)
- Task COLLECTION_NAME imported from app.models.task for task name resolution

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- Utilization dashboard live at /time/utilization, ready for dashboard analytics integration (Phase 7)
- Utilization rate calculation can be reused in financial reporting (Phase 6)
- Period preset and visualization patterns reusable for other dashboard views
- No blockers for next plans

---
*Phase: 05-advanced-time-logging*
*Completed: 2026-02-25*
