---
phase: 09-ai-agent-ecosystem
plan: 03
status: complete
completed: 2026-02-25
---

# 09-03 Summary: Vector Store and RAG Engine

## What was done

### 1. Vector store (`python-backend/app/utils/vector_store.py`)
- **EMBEDDINGS_COLLECTION** = `"embeddings"`, **EMBEDDING_MODEL** = `"text-embedding-3-small"`
- **VectorStore** class with `AsyncOpenAI` client initialised from `get_settings().OPENAI_API_KEY`
- `generate_embedding(text)` — calls OpenAI embeddings API, returns `list[float]`
- `store_embedding(chunk_id, document_id, embedding, content, metadata)` — persists embedding + content in Firestore `embeddings` collection
- `search(query, agent_id, client_id, top_k)` — generates query embedding, fetches stored embeddings scoped by agent/client, computes brute-force cosine similarity, returns top_k results sorted by score
- `_cosine_similarity(a, b)` — numpy dot-product / norms, handles zero vectors
- `index_document_chunks(document_id, chunks)` — batch generates and stores embeddings for a list of chunk dicts
- `get_vector_store()` module-level singleton accessor

### 2. RAG engine (`python-backend/app/utils/rag_engine.py`)
- **RAGEngine** class accepting optional `VectorStore` and `AsyncOpenAI` client (defaults to singletons/config)
- `retrieve_context(query, agent_id, client_id, top_k)` — searches vector store, joins top chunk contents into a context string
- `generate_response(query, context, system_prompt, model)` — builds system + user messages with context, calls OpenAI chat completions (`gpt-4o-mini` default)
- `query(query, agent_id, client_id, system_prompt, model)` — end-to-end orchestrator: retrieve context, generate response, return `{"answer": str, "sources": [...]}`
- `get_rag_engine()` module-level singleton accessor

## Patterns followed
- Matches existing `firebase_client.py` and `openai_client.py` module conventions
- Uses `get_settings()` for configuration, `get_firestore_client()` for DB access
- Graceful degradation when `OPENAI_API_KEY` is missing (warning log, `RuntimeError` on actual use)
- numpy and openai already in `requirements.txt`

## Verified
```
cd /Users/nic/fable/python-backend && python3 -c \
  "from app.utils.vector_store import VectorStore; from app.utils.rag_engine import RAGEngine; print('OK')"
# OK
```
