# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** The CEO can ask "How's the business doing?" at any moment and get a real, data-backed answer — while AI agents autonomously handle repeatable client work.
**Current focus:** Phase 1 complete. Phase 2 and Phase 3 in progress (parallel execution).

## Current Position

Phase: 3 of 12 (Frontend Architecture) -- IN PROGRESS
Plan: 03-01 complete (design system tokens)
Status: Phase 2 and Phase 3 running in parallel. 03-01 done, next: 03-02.
Last activity: 2026-02-25 — Plan 03-01 executed (design system tokens: colors, typography, shadows, animations, TS exports)

Progress: [=======]░░░ ~12%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 3.5 min
- Total execution time: ~0.35 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 5/5 | 18 min | 3.6 min |
| 03-frontend | 1/4 | 3 min | 3.0 min |

**Recent Trend:**
- Last 5 plans: 01-02 (3 min), 01-04 (3 min), 01-03 (2 min), 01-05 (2 min), 03-01 (3 min)
- Trend: consistently fast

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **01-01:** Gutted document_processor.py entirely (too coupled to Supabase) -- will rebuild with Firebase in Phase 2
- **01-01:** Frontend env config uses Vite native import.meta.env (removed runtime window.ENV pattern)
- **01-01:** API router stubs return `{status: "pending rebuild"}` during migration period
- **01-02:** Firebase initialization is graceful -- app continues without credentials (logs warning)
- **01-02:** ErrorResponse uses `error` + `detail` fields (not just `message`) for structured errors
- **01-02:** ProxyHeadersMiddleware with trusted_hosts=["*"] for GCP Cloud Run
- **01-02:** All env vars via pydantic BaseSettings with lru_cache singleton pattern
- **01-03:** Auth is opt-in via Depends() on individual routes, not global middleware
- **01-03:** Two-tier RBAC: CEO + team_member roles matching business structure
- **01-03:** set-role merges new role into existing custom claims (preserves other claims)
- **01-04:** API client uses generic request<T> pattern with ApiError class for typed errors
- **01-04:** AppLayout is minimal placeholder -- Phase 3 builds the real design system sidebar
- **01-04:** Removed tailwindcss from vite manualChunks (PostCSS plugin, not runtime dep)
- **01-05:** AuthContext uses null default with useAuth throwing if outside provider
- **01-05:** Firebase error codes mapped centrally in AuthContext (not in UI layer)
- **01-05:** ProtectedRoute is a layout route wrapping AppLayout (not a per-route wrapper)
- **01-05:** No registration flow -- team members created via Firebase Console or /auth/set-role API
- **03-01:** Surface palette uses warm stone tones (not cold grays) for human-centric feel
- **03-01:** tokens.ts mirrors tailwind.config.js exactly -- Tailwind config is single source of truth
- **03-01:** chartColors has categorical (6-color), sequential, and diverging palettes for Recharts
- **03-01:** Only extended fontSize with `display` -- preserved all Tailwind defaults

### Deferred Issues

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-25
Stopped at: Plan 03-01 complete. Phase 2 and Phase 3 running in parallel. Next for Phase 3: Plan 03-02 (layout components).
Resume file: .planning/phases/03-frontend-architecture/03-01-SUMMARY.md
