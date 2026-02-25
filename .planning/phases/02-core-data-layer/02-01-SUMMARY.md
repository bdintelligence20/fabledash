---
phase: 02-core-data-layer
plan: 01
subsystem: database
tags: [pydantic, firestore, enums, data-models]

# Dependency graph
requires:
  - phase: 01-02
    provides: Base response models (BaseResponse, ErrorResponse), pydantic BaseSettings config pattern
  - phase: 01-03
    provides: User model (CurrentUser, UserRole) for created_by uid references
provides:
  - Pydantic models for Client, Task, TaskComment, TaskAttachment, TimeLog entities
  - PartnerGroup, TaskStatus, TaskPriority str enums
  - calculate_duration_minutes helper for time log duration computation
  - Unified models __init__.py exporting all models, enums, and constants
  - COLLECTION_NAME constants for Firestore collection names (clients, tasks, time_logs)
affects: [02-02, 02-03, 02-04, 03-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: [Base/Create/Update/Response model hierarchy, str Enum pattern, dt module alias for datetime field shadowing]

key-files:
  created: [python-backend/app/models/time_log.py]
  modified: [python-backend/app/models/client.py, python-backend/app/models/task.py, python-backend/app/models/__init__.py]

key-decisions:
  - "Used import datetime as dt in time_log.py to avoid field name shadowing with date/time types"
  - "COLLECTION_NAME constants at module level (not class attributes) for simple Firestore lookups"
  - "TaskComment and TaskAttachment are embedded models (not separate collections) within task documents"
  - "duration_minutes excluded from TimeLogCreate -- calculated server-side and stored for query efficiency"

patterns-established:
  - "Model hierarchy: EntityBase (shared fields) -> EntityCreate (POST body) -> EntityUpdate (partial, all Optional) -> EntityResponse (full doc with id, timestamps, created_by)"
  - "Enum pattern: class EnumName(str, Enum) for JSON-serializable Firestore values"
  - "Collection constants: COLLECTION_NAME = 'collection_name' at module level"

issues-created: []

# Metrics
duration: 3min
completed: 2026-02-25
---

# Plan 02-01: Core Data Models Summary

**Pydantic models for clients (with PartnerGroup enum), tasks (with status/priority enums, embedded comments/attachments), and time logs (with duration calculation helper)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-25T13:37:36Z
- **Completed:** 2026-02-25T13:40:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Client model with PartnerGroup enum (collab, edcp, direct_clients, separate_businesses) and Create/Update/Response hierarchy
- Task model with TaskStatus (5 states) and TaskPriority (4 levels) enums, embedded TaskComment and TaskAttachment models
- TimeLog model with date/start_time/end_time fields and calculate_duration_minutes helper that validates end > start
- Unified models __init__.py exporting all 18+ symbols from client, task, time_log, user, and base modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Client and shared enum models** - `f5f8e15` (feat)
2. **Task 2: Create Task, TimeLog models and update models __init__** - `9b4c75e` (feat)

## Files Created/Modified
- `python-backend/app/models/client.py` - ClientBase/Create/Update/Response + PartnerGroup enum (rewrote from old Supabase model)
- `python-backend/app/models/task.py` - TaskBase/Create/Update/Response + TaskStatus/TaskPriority enums + TaskComment/TaskAttachment embedded models (rewrote from old Supabase model)
- `python-backend/app/models/time_log.py` - TimeLogBase/Create/Update/Response + calculate_duration_minutes helper (new file)
- `python-backend/app/models/__init__.py` - Unified exports for all models, enums, constants

## Decisions Made
- Used `import datetime as dt` in time_log.py to avoid Pydantic field name shadowing issue with `date` and `time` types (field named `date` shadows the `date` type from datetime module)
- COLLECTION_NAME as module-level constants rather than class attributes for simplicity
- TaskComment and TaskAttachment stored as embedded lists within task documents (not separate Firestore collections)
- duration_minutes is NOT in TimeLogCreate/Base -- it is calculated server-side in the API endpoint and stored for Firestore query efficiency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pydantic field name shadowing datetime types**
- **Found during:** Task 2 (TimeLog model creation)
- **Issue:** Field `date: date | None = None` caused `TypeError: unsupported operand type(s) for |: 'NoneType' and 'NoneType'` because Pydantic evaluates annotations at runtime, and the field name `date` shadows the `date` type from `datetime` module
- **Fix:** Changed to `import datetime as dt` and used `dt.date`, `dt.time`, `dt.datetime` throughout time_log.py
- **Files modified:** python-backend/app/models/time_log.py
- **Verification:** All imports and model instantiation pass correctly
- **Committed in:** `9b4c75e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking), 0 deferred
**Impact on plan:** Auto-fix was necessary for code to function. No scope creep.

## Issues Encountered
None beyond the field shadowing issue documented above.

## Next Phase Readiness
- All core data models defined and importable from `app.models`
- Ready for Plan 02-02 (Client CRUD endpoints), 02-03 (Task CRUD endpoints), and 02-04 (TimeLog CRUD endpoints)
- Consistent Base/Create/Update/Response pattern established for all entities
- COLLECTION_NAME constants ready for Firestore operations in API layer

---
*Phase: 02-core-data-layer*
*Completed: 2026-02-25*
