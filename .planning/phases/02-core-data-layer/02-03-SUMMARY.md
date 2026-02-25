---
phase: 02-core-data-layer
plan: 03
subsystem: api
tags: [fastapi, firestore, crud, tasks, comments, attachments, array-union, filtering]

# Dependency graph
requires:
  - phase: 02-01
    provides: Task/TaskCreate/TaskUpdate/TaskResponse models, TaskStatus/TaskPriority enums, TaskComment/TaskAttachment embedded models, COLLECTION_NAME constant
  - phase: 01-02
    provides: BaseResponse/ErrorResponse models, get_firestore_client utility
  - phase: 01-03
    provides: get_current_user dependency, CurrentUser model
provides:
  - Task CRUD API (create, list with filtering, get, update, delete)
  - Comment sub-resource endpoints (add via ArrayUnion, delete via ArrayRemove)
  - Attachment metadata sub-resource endpoints (add via ArrayUnion, delete via ArrayRemove)
  - Task list filtering by client_id, status, priority, assigned_to
  - _doc_to_task Firestore document-to-dict helper with datetime and embedded model handling
affects: [03-frontend, 04-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [Firestore ArrayUnion/ArrayRemove for embedded sub-resources, _doc_to_task helper pattern, enum .value conversion for Firestore storage]

key-files:
  created: []
  modified: [python-backend/app/api/tasks.py, python-backend/app/main.py]

key-decisions:
  - "Hard delete for tasks (not soft delete) -- leaf entities not referenced by other collections, deactivated tasks add query noise"
  - "Comments and attachments use Firestore ArrayUnion/ArrayRemove for atomic embedded array operations"
  - "Comment/attachment body params are plain dicts (not Pydantic models) for simple sub-resource create endpoints"
  - "Enum values converted to .value before Firestore write, reconstructed on read via Pydantic validation"

patterns-established:
  - "_doc_to_task helper: converts Firestore snapshot to response dict with id mapping and datetime normalization"
  - "Sub-resource pattern: POST /{id}/sub to add (ArrayUnion), DELETE /{id}/sub/{sub_id} to remove (ArrayRemove)"
  - "All CRUD endpoints follow try/except with HTTPException re-raise pattern for clean error boundaries"

issues-created: []

# Metrics
duration: 3min
completed: 2026-02-25
---

# Plan 02-03: Task CRUD Endpoints Summary

**Full task CRUD API with 9 auth-protected endpoints including embedded comment/attachment management via Firestore ArrayUnion/ArrayRemove and list filtering by client, status, priority, assignee**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-25
- **Completed:** 2026-02-25
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- 9 auth-protected task endpoints: POST/GET list/GET single/PUT/DELETE for tasks, POST/DELETE for comments, POST/DELETE for attachments
- List endpoint supports filtering by client_id, status, priority, and assigned_to with Firestore chained .where() queries
- Embedded sub-resources (comments, attachments) managed atomically via Firestore ArrayUnion and ArrayRemove
- Task router wired into FastAPI app at /tasks prefix alongside existing clients and time-logs routers

## Task Commits

Each task was committed atomically:

1. **Task 1: Task API router with CRUD and filtering** - `5d7d4a4` (feat)
2. **Task 2: Wire task router into FastAPI app** - `2196000` (feat)

## Files Created/Modified
- `python-backend/app/api/tasks.py` - Full task CRUD router with 9 endpoints, _doc_to_task helper, comment/attachment sub-resources
- `python-backend/app/main.py` - Added tasks_router import and include at /tasks prefix, removed tasks placeholder comment

## Decisions Made
- Hard delete for tasks (not soft delete) since tasks are leaf entities not referenced by other collections; deactivated tasks would add query noise
- Used plain `dict` for comment/attachment POST bodies rather than creating dedicated Pydantic request models (simple fields: content for comments; filename/url/content_type for attachments)
- Enum values (.value) converted before Firestore storage to store plain strings, reconstructed via Pydantic validation on read
- _doc_to_task helper handles Firestore DatetimeWithNanoseconds to Python datetime conversion for consistent serialization

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- All Phase 2 CRUD endpoints now complete (clients, tasks, time-logs)
- Task API integrates with client_id for cross-entity relationships
- Ready for frontend integration in Phase 3 (task list, task detail views)
- Comment and attachment sub-resources ready for UI consumption

---
*Phase: 02-core-data-layer*
*Completed: 2026-02-25*
