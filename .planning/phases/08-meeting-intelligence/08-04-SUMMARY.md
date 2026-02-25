---
phase: 08-meeting-intelligence
plan: "04"
status: complete
completed: 2026-02-25
commits:
  - "feat(08-04): briefing generator with formal/summary/dispatch formats"
files_modified:
  - python-backend/app/utils/briefing_generator.py
  - python-backend/app/api/meetings.py
---

# 08-04 Summary: Briefing Generator with Formal/Summary/Dispatch Formats

## What was built

### Briefing generator (`app/utils/briefing_generator.py`)

**BriefingGenerator** class — singleton via `get_briefing_generator()`:

- `__init__()` — loads OpenAI `AsyncOpenAI` client from `OPENAI_API_KEY` in config. Logs a warning and stays functional (without AI) if the key is missing. Raises `RuntimeError` only when generation is attempted without a key.
- `generate_briefing(meeting, transcript_text, format) -> str` — builds a rich prompt from meeting metadata (title, date, participants), client context (fetched from Firestore if `client_id` is present), transcript/notes text, previously extracted action items, key topics, and linked task IDs. Calls gpt-4o-mini with format-specific system prompts:
  - **"formal"**: Full structured brief with Header, Executive Summary, Key Discussion Points, Decisions Made, Action Items, Next Steps, and Context sections.
  - **"summary"**: Concise executive summary (3-5 sentences) plus action items only.
  - **"dispatch"**: Short team-internal update — one paragraph plus action bullet list, maximum 150 words.
- `save_briefing(meeting_id, content, format, user_id) -> MeetingBriefing` — persists the generated briefing to Firestore's `meeting_briefings` collection. Returns a `MeetingBriefing` model instance with the document ID and timestamps.
- `_fetch_client_context(client_id) -> dict | None` — fetches client name, company, industry, notes, and status from Firestore for prompt enrichment.

All OpenAI calls use `temperature=0.3` for deterministic output, consistent with the transcript processor.

### Meetings API additions (`app/api/meetings.py`)

- **POST `/meetings/{meeting_id}/briefing`** (authenticated):
  - Accepts `BriefingRequest` body with `meeting_id`, `format`, and `include_action_items` fields.
  - Fetches the meeting document and resolves transcript text (transcripts collection first, then meeting notes fallback).
  - Calls `BriefingGenerator.generate_briefing()` and `save_briefing()`.
  - Returns `{ success, data: { briefing_id, content, format } }`.
  - Returns 503 if OpenAI is not configured, 404 if meeting not found.

- **GET `/meetings/{meeting_id}/briefings`** (authenticated):
  - Lists all generated briefings for a meeting, ordered by `generated_at` descending.
  - Returns `{ success, data: [MeetingBriefing, ...] }`.

Both endpoints are placed BEFORE the `GET /{meeting_id}` route to prevent FastAPI path parameter conflicts.

New imports added: `BriefingRequest`, `MeetingBriefing`, `BRIEFING_COLLECTION` from models, and `get_briefing_generator` from utils.

## Decisions made

1. **gpt-4o-mini model** — consistent with the transcript processor; cost-efficient for high-volume briefing generation.
2. **Client context injection** — if a meeting has a `client_id`, the generator fetches client details (name, company, industry, notes) from Firestore and includes them in the prompt for richer, contextualised briefs.
3. **Three-format system** — formal for board-level documentation, summary for quick review, dispatch for internal team distribution. Unknown formats fall back to formal.
4. **Graceful degradation** — missing `OPENAI_API_KEY` does not crash the import; a `RuntimeError` is raised only when briefing generation is requested without configuration.
5. **Transcript resolution chain** — same pattern as the process endpoint: checks transcripts collection first, falls back to meeting notes.
6. **Firestore persistence** — briefings are stored in a dedicated `meeting_briefings` collection with `meeting_id`, `format`, `generated_at`, and `generated_by` fields, enabling version history per meeting.

## Deviations from plan

None. All specified functionality was implemented as described.

## Verification

```
cd /Users/nic/fable/python-backend && python3 -c \
  "from app.utils.briefing_generator import BriefingGenerator; print('OK')"
# Output: OK

cd /Users/nic/fable/python-backend && python3 -c \
  "from app.api.meetings import router; \
   print('Routes:', [r.path for r in router.routes]); print('OK')"
# Output: Routes: ['/status', '/sync', '/', '/', '/{meeting_id}/briefing', '/{meeting_id}/briefings', '/{meeting_id}', '/{meeting_id}', '/{meeting_id}', '/{meeting_id}/transcript', '/{meeting_id}/process']
# Output: OK
```
