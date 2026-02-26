# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** The CEO can ask "How's the business doing?" at any moment and get a real, data-backed answer — while AI agents autonomously handle repeatable client work.
**Current focus:** Phase 12 (Integration & Deployment) — IN PROGRESS. Plans 01-02 and 04 of 06 complete: Google integrations + Docker deployment pipeline.

## Current Position

Phase: 12-integration-deployment (plans 01-02, 04 of 06 complete)
Plan: 12-04 complete. Docker deployment configs, Compose for local dev, nginx API proxy.
Status: Google integrations live + Docker deployment pipeline ready.
Last activity: 2026-02-26 -- Plan 12-04 complete (GCP deployment pipeline)

Progress: [===============================================] ~80%

## Performance Metrics

**Velocity:**
- Total plans completed: 32
- Average duration: 2.8 min
- Total execution time: ~1.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 5/5 | 18 min | 3.6 min |
| 02-core-data | 4/4 | 12 min | 3.0 min |
| 03-frontend | 4/4 | 11 min | 2.8 min |
| 04-client-task | 5/5 | 17 min | 3.4 min |
| 05-advanced-time-logging | 5/5 | 13 min | 2.6 min |

**Recent Trend:**
- Last 5 plans: 04-04 (3 min), 05-04 (2 min), 05-02 (2 min), 04-02 (2 min), 02-04 (3 min)
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
- **04-03:** Badge variant 'default' used for todo/low (component has no 'secondary' variant)
- **04-03:** Client-side search filters displayed tasks by title; API filters handle status/priority/client
- **04-03:** Bulk status change uses Promise.all for parallel PUT requests, then refreshes list
- **04-03:** Delete is hard delete with confirmation modal (matches backend behavior)
- **04-02:** EditClientModal is local to ClientDetailPage (same pattern as 04-01 modal in ClientsPage)
- **04-02:** Tab labels include counts ("Tasks (5)") for at-a-glance context
- **04-02:** Dynamic breadcrumb shows "Detail" for known parent routes (/clients, /tasks) instead of raw IDs
- **04-02:** New Task button links to /tasks?client_id=X (simple link, no inline create modal)
- **05-01:** is_billable defaults to True -- most agency work is billable
- **05-01:** Quick re-entry pattern: form clears task/description/times on success but keeps date and client
- **05-01:** Duration calculated client-side for instant feedback; server still calculates authoritatively
- **05-02:** Timer onStop callback delegates API POST to parent (TimePage) for centralized data flow
- **05-02:** Timer and form maintain separate task lists to avoid coupling their client selections
- **05-02:** ActivityLog sorts chronologically ascending for natural top-to-bottom timeline reading
- **05-02:** Grid uses 3/5 + 2/5 column split (lg:grid-cols-5) for balanced form/log proportion
- **05-04:** Four chart colors mapped to partner groups: primary-500 (Collab), success-500 (EDCP), accent-500 (Direct Clients), warning-500 (Separate Businesses)
- **05-04:** Stacked bar built with pure CSS/Tailwind -- no chart library dependency added
- **05-04:** Backend builds client_id->partner_group map by fetching all clients for cross-collection Firestore join
- **04-04:** Status transitions defined as data-driven map (STATUS_TRANSITIONS) keyed by current status
- **04-04:** Delete uses inline confirmation pattern (not modal) for faster UX
- **04-04:** relativeTime helper is simple math-based (no date-fns) for comment timestamps
- **04-04:** Time logs section is read-only with graceful fallback if API doesn't support task_id filter
- **10-03:** Fallback suggested questions when API unavailable (graceful degradation)
- **10-03:** Session-local message history (no persistence -- fresh each session)
- **10-03:** QuickActions updated with navigate() for all actions, not just OpsAI
- **10-03:** Sparkles icon for OpsAI branding (accent color palette) vs Bot icon for agents
- **10-04:** Promise.allSettled for parallel dashboard API calls — each widget degrades independently
- **10-04:** AlertsPanel severity: high->danger/red, medium->warning/amber, low->primary/blue
- **10-04:** Client name resolution via parallel /clients fetch + Map<id, name> for RecentActivity
- **10-04:** Time logs sliced to 5 client-side (API has no limit param, returns DESC sorted)
- **10-05:** Highlight styling uses accent-50/100 palette (not gradient) for OpsAI sidebar nav item
- **10-05:** High-severity alert banner shows first alert message with +N more count pattern
- **10-05:** OpsAI Insights widget conditionally rendered only when alerts exist (no empty state)
- **11-01:** Productivity score is composite: 60% utilization + 40% completion rate
- **11-01:** Cost/benefit rankings use ZAR-per-hour as primary ranking metric
- **11-01:** Report engine methods accept date objects (not strings) for type safety
- **11-01:** Comparison engine uses higher_is_better semantics per metric for direction labeling
- **11-01:** Time entry consistency calculates working days (Mon-Fri) for accurate denominator
- **11-02:** Quarter date ranges hardcoded as QUARTER_RANGES dict (not calculated)
- **11-02:** YTD compares current year Jan 1-today vs same date range last year
- **11-02:** Delta calculation: absolute_change + percentage_change + direction per metric
- **11-02:** Comparison engine delegates to ReportEngine.full_health_report for both periods
- **11-03:** Health score weighted composite: 40% operational, 35% financial, 25% process
- **11-03:** Accordion sections all open by default for immediate visibility
- **11-03:** Conic-gradient CSS gauge for utilization rate (no chart library added)
- **11-03:** SectionAccordion, MetricCard, ProgressMetric are local sub-components (not extracted to UI library)
- **11-04:** ComparisonReportPage uses QvQ and YTD modes with auto-fetch on param change
- **11-04:** Side-by-side 12-column grid: 3 label + 3 value A + 1 trend arrow + 3 value B + 2 delta badge
- **11-04:** Delta summary: green bullet list for improvements, red bullet list for declines
- **11-04:** Three metric sections: Operational, Financial, Process with curated metric subsets
- **12-02:** Gmail/Calendar clients accept credentials dict (not OAuth flow yet) — ready for future Google OAuth
- **12-02:** Clients return empty/unconfigured responses when no credentials — graceful degradation pattern
- **12-02:** Singleton get_gmail_client/get_calendar_client matches existing Fireflies/Sage client pattern
- **12-02:** Integrations router under /integrations prefix with /gmail/* and /calendar/* sub-paths
- **12-01:** Drive endpoints added to shared integrations.py router (alongside Gmail/Calendar)
- **12-01:** GoogleDriveClient uses lazy service init and singleton pattern
- **12-01:** Client folder lookup resolves client name from Firestore before searching Drive
- **12-01:** Unconfigured Drive returns 503 (service unavailable) for clear error signaling
- **12-04:** Backend port standardized to 8000 (Cloud Run overrides via PORT env var)
- **12-04:** Frontend Dockerfile is multi-stage: node:20-alpine build + nginx:alpine serve
- **12-04:** nginx proxies /api/ to backend:8000; SPA routing via try_files for all other paths
- **12-04:** Preserved tesseract-ocr/poppler-utils system deps in backend Dockerfile for OCR/PDF

### Deferred Issues

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-26
Stopped at: Phase 12 plans 01-02, 04 complete. Google integrations + Docker deployment pipeline.
Resume file: .planning/phases/12-integration-deployment/12-04-SUMMARY.md
