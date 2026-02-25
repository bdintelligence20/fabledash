---
phase: 08-meeting-intelligence
plan: "03"
status: complete
completed: 2026-02-25
commits:
  - "feat(08-03): transcript processor with AI summarization"
files_modified:
  - python-backend/app/utils/transcript_processor.py
  - python-backend/app/api/meetings.py
---

# 08-03 Summary: Transcript Processor with AI Summarisation

## What was built

### Transcript processor (`app/utils/transcript_processor.py`)

**TranscriptProcessor** class — singleton via `get_transcript_processor()`:

- `__init__()` — loads OpenAI `AsyncOpenAI` client from `OPENAI_API_KEY` in config. Logs a warning and stays functional (without AI) if the key is missing.
- `extract_entities(text) -> dict` — calls gpt-4o-mini to extract `client_names`, `task_refs`, `people`, `dates`, `action_items` from raw transcript text. Returns structured JSON; falls back to empty lists on parse failure.
- `match_entities_to_records(entities) -> dict` — fuzzy-matches extracted `client_names` against active Firestore clients (case-insensitive substring) and `task_refs` against task titles. Returns `{"matched_client": {...} | None, "matched_tasks": [...]}`.
- `generate_summary(text, title) -> str` — produces a 3-5 bullet point summary via gpt-4o-mini.
- `extract_action_items(text) -> list[str]` — extracts action items as a JSON array via gpt-4o-mini; falls back to empty list on parse failure.
- `process_transcript(meeting_id, text) -> dict` — orchestration method: runs all four steps sequentially, then updates the Firestore meeting document with `summary`, `action_items`, `key_topics`, `client_id`, `client_name`, and `task_ids`.

All OpenAI calls use `temperature=0.3` for deterministic output. JSON fencing (```json blocks) is stripped before parsing.

### Meetings API additions (`app/api/meetings.py`)

- **POST `/meetings/{meeting_id}/process`** (CEO only via `require_ceo` dependency):
  - Fetches the meeting document from Firestore
  - Resolves transcript text: first checks the `transcripts` collection for a linked document, then falls back to the meeting's `notes` field
  - Returns 400 if no text is available, 503 if OpenAI is not configured
  - Returns `{ success, data: { summary, action_items, matched_client, matched_tasks } }`
  - Placed BEFORE the `GET /{meeting_id}` route to prevent FastAPI path parameter clash

- Basic CRUD placeholders (POST `/`, GET `/`, GET `/{meeting_id}`) also provided for the meetings router if 08-02 has not yet created them. The parallel agent (08-02) had already registered the router import and `include_router` call in `main.py`.

## Decisions made

1. **gpt-4o-mini model** — chosen for cost efficiency on high-volume transcript processing; temperature 0.3 for consistent extraction.
2. **Sequential OpenAI calls** — entity extraction, matching, summary, and action items run sequentially (not concurrently) to respect rate limits and keep logic predictable.
3. **Graceful degradation** — if `OPENAI_API_KEY` is unset, the processor initialises without an OpenAI client and raises `RuntimeError` only when processing is attempted, rather than failing at import time.
4. **Substring fuzzy matching** — entity-to-record matching uses case-insensitive substring containment rather than a full fuzzy library, keeping dependencies minimal while covering the most common naming patterns.
5. **Transcript resolution chain** — the process endpoint checks the `transcripts` collection first (for full transcripts from Read.AI / Fireflies), then falls back to the meeting `notes` field.

## Deviations from plan

- The plan mentioned creating the meetings router if 08-02 had not yet created it. The parallel agent had already wired the import and `include_router` in `main.py`, so only the endpoint code was added to the existing router file.

## Verification

```
cd /Users/nic/fable/python-backend && python3 -c \
  "from app.utils.transcript_processor import TranscriptProcessor; print('OK')"
# Output: OK

cd /Users/nic/fable/python-backend && python3 -c \
  "from app.api.meetings import router; \
   print('Routes:', [r.path for r in router.routes]); print('OK')"
# Output: Routes: ['/{meeting_id}/process', '/', '/', '/{meeting_id}']
# Output: OK
```
