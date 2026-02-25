# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** The CEO can ask "How's the business doing?" at any moment and get a real, data-backed answer — while AI agents autonomously handle repeatable client work.
**Current focus:** Phase 2 and Phase 3 in progress (parallel execution). 02-02, 02-04, 03-02, and 03-03 complete.

## Current Position

Phase: 2 & 3 of 12 -- IN PROGRESS (parallel)
Plan: 02-04 complete (time log CRUD), 02-02 complete (client CRUD), 03-02 complete (UI component library), 02-01 complete (core data models), 03-01 complete (design system tokens)
Status: Phase 2 and Phase 3 running in parallel. 02-01, 02-02, 02-04, 03-01, 03-02 done. 02-03 in progress. Next: 02-03 (task CRUD), 03-03 (layout components), 03-04 (dashboard widgets).
Last activity: 2026-02-25 — Plan 02-04 executed (time log CRUD with auto-duration)

Progress: [===========]░░ ~20%

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 3.3 min
- Total execution time: ~0.55 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 5/5 | 18 min | 3.6 min |
| 02-core-data | 3/4 | 9 min | 3.0 min |
| 03-frontend | 2/4 | 6 min | 3.0 min |

**Recent Trend:**
- Last 5 plans: 03-01 (3 min), 02-01 (3 min), 02-02 (3 min), 03-02 (3 min), 02-04 (3 min)
- Trend: consistently fast ~3 min/plan

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
- **02-01:** Used `import datetime as dt` in time_log.py to avoid Pydantic field name shadowing with date/time types
- **02-01:** COLLECTION_NAME constants at module level for simple Firestore collection lookups
- **02-01:** TaskComment/TaskAttachment are embedded models within task documents (not separate Firestore collections)
- **02-01:** duration_minutes excluded from TimeLogCreate -- calculated server-side, stored for query efficiency
- **02-01:** Model hierarchy pattern: Base -> Create -> Update (all Optional) -> Response (with id, timestamps, created_by)
- **02-02:** Soft delete (is_active=False) instead of hard delete to preserve task/time log referential integrity
- **02-02:** Re-raise HTTPException in catch-all except blocks to avoid swallowing 404s
- **02-02:** model_dump(mode="json") for response serialization ensures datetime JSON compatibility
- **03-01:** Surface palette uses warm stone tones (not cold grays) for human-centric feel
- **03-01:** tokens.ts mirrors tailwind.config.js exactly -- Tailwind config is single source of truth
- **03-01:** chartColors has categorical (6-color), sequential, and diverging palettes for Recharts
- **03-01:** Only extended fontSize with `display` -- preserved all Tailwind defaults
- **02-04:** Hard delete for time logs (leaf entities) -- no downstream referential dependencies
- **02-04:** ISO string serialization for date/time Firestore storage with Python type conversion on read
- **02-04:** Duration auto-recalculated on update when either start_time or end_time changes
- **02-04:** Hyphenated /time-logs URL prefix for REST convention; underscored time_logs for Firestore collection
- **03-02:** No external dependencies added -- class merging via template literals, no clsx/tailwind-merge
- **03-02:** Compound components (Card, Table) use Object.assign pattern for dot-notation API
- **03-02:** Modal uses React Portal to document.body with Escape key and backdrop click close
- **03-02:** Component API pattern: all components accept className for override/extension

### Deferred Issues

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-25
Stopped at: Plan 02-04 complete. Phase 2 and Phase 3 running in parallel. Next: 02-03 (task CRUD), 03-03 (layout components), 03-04 (dashboard widgets).
Resume file: .planning/phases/02-core-data-layer/02-04-SUMMARY.md
