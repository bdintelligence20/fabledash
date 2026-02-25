---
phase: 09-ai-agent-ecosystem
plan: 01
status: complete
completed: 2026-02-25
---

# 09-01 Summary: Agent Data Model and CRUD Endpoints

## What was done

### 1. Agent data model (`python-backend/app/models/agent.py`)
- Replaced the old placeholder model with a Firestore-native schema
- **COLLECTION_NAME** = `"agents"`
- **AgentTier** enum: `ops_traffic` (Tier 1 — org-wide operations), `client_based` (Tier 2 — per-client)
- **AgentStatus** enum: `active`, `paused`, `archived`
- **AgentModel** enum: `gpt-4o`, `gpt-4o-mini`, `claude-sonnet-4-6`, `claude-haiku-4-5`
- **AgentCreate**: name, description, tier, client_id, parent_agent_id, model (default gpt-4o-mini), system_prompt, capabilities, document_ids
- **AgentUpdate**: all fields optional for partial updates
- **AgentResponse**: full document shape with id, status, client_name resolution, conversation_count, timestamps, created_by

### 2. Agent CRUD endpoints (`python-backend/app/api/agents.py`)
- `GET /agents/` — list with tier, client_id, status, limit filters
- `POST /agents/` — create (CEO only); validates Tier 2 requires client_id
- `GET /agents/{agent_id}` — detail with client_name resolution
- `PUT /agents/{agent_id}` — partial update with tier/client_id cross-validation
- `DELETE /agents/{agent_id}` — soft-delete via ARCHIVED status (CEO only)
- `POST /agents/{agent_id}/activate` — set status to ACTIVE
- `POST /agents/{agent_id}/pause` — set status to PAUSED

### 3. Router registration (`python-backend/app/main.py`)
- Uncommented agents router import and `include_router` call at `/agents` prefix
- Remaining placeholders (chats, documents) left commented for future phases

## Patterns followed
- Matches `clients.py` model/endpoint conventions exactly
- Uses `get_firestore_client()` for all DB access
- Uses `uuid.uuid4()` for document IDs (allows pre-set ID before write)
- `Depends(get_current_user)` on all endpoints; `require_ceo` on create/delete
- Client name resolved via helper `_resolve_client_name()` on read/create/update
- Consistent `{"success": True, "data": ...}` response envelope

## Verified
```
python3 -c "from app.main import app; routes = [r.path for r in app.routes]; print([r for r in routes if 'agent' in r])"
# ['/agents/', '/agents/', '/agents/{agent_id}', '/agents/{agent_id}', '/agents/{agent_id}', '/agents/{agent_id}/activate', '/agents/{agent_id}/pause']
```
