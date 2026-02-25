---
phase: 09-ai-agent-ecosystem
plan: 06
status: complete
completed: 2026-02-25
---

# 09-06 Summary: Tier 2 Client-Based Agent

## What was done

### 1. Client agent utility (`python-backend/app/utils/client_agent.py`)
- **ClientAgent** class initialised from an `agent_config` dict (requires `client_id`; optional `model`, `system_prompt`, `document_ids`, `id`)
- Creates its own `AsyncOpenAI` client from `get_settings().OPENAI_API_KEY`; graceful warning when key is missing, `RuntimeError` on actual LLM call
- Uses `get_rag_engine()` singleton for vector search / context retrieval

#### `get_client_context() -> dict`
Fetches from Firestore in a single method call:
- Client details from `clients` collection
- Recent tasks (limit 10, descending by `created_at`) from `tasks`
- Recent time logs (limit 10) from `time_logs`
- Recent meetings (limit 5) from `meetings`
- Recent invoices (limit 5) from `invoices`
Returns `{"client", "tasks", "time_logs", "meetings", "invoices"}`

#### `execute_task(task_description) -> str`
- Loads full client context + RAG retrieval scoped to `client_id` / `agent_id`
- Builds a combined prompt with client context, relevant documents, and task description
- Generates deliverable via OpenAI chat completions using agent's configured model

#### `answer_query(query, conversation_history=[]) -> dict`
- Injects client context and RAG documents as the opening conversation turn
- Replays optional `conversation_history` for multi-turn support
- Returns `{"answer": str, "sources": [{"chunk_id", "document_id", "content", "score"}]}`

#### `generate_client_report(report_type="status") -> str`
- Compiles report from client context data via OpenAI
- Three report types: `"status"` (project state, tasks, risks), `"financial"` (invoices, billed amounts, hours), `"activity"` (recent work, meetings, deliverables)
- Uses a professional report-writer system prompt with markdown formatting

#### Internal helpers
- `_build_context_prompt(context)` — serialises the context dict into structured markdown for LLM consumption
- `_ensure_openai()` — returns the client or raises `RuntimeError`

### 2. API endpoints added to `python-backend/app/api/agents.py`
All three endpoints are registered AFTER `/ops/*` routes and BEFORE the `/{agent_id}` GET catch-all to avoid path conflicts.

#### `POST /{agent_id}/execute`
- Body: `{"task_description": str}`
- Loads agent, validates Tier 2 (has `client_id`), calls `ClientAgent.execute_task()`
- Returns `{"success": true, "data": {"result": str}}`
- 503 if OpenAI unavailable, 422 if agent is not Tier 2

#### `POST /{agent_id}/report`
- Body: `{"report_type": str}` (default `"status"`)
- Returns `{"success": true, "data": {"report": str, "report_type": str}}`

#### `GET /{agent_id}/context`
- No body required; returns the raw client context dict
- Returns `{"success": true, "data": {"client": {...}, "tasks": [...], ...}}`

#### Supporting additions
- `_load_client_agent(db, agent_id)` helper — loads agent doc, validates Tier 2, returns `ClientAgent` instance
- `ExecuteTaskBody` and `GenerateReportBody` Pydantic request schemas
- Module docstring updated to document Tier 2 endpoints

## Patterns followed
- Matches existing `RAGEngine` and `OpsTrafficAgent` conventions for OpenAI usage
- Uses `get_firestore_client()` for all DB access, `get_settings()` for config
- Graceful degradation when `OPENAI_API_KEY` is missing
- Consistent error handling with `ErrorResponse` model and HTTP status codes (404, 422, 503, 500)
- Route ordering preserves FastAPI path resolution (static paths before parameterised)

## Verified
```
cd /Users/nic/fable/python-backend && python3 -c \
  "from app.utils.client_agent import ClientAgent; print('OK')"
# OK
```
