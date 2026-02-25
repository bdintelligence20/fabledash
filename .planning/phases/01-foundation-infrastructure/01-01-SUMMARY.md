---
phase: 01-foundation-infrastructure
plan: 01
subsystem: infra
tags: [supabase-removal, firebase, firebase-admin, google-cloud-firestore, react-router-dom, dependency-management]

# Dependency graph
requires:
  - phase: none
    provides: existing codebase with Supabase dependencies
provides:
  - Clean codebase with zero Supabase references
  - Firebase packages installed (frontend: firebase, backend: firebase-admin + google-cloud-firestore)
  - react-router-dom installed for routing
  - Environment templates for both frontend and backend
  - Placeholder API router stubs ready for Firebase rebuild
affects: [01-02, 01-03, 01-04, 01-05, 02-data-models]

# Tech tracking
tech-stack:
  added: [firebase ^10.14.1, react-router-dom ^6.28.0, firebase-admin, google-cloud-firestore]
  removed: [@supabase/supabase-js, supabase (python)]
  patterns: [Vite env vars via import.meta.env, placeholder router stubs]

key-files:
  created: [.env.example, python-backend/.env.example]
  modified: [package.json, python-backend/requirements.txt, python-backend/app/main.py, src/utils/api.ts, index.html, src/vite-env.d.ts]
  deleted: [python-backend/app/utils/supabase_client.py, env-config.js, 9 SQL fix files, 5 SQL scripts, setup_document_chunks_table.py, supabase-schema.sql]

key-decisions:
  - "Gutted document_processor.py entirely rather than partial cleanup -- too deeply coupled to Supabase, will rebuild with Firebase"
  - "Cleaned extra supabase artifacts beyond plan scope (services/document_processor.py, tests/conftest.py, scripts/) to achieve zero-supabase goal"
  - "Removed window.ENV type declaration and env-config.js script tag from index.html as part of cleanup"

patterns-established:
  - "Environment config: Frontend uses import.meta.env.VITE_* (Vite native), backend uses python-dotenv"
  - "Placeholder stubs: API routers return {status: pending rebuild} during migration"

issues-created: []

# Metrics
duration: 8min
completed: 2026-02-25
---

# Plan 01-01: Strip Supabase, Install Firebase Summary

**Removed all Supabase dependencies from full stack and installed firebase, firebase-admin, google-cloud-firestore, and react-router-dom**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-25T15:14:00Z
- **Completed:** 2026-02-25T15:22:00Z
- **Tasks:** 2
- **Files modified:** 25+

## Accomplishments
- Zero Supabase references remaining anywhere in the codebase (verified with grep)
- Firebase packages installed for both frontend (firebase ^10.14.1) and backend (firebase-admin, google-cloud-firestore)
- react-router-dom ^6.28.0 installed for upcoming auth routing
- Environment templates created for both frontend (.env.example) and backend (python-backend/.env.example)
- All API routers replaced with clean placeholder stubs
- Backend FastAPI app loads successfully, frontend builds cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove Supabase from backend** - `f14ab83` (refactor)
2. **Task 2: Remove Supabase from frontend and install Firebase** - `69239fa` (refactor)

## Files Created/Modified
- `package.json` - Replaced @supabase/supabase-js with firebase and react-router-dom
- `package-lock.json` - Updated lockfile
- `python-backend/requirements.txt` - Replaced supabase with firebase-admin and google-cloud-firestore
- `python-backend/app/main.py` - Removed Supabase imports, commented out router includes, simplified CORS
- `python-backend/app/api/agents.py` - Placeholder stub
- `python-backend/app/api/chats.py` - Placeholder stub
- `python-backend/app/api/documents.py` - Placeholder stub
- `python-backend/app/api/clients.py` - Placeholder stub
- `python-backend/app/api/tasks.py` - Placeholder stub
- `python-backend/app/services/document_processor.py` - Placeholder stub
- `python-backend/tests/conftest.py` - Removed Supabase mock fixtures
- `src/utils/api.ts` - Simplified to use import.meta.env.VITE_API_URL with localhost fallback
- `src/vite-env.d.ts` - Removed window.ENV type declaration
- `index.html` - Removed env-config.js script tag
- `.env.example` - Created with Firebase config vars
- `python-backend/.env.example` - Created with Firebase credentials config
- Deleted: `python-backend/app/utils/supabase_client.py`, `env-config.js`, 9 root SQL files, `FINAL_COMPLETE_FIX_GUIDE.md`, 4 SQL scripts in python-backend/scripts/, `setup_document_chunks_table.py`, `supabase-schema.sql`

## Decisions Made
- Gutted document_processor.py entirely (too coupled to Supabase) rather than partial cleanup -- will be fully rebuilt with Firebase in Phase 2
- Cleaned additional supabase artifacts beyond explicit plan scope (services, tests, scripts) to achieve the zero-supabase verification requirement
- Removed window.ENV runtime config pattern in favor of Vite's native import.meta.env

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Additional supabase references in document_processor.py, conftest.py, scripts/**
- **Found during:** Task 1 (backend Supabase removal)
- **Issue:** Plan only listed main.py and API routers, but document_processor.py, tests/conftest.py, and scripts/ also had deep supabase references
- **Fix:** Gutted document_processor.py to placeholder, cleaned conftest.py, deleted all scripts with supabase refs
- **Files modified:** python-backend/app/services/document_processor.py, python-backend/tests/conftest.py, python-backend/scripts/*
- **Verification:** `grep -r "supabase" python-backend/ --include="*.py"` returns no matches
- **Committed in:** f14ab83 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Supabase references in index.html and vite-env.d.ts**
- **Found during:** Task 2 (frontend cleanup)
- **Issue:** index.html had env-config.js script tag, vite-env.d.ts had window.ENV type with SUPABASE_URL/KEY
- **Fix:** Removed script tag from index.html, cleaned vite-env.d.ts
- **Files modified:** index.html, src/vite-env.d.ts
- **Verification:** Build succeeds, grep confirms no supabase refs
- **Committed in:** 69239fa (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both missing critical), 0 deferred
**Impact on plan:** Both auto-fixes necessary to achieve plan's stated verification criteria (zero supabase references). No scope creep.

## Issues Encountered
None -- all changes were straightforward and both build and app-load verifications passed on first attempt.

## Next Phase Readiness
- Codebase is clean of all Supabase dependencies
- Firebase packages installed and ready for configuration (Plan 01-02)
- Environment templates ready for Firebase credentials
- All API routers are placeholder stubs ready for Firebase/Firestore rebuild in Phase 2

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-02-25*
