---
phase: 08-meeting-intelligence
plan: 01
status: complete
completed: 2026-02-25
commits:
  - "feat(08-01): meeting data models and API clients"
files_modified:
  - python-backend/app/config.py
  - python-backend/app/models/meeting.py
  - python-backend/app/utils/readai_client.py
  - python-backend/app/utils/fireflies_client.py
---

# 08-01 Summary: Meeting Data Models and API Clients

## What was built

### Config updates (`app/config.py`)
- **READAI_API_KEY** (str, default ""): API key for Read.AI service
- **READAI_API_BASE_URL** (str, default "https://api.read.ai/v1"): Read.AI REST API base URL
- **FIREFLIES_API_KEY** (str, default ""): API key for Fireflies.ai service
- **FIREFLIES_API_BASE_URL** (str, default "https://api.fireflies.ai/graphql"): Fireflies GraphQL endpoint

### Meeting models (`app/models/meeting.py`)
Firestore collection constants:
- `COLLECTION_NAME = "meetings"`
- `TRANSCRIPT_COLLECTION = "transcripts"`
- `BRIEFING_COLLECTION = "meeting_briefings"`

Models:
- **MeetingSource** (str, Enum): `READ_AI`, `FIREFLIES`, `MANUAL` — tracks where a meeting record originated
- **TranscriptSegment** (BaseModel): `speaker`, `text`, `start_time` (float|None), `end_time` (float|None)
- **MeetingTranscript** (BaseModel): `id`, `meeting_id`, `segments` (list[TranscriptSegment]), `full_text`, `word_count`, `created_at`
- **MeetingCreate** (BaseModel): `title`, `date`, `duration_minutes` (int|None), `participants` (list[str]), `source` (MeetingSource), `client_id` (str|None), `task_ids` (list[str]), `notes` (str|None)
- **MeetingResponse** (BaseModel): Full meeting document with `id`, `title`, `date`, `duration_minutes`, `participants`, `source`, `source_id`, `client_id`, `client_name`, `task_ids`, `notes`, `has_transcript`, `action_items`, `key_topics`, `summary`, `created_at`, `updated_at`
- **BriefingRequest** (BaseModel): `meeting_id`, `format` (default "formal"), `include_action_items` (default True)
- **MeetingBriefing** (BaseModel): `id`, `meeting_id`, `content`, `format`, `generated_at`, `generated_by`

### Read.AI client (`app/utils/readai_client.py`)
- **ReadAIClient** class with `httpx.AsyncClient` (30s timeout)
- `is_configured()` — checks if READAI_API_KEY is set
- `get_meetings(since)` — GET /meetings with optional date filter
- `get_transcript(meeting_id)` — GET /meetings/{id}/transcript
- `get_action_items(meeting_id)` — GET /meetings/{id}/action_items
- `get_summary(meeting_id)` — GET /meetings/{id}/summary
- `get_readai_client()` — module-level singleton factory following SageClient pattern
- All methods include structured error handling with httpx.HTTPStatusError and RequestError

### Fireflies client (`app/utils/fireflies_client.py`)
- **FirefliesClient** class with `httpx.AsyncClient` (30s timeout)
- `is_configured()` — checks if FIREFLIES_API_KEY is set
- `_graphql_request(query, variables)` — core GraphQL executor, raises RuntimeError on GraphQL-level errors
- `get_transcripts(since)` — GraphQL query for transcript list with optional date filter
- `get_transcript(transcript_id)` — GraphQL query for single transcript with sentences and summary
- `get_summary(transcript_id)` — GraphQL query for transcript summary (overview, action_items, keywords, outline)
- `get_fireflies_client()` — module-level singleton factory following SageClient pattern

## Decisions made

1. **Singleton pattern**: Both clients use the same `_module_var` + `get_*_client()` factory pattern established by `sage_client.py`, keeping instantiation consistent across all API clients.
2. **datetime parameter type**: Used `datetime | None` for `since` parameters (rather than `str | None` from the plan) since it is more type-safe; the clients convert to ISO format internally.
3. **GraphQL error handling**: Fireflies client raises `RuntimeError` on GraphQL errors (in the `errors` key), separate from HTTP-level errors, giving callers clear error semantics.
4. **Bearer auth for both**: Both services use `Authorization: Bearer {key}` pattern in headers, constructed per-request via `_headers()` helper.
5. **No requirements.txt change needed**: `httpx>=0.24.0` was already present in requirements.txt; no additional dependencies required.

## Deviations from plan

- The plan listed `requirements.txt` in `files_modified` but httpx was already a dependency, so no change was needed.
- `since` parameter typed as `datetime | None` instead of `str | None` for better type safety.

## Verification

```
cd /Users/nic/fable/python-backend && python3 -c \
  "from app.models.meeting import MeetingResponse, COLLECTION_NAME; \
   from app.utils.readai_client import ReadAIClient; \
   from app.utils.fireflies_client import FirefliesClient; \
   print('OK')"
# Output: OK
```

All checks pass:
- Models import OK
- ReadAI client imports OK
- Fireflies client imports OK
- Config has new API key fields (READAI_API_KEY, READAI_API_BASE_URL, FIREFLIES_API_KEY, FIREFLIES_API_BASE_URL)
