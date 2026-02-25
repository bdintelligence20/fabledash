---
phase: 08-meeting-intelligence
plan: 02
status: complete
completed: 2026-02-25
commits:
  - "feat(08-02): meeting sync service and API endpoints"
files_modified:
  - python-backend/app/utils/meeting_sync.py
  - python-backend/app/api/meetings.py
  - python-backend/app/main.py
---

# 08-02 Summary: Meeting Sync Service and API Endpoints

## What was built

### Meeting sync service (`app/utils/meeting_sync.py`)

**MeetingSyncService** class orchestrating external meeting data into Firestore:

- `sync_readai(since)` -- Fetches meetings from Read.AI, maps to MeetingResponse, upserts to Firestore. Also pulls transcripts and stores them in the transcripts collection. Returns `{"synced": int, "errors": list[str]}`.
- `sync_fireflies(since)` -- Same flow for Fireflies.ai GraphQL transcripts. Converts duration from seconds to minutes. Returns `{"synced": int, "errors": list[str]}`.
- `sync_all(since)` -- Runs both syncs sequentially and returns combined results with `total_synced` and `total_errors`.
- `_match_client(title, participants)` -- Best-effort client matching: first checks if any active client name appears in the meeting title, then falls back to matching participant email domains against client contact_email domains. Returns client_id or None.
- `_map_readai_meeting(raw)` / `_map_fireflies_meeting(raw)` -- Transform raw API responses into MeetingResponse models with deterministic document IDs (`readai_{source_id}` / `fireflies_{source_id}`) for idempotent upserts.
- `_upsert_meeting(meeting)` -- Writes or updates Firestore document. On update, preserves manually-set fields (client_id, client_name, task_ids, notes). On insert, attempts client matching.
- `_sync_readai_transcript(meeting_doc_id, source_id)` / `_sync_fireflies_transcript(...)` -- Pull transcript segments from external APIs, map to TranscriptSegment/MeetingTranscript models, store in Firestore transcripts collection, and update meeting's `has_transcript` flag.
- `get_meeting_sync_service()` -- Module-level factory returning a new service with default clients.

### Meeting API endpoints (`app/api/meetings.py`)

All endpoints require `Depends(get_current_user)`. Fixed-path routes are registered before parameterized routes to avoid FastAPI routing conflicts.

**Fixed-path routes (before `/{meeting_id}`):**
- `GET /meetings/status` -- Returns `{readai_configured, fireflies_configured, last_sync}` from Firestore `_meta/meeting_sync` document.
- `POST /meetings/sync` -- Triggers `sync_all()` (CEO only via `require_ceo`). Records last sync timestamp and result in `_meta/meeting_sync`.

**Collection routes:**
- `GET /meetings/` -- List meetings with optional query params: `date_from`, `date_to`, `client_id`, `source` (MeetingSource enum), `limit` (default 50, max 200). Orders by date descending. Returns `MeetingResponse` models.
- `POST /meetings/` -- Create manual meeting. Resolves `client_name` from `client_id` if provided. Sets defaults for `has_transcript`, `action_items`, `key_topics`, `summary`.

**Single-resource routes:**
- `GET /meetings/{meeting_id}` -- Get meeting detail as `MeetingResponse`.
- `PUT /meetings/{meeting_id}` -- Update meeting fields. Re-resolves client name if `client_id` changed.
- `DELETE /meetings/{meeting_id}` -- Hard-delete meeting and associated transcript from both collections.
- `GET /meetings/{meeting_id}/transcript` -- Get transcript as `MeetingTranscript` model. Verifies meeting exists first, returns 404 if no transcript found.

**AI processing (from 08-03):**
- `POST /meetings/{meeting_id}/process` -- Trigger AI transcript processing (CEO only). Preserved from plan 08-03.

### Router registration (`app/main.py`)

- Added `from app.api.meetings import router as meetings_router`
- Added `app.include_router(meetings_router, prefix="/meetings", tags=["meetings"])`

## Decisions made

1. **Deterministic document IDs**: Meeting documents use `{source}_{source_id}` as Firestore document IDs (e.g., `readai_abc123`), making syncs idempotent -- repeated syncs update rather than duplicate.
2. **Preserved manual edits**: When upserting a synced meeting that already exists, fields like `client_id`, `client_name`, `task_ids`, and `notes` that may have been manually edited are preserved from the existing document.
3. **Client matching strategy**: Two-pass approach -- first checks meeting title for client name substring match, then checks participant email domains against client contact email domains. Pragmatic for a CEO dashboard.
4. **Fireflies duration conversion**: Fireflies returns duration in seconds; the mapper converts to minutes to match MeetingResponse's `duration_minutes` field.
5. **Route ordering**: Fixed paths (`/status`, `/sync`) placed before parameterized `/{meeting_id}` routes to prevent FastAPI from matching "status" as a meeting_id.
6. **Sync metadata**: Last sync time and result stored in `_meta/meeting_sync` Firestore document for the status endpoint to report.

## Deviations from plan

- The plan did not mention the `/process` endpoint from 08-03. Since 08-03 was committed first, the final `meetings.py` integrates both 08-02 and 08-03 endpoints in a single file.
- `meeting_sync.py` was committed as part of a batch with other files rather than in a standalone commit, but the file content matches the plan exactly.

## Verification

```
cd /Users/nic/fable/python-backend && python3 -c \
  "from app.main import app; routes = [r.path for r in app.routes]; print([r for r in routes if 'meeting' in r])"
# Output: ['/meetings/status', '/meetings/sync', '/meetings/', '/meetings/',
#          '/meetings/{meeting_id}', '/meetings/{meeting_id}', '/meetings/{meeting_id}',
#          '/meetings/{meeting_id}/transcript', '/meetings/{meeting_id}/process']
```

All 9 meeting routes registered:
- GET /meetings/status
- POST /meetings/sync
- GET /meetings/
- POST /meetings/
- GET /meetings/{meeting_id}
- PUT /meetings/{meeting_id}
- DELETE /meetings/{meeting_id}
- GET /meetings/{meeting_id}/transcript
- POST /meetings/{meeting_id}/process
