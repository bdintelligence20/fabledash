# 10-01 Summary: OpsAI Engine and Conversational API

## Completed

### Task 1: OpsAI Engine and Conversational API

**python-backend/app/utils/opsai_engine.py** (new, ~430 lines):

`OpsAIEngine` class with OpenAI function-calling orchestration:

- **`__init__`**: Initialises AsyncOpenAI client (graceful fallback when key missing) and Firestore client via existing `get_firestore_client()`
- **`openai_configured`** property: Boolean check for OpenAI availability
- **7 function-calling tools** defined as OpenAI tool schemas:
  - `get_utilization(date_from, date_to)` — queries time_logs for billable/total hours, utilization %, top clients by minutes
  - `get_revenue(period)` — queries financial_snapshots + invoices for revenue, paid, outstanding totals
  - `get_client_info(client_name)` — case-insensitive client lookup with linked tasks and recent logged hours
  - `get_recent_meetings(days)` — meetings from last N days with summaries, action items, key topics
  - `get_overdue_tasks()` — all tasks past due date and not done, with priority/assignment info
  - `get_cash_position()` — latest snapshot cash-on-hand, AR, AP, revenue, expenses
  - `get_top_clients(metric, limit)` — ranked by revenue (from invoices) or hours (from time logs)
- **`query_data(question)`**: Sends question to OpenAI with tool schemas, dispatches selected tool calls against Firestore, returns structured results
- **`generate_answer(question, data)`**: Formats queried data into a natural-language CEO-friendly answer with ZAR currency formatting
- **`ask(question)`**: Full pipeline orchestrator returning `{answer, data_sources, query_tools_used}`
- **`get_opsai_engine()`**: Module-level singleton accessor

**python-backend/app/api/opsai.py** (new, ~147 lines):

- `POST /opsai/ask` — Body: `{question: str}`. Returns `{success, data: {answer, sources, tools_used}}`
- `GET /opsai/suggested-questions` — 10 curated example questions
- `GET /opsai/status` — `{openai_configured, data_sources, available_tools}`
- All endpoints require authentication via `Depends(get_current_user)`

**python-backend/app/main.py** (modified):

- Added `from app.api.opsai import router as opsai_router`
- `app.include_router(opsai_router, prefix="/opsai", tags=["opsai"])`

## Verification

```
python3 -c "from app.main import app; routes = [r.path for r in app.routes]; print([r for r in routes if 'opsai' in r])"
# Output: ['/opsai/ask', '/opsai/suggested-questions', '/opsai/status']
```

## Files Changed

| File | Action |
|------|--------|
| python-backend/app/utils/opsai_engine.py | Created (~430 lines) |
| python-backend/app/api/opsai.py | Created (~147 lines) |
| python-backend/app/main.py | Modified (added opsai router include) |

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| /opsai/ask | POST | Required | Ask OpsAI a natural-language question |
| /opsai/suggested-questions | GET | Required | Get example questions |
| /opsai/status | GET | Required | System status and available tools |

## Architecture Notes

- Uses OpenAI `gpt-4o-mini` for both tool selection and answer generation (cost-efficient)
- Function calling with `tool_choice="auto"` allows multi-tool queries for cross-domain questions
- All tool implementations query Firestore directly via existing collection constants
- Graceful degradation: returns 503 when OpenAI key not configured
- Follows existing codebase patterns: `get_firestore_client()`, `ErrorResponse`, `CurrentUser` dependency
