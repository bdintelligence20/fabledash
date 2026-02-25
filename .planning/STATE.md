# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** The CEO can ask "How's the business doing?" at any moment and get a real, data-backed answer — while AI agents autonomously handle repeatable client work.
**Current focus:** Phases 1-3 COMPLETE. Phase 4 (Client & Task Management) and Phase 5 (Advanced Time Logging) in progress.

## Current Position

Phase: 1, 2, 3 COMPLETE. 4, 5 of 12 -- IN PROGRESS
Plan: 04-01 complete, 05-01 complete, 05-03 complete. Next: 05-02 or 05-04.
Status: Phase 4 started (04-01 done), Phase 5 in progress (05-01, 05-03 done). Parallel execution.
Last activity: 2026-02-25 -- Plan 05-01 executed (time entry UI + backend is_billable field)

Progress: [================]░░░ ~25%

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: 3.1 min
- Total execution time: ~0.78 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 5/5 | 18 min | 3.6 min |
| 02-core-data | 4/4 | 12 min | 3.0 min |
| 03-frontend | 4/4 | 11 min | 2.8 min |
| 04-client-task | 1/5 | 3 min | 3.0 min |
| 05-advanced-time-logging | 2/5 | 5 min | 2.5 min |

**Recent Trend:**
- Last 5 plans: 02-04 (3 min), 03-03 (2 min), 02-03 (3 min), 03-04 (3 min), 05-03 (2 min)
- Trend: consistently fast ~2-3 min/plan

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
- **02-03:** Hard delete for tasks (leaf entities) -- no downstream referential dependencies
- **02-03:** Comments/attachments use Firestore ArrayUnion/ArrayRemove for atomic embedded array operations
- **02-03:** Enum values converted to .value before Firestore write, reconstructed on read via Pydantic
- **02-03:** Comment/attachment create bodies are plain dicts (not Pydantic models) for simple sub-resources
- **02-04:** Hard delete for time logs (leaf entities) -- no downstream referential dependencies
- **02-04:** ISO string serialization for date/time Firestore storage with Python type conversion on read
- **02-04:** Duration auto-recalculated on update when either start_time or end_time changes
- **02-04:** Hyphenated /time-logs URL prefix for REST convention; underscored time_logs for Firestore collection
- **03-01:** Surface palette uses warm stone tones (not cold grays) for human-centric feel
- **03-01:** tokens.ts mirrors tailwind.config.js exactly -- Tailwind config is single source of truth
- **03-01:** chartColors has categorical (6-color), sequential, and diverging palettes for Recharts
- **03-01:** Only extended fontSize with `display` -- preserved all Tailwind defaults
- **03-02:** No external dependencies added -- class merging via template literals, no clsx/tailwind-merge
- **03-02:** Compound components (Card, Table) use Object.assign pattern for dot-notation API
- **03-02:** Modal uses React Portal to document.body with Escape key and backdrop click close
- **03-02:** Component API pattern: all components accept className for override/extension
- **03-04:** Relative imports (../ui) instead of @/ aliases -- Vite has no path alias configured
- **03-04:** Dashboard widgets use hardcoded mock data -- no API calls in skeleton phase
- **03-04:** Revenue chart placeholder reserves min-h-[300px] with Phase 7 note
- **05-03:** Billable determination uses task_id presence as proxy (no explicit billable field yet)
- **05-03:** Partner group filtering is client-side via lookup map (API doesn't support this filter)
- **05-03:** Reference data pattern: fetch clients + tasks on mount, build Map<id, name> for O(1) lookups
- **04-01:** Badge variant mapping: edcp->default, separate_businesses->warning (no secondary/accent Badge variants)
- **04-01:** CreateEditClientModal is local component within ClientsPage (not extracted to separate file)
- **04-01:** Client names are Link components to /clients/{id} for detail page navigation
- **05-01:** is_billable defaults to True -- most agency work is billable
- **05-01:** Quick re-entry pattern: form clears task/description/times on success but keeps date and client
- **05-01:** Duration calculated client-side for instant feedback; server still calculates authoritatively

### Deferred Issues

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-25
Stopped at: Plan 05-03 complete. Phase 5 in progress. Next: 05-04 (time log edit/delete).
Resume file: .planning/phases/05-advanced-time-logging/05-03-SUMMARY.md
