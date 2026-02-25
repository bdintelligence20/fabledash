---
phase: 01-foundation-infrastructure
plan: 04
subsystem: infra
tags: [firebase, firebase-client-sdk, react-router-dom, routing, app-shell, vite]

# Dependency graph
requires:
  - phase: 01-01
    provides: Firebase packages installed, Supabase removed, import.meta.env pattern
provides:
  - Firebase client SDK initialized (auth + firestore singletons)
  - Typed environment config module (src/config/env.ts)
  - Auth-aware API client with automatic Bearer token injection
  - React Router with 7 page routes + 404
  - AppLayout shell with sidebar navigation using NavLink
  - Clean page stubs for all dashboard sections
affects: [02-data-models, 03-design-system, 04-auth]

# Tech tracking
tech-stack:
  added: []
  patterns: [Firebase singleton pattern, apiClient with auth token injection, react-router-dom createBrowserRouter, NavLink active-state routing]

key-files:
  created: [src/config/env.ts, src/lib/firebase.ts, src/lib/api.ts, src/router.tsx, src/layouts/AppLayout.tsx, src/pages/DashboardPage.tsx, src/pages/TasksPage.tsx, src/pages/ClientsPage.tsx, src/pages/FinancesPage.tsx, src/pages/AgentsPage.tsx, src/pages/TimePage.tsx, src/pages/ReportsPage.tsx, src/pages/NotFoundPage.tsx]
  modified: [src/App.tsx, src/main.tsx, index.html, vite.config.ts]
  deleted: [src/utils/api.ts, src/components/ (all 31 files)]

key-decisions:
  - "API client uses generic request<T> pattern with ApiError class for typed error handling"
  - "AppLayout is minimal placeholder -- Phase 3 will build the real design system sidebar"
  - "Removed tailwindcss from vite manualChunks (was generating empty chunk -- it is a PostCSS plugin, not a runtime dep)"
  - "Cleaned remaining Supabase env vars from vite.config.ts define block"

patterns-established:
  - "Firebase singletons: import { auth, firestore } from '@/lib/firebase'"
  - "API client: import { apiClient } from '@/lib/api' then apiClient.get<T>('/endpoint')"
  - "Routing: createBrowserRouter with AppLayout as parent layout route"
  - "Page stubs: export default function PageName() with h1 title and description"

issues-created: []

# Metrics
duration: 3min
completed: 2026-02-25
---

# Plan 01-04: React Frontend Reset with Firebase SDK, Routing, and App Shell

**Firebase client SDK with auth-injecting API client, react-router-dom with 7 page routes, and AppLayout sidebar shell**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-25T13:22:40Z
- **Completed:** 2026-02-25T13:25:29Z
- **Tasks:** 2
- **Files modified:** 48

## Accomplishments
- Firebase client SDK initialized with auth and Firestore singletons from typed env config
- API client automatically injects Firebase auth Bearer tokens on every request
- React Router with createBrowserRouter: 7 page routes + 404 catch-all
- AppLayout with sidebar navigation using NavLink for active state styling
- All 7 page stubs (Dashboard, Tasks, Clients, Finances, Agents, Time, Reports) + 404 page
- Deleted all 31 old component files from src/components/ (clean slate for Phase 3 rebuild)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Firebase client SDK and config modules** - `f8d9885` (feat)
2. **Task 2: Create router, app layout, and page stubs** - `a7eef54` (feat)

## Files Created/Modified
- `src/config/env.ts` - Typed environment config reading from import.meta.env
- `src/lib/firebase.ts` - Firebase app, auth, and Firestore initialization
- `src/lib/api.ts` - Auth-aware API client with get/post/put/delete methods
- `src/router.tsx` - React Router with all page routes under AppLayout
- `src/layouts/AppLayout.tsx` - Sidebar navigation shell with NavLink
- `src/pages/DashboardPage.tsx` - CEO Dashboard stub
- `src/pages/TasksPage.tsx` - Task Management stub
- `src/pages/ClientsPage.tsx` - Client Management stub
- `src/pages/FinancesPage.tsx` - Financial Performance stub
- `src/pages/AgentsPage.tsx` - AI Agents stub
- `src/pages/TimePage.tsx` - Time Tracking stub
- `src/pages/ReportsPage.tsx` - Health & Vitality Reports stub
- `src/pages/NotFoundPage.tsx` - 404 page with link back to dashboard
- `src/App.tsx` - Replaced monolithic layout with RouterProvider
- `index.html` - Updated title to "FableDash -- Operations Intelligence"
- `vite.config.ts` - Removed Supabase env vars and empty tailwindcss chunk config
- `src/utils/api.ts` - Deleted (replaced by src/lib/api.ts)
- `src/components/` - Deleted all 31 files (agents, clients, pages, tasks, ui)

## Decisions Made
- API client uses a generic `request<T>` pattern with an `ApiError` class for typed error handling, rather than individual function exports
- AppLayout is intentionally minimal (just sidebar + Outlet) since Phase 3 will build the real design system
- Removed `tailwindcss` from Vite's `manualChunks` config because it was generating an empty chunk (tailwindcss is a PostCSS plugin, not a runtime dependency)
- Cleaned remaining Supabase env var references from vite.config.ts `define` block

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Supabase env vars still in vite.config.ts define block**
- **Found during:** Task 1 (env config creation)
- **Issue:** vite.config.ts still had `process.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the define block from pre-01-01 era
- **Fix:** Removed both Supabase env var definitions, kept only VITE_API_URL
- **Files modified:** vite.config.ts
- **Verification:** Build succeeds, grep confirms no supabase refs in src/
- **Committed in:** f8d9885 (Task 1 commit)

**2. [Rule 3 - Blocking] Empty chunk warning from tailwindcss in manualChunks**
- **Found during:** Task 2 verification (npm run build)
- **Issue:** `manualChunks: { ui: ['tailwindcss'] }` was producing "Generated an empty chunk: ui" warning because tailwindcss is a PostCSS plugin, not a runtime import
- **Fix:** Removed the `ui` entry from manualChunks
- **Files modified:** vite.config.ts
- **Verification:** Clean build with no warnings
- **Committed in:** a7eef54 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking), 0 deferred
**Impact on plan:** Both auto-fixes necessary for clean build output and correctness. No scope creep.

## Issues Encountered
None -- type-check and build passed on first attempt. All planned file operations succeeded cleanly.

## Next Phase Readiness
- Frontend foundation complete with Firebase SDK, routing, and app shell
- All page stubs are ready for feature implementation in later phases
- AppLayout ready for Phase 3 design system upgrade
- API client ready for authenticated backend calls once auth flow is built (Phase 4)

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-02-25*
