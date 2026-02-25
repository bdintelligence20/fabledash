# 09-04: Agent Chat System with RAG Integration

## Status: COMPLETE

## What was built

### Models (`app/models/chat.py`)
- **COLLECTION_NAME** = `"conversations"`, **MESSAGES_COLLECTION** = `"messages"` (Firestore)
- **MessageRole** enum: USER, ASSISTANT, SYSTEM
- **ChatMessage**: id, conversation_id, role, content, sources (list[dict]=[]), created_at
- **ConversationCreate**: agent_id (str), title (str|None)
- **SendMessageBody**: content (str)
- **ConversationResponse**: id, agent_id, agent_name, title, message_count, last_message_at, created_at, created_by

### API Endpoints (`app/api/chats.py`)

All endpoints require `Depends(get_current_user)` authentication.

#### Conversation CRUD
| Method | Path | Description |
|--------|------|-------------|
| GET | `/chats/` | List conversations (optional `agent_id`, `limit=50` params). Filtered by `created_by` = current user. |
| POST | `/chats/` | Create conversation (ConversationCreate body). Verifies agent exists, increments agent `conversation_count`. |
| GET | `/chats/{conversation_id}` | Get conversation detail. Ownership check enforced. |
| DELETE | `/chats/{conversation_id}` | Delete conversation + all messages. Ownership check enforced. |

#### Messages
| Method | Path | Description |
|--------|------|-------------|
| GET | `/chats/{conversation_id}/messages` | List messages ordered by `created_at` ascending (limit=100). |
| POST | `/chats/{conversation_id}/messages` | Send message and get AI response. |

### Send Message Pipeline (POST `/{conversation_id}/messages`)
1. Save user message to Firestore `messages` collection
2. Fetch agent config (model, system_prompt, document_ids) from `agents` collection
3. Fetch conversation history (last 20 messages)
4. Try RAGEngine for response (lazy import, graceful fallback)
5. If RAG unavailable or fails, use OpenAI directly with system prompt + history
6. Save assistant message to Firestore
7. Update conversation metadata (message_count, last_message_at)
8. Return `{user_message, assistant_message}`

### RAG Integration Strategy
- Lazy import of `app.services.rag_engine.RAGEngine` with `try/except`
- Global `_rag_engine` singleton with `_rag_checked` flag to avoid repeated import attempts
- Falls back to direct OpenAI chat completion when RAG is unavailable
- Claude model names are mapped to `gpt-4o-mini` for the OpenAI fallback path

### Router Registration (`app/main.py`)
- `chats_router` registered at `/chats` with tag `["chats"]`
- Replaces previous placeholder/commented-out registration

## Files changed
- `app/models/chat.py` — complete rewrite (old Supabase models replaced with Firestore models)
- `app/api/chats.py` — complete rewrite (placeholder replaced with full CRUD + messaging)
- `app/main.py` — uncommented and activated chats_router import and registration

## Dependencies
- **09-01** (agents): Agent model and collection used for config lookup
- **09-03** (RAG engine): Optional, lazy-loaded; graceful degradation if not available
- **OpenAI**: AsyncOpenAI client for direct fallback completions
- **Firebase/Firestore**: All persistence via `get_firestore_client()`

## Verification
```bash
python3 -c "from app.main import app; routes = [r.path for r in app.routes]; print([r for r in routes if 'chat' in r])"
# Output: ['/chats/', '/chats/', '/chats/{conversation_id}', '/chats/{conversation_id}', '/chats/{conversation_id}/messages', '/chats/{conversation_id}/messages']
```
