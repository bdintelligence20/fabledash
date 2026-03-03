"""Chat conversation and messaging API endpoints with Firestore persistence.

Provides conversation CRUD and message send/receive with optional RAG-augmented
AI responses.  The RAG engine (09-03) may not be available yet; when it is
missing the endpoint falls back to a plain Gemini text generation.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

import google.generativeai as genai

from app.config import get_settings
from app.dependencies.auth import get_current_user
from app.models.agent import COLLECTION_NAME as AGENTS_COLLECTION
from app.models.base import ErrorResponse
from app.models.chat import (
    COLLECTION_NAME,
    MESSAGES_COLLECTION,
    ChatMessage,
    ConversationCreate,
    ConversationResponse,
    MessageRole,
    SendMessageBody,
)
from app.models.user import CurrentUser
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Lazy RAG import — 09-03 may not be deployed yet
# ---------------------------------------------------------------------------

_rag_engine = None
_rag_checked = False


def _get_rag_engine():
    """Lazily import and return the RAG engine, or None if unavailable."""
    global _rag_engine, _rag_checked
    if _rag_checked:
        return _rag_engine
    try:
        from app.utils.rag_engine import get_rag_engine

        _rag_engine = get_rag_engine()
        logger.info("RAG engine loaded successfully")
    except Exception:
        logger.warning("RAG engine not available — falling back to direct Gemini")
        _rag_engine = None
    _rag_checked = True
    return _rag_engine


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_agent_name(db, agent_id: str) -> str | None:
    """Look up an agent's name by ID.  Returns None if not found."""
    if not agent_id:
        return None
    try:
        doc = db.collection(AGENTS_COLLECTION).document(agent_id).get()
        if doc.exists:
            return doc.to_dict().get("name")
    except Exception:
        logger.warning("Failed to resolve agent name for %s", agent_id)
    return None


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


def _get_gemini_model(system_prompt: str | None = None) -> genai.GenerativeModel:
    """Return a Gemini GenerativeModel using the configured API key."""
    settings = get_settings()
    api_key = settings.GEMINI_API_KEY or settings.GOOGLE_AI_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API key is not configured")
    genai.configure(api_key=api_key)
    if system_prompt:
        return genai.GenerativeModel("gemini-2.5-flash", system_instruction=system_prompt)
    return genai.GenerativeModel("gemini-2.5-flash")


# ===================================================================
# Conversation CRUD
# ===================================================================


@router.get("/", response_model=dict)
async def list_conversations(
    agent_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    """List conversations for the current user with optional agent_id filter."""
    try:
        db = get_firestore_client()
        query = db.collection(COLLECTION_NAME).where("created_by", "==", user.uid)

        if agent_id is not None:
            query = query.where("agent_id", "==", agent_id)

        # Sort in Python to avoid Firestore composite index requirements
        docs = list(query.stream())
        docs.sort(key=lambda d: d.to_dict().get("created_at", ""), reverse=True)
        docs = docs[:limit]

        conversations = []
        for doc in docs:
            doc_dict = doc.to_dict()
            doc_dict["id"] = doc.id
            if "agent_name" not in doc_dict:
                doc_dict["agent_name"] = _resolve_agent_name(db, doc_dict.get("agent_id"))
            conversations.append(ConversationResponse(**doc_dict).model_dump(mode="json"))

        return {"success": True, "data": conversations}
    except Exception as e:
        logger.exception("Failed to list conversations")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to list conversations", detail=str(e)).model_dump(),
        )


@router.post("/", response_model=dict)
async def create_conversation(
    body: ConversationCreate,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a new conversation linked to an agent."""
    try:
        db = get_firestore_client()

        # Verify agent exists
        agent_doc = db.collection(AGENTS_COLLECTION).document(body.agent_id).get()
        if not agent_doc.exists:
            raise HTTPException(status_code=404, detail="Agent not found")

        agent_data = agent_doc.to_dict()
        agent_name = agent_data.get("name")

        now = _now_iso()
        conv_id = str(uuid.uuid4())

        doc_dict = {
            "agent_id": body.agent_id,
            "agent_name": agent_name,
            "title": body.title or f"Chat with {agent_name or 'Agent'}",
            "message_count": 0,
            "last_message_at": None,
            "created_at": now,
            "created_by": user.uid,
        }

        db.collection(COLLECTION_NAME).document(conv_id).set(doc_dict)

        # Increment conversation_count on the agent
        try:
            agent_ref = db.collection(AGENTS_COLLECTION).document(body.agent_id)
            existing = agent_ref.get().to_dict() or {}
            agent_ref.update({
                "conversation_count": (existing.get("conversation_count", 0) + 1),
            })
        except Exception:
            logger.warning("Failed to increment conversation_count on agent %s", body.agent_id)

        return {
            "success": True,
            "data": ConversationResponse(id=conv_id, **doc_dict).model_dump(mode="json"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create conversation")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to create conversation", detail=str(e)).model_dump(),
        )


@router.get("/{conversation_id}", response_model=dict)
async def get_conversation(
    conversation_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a single conversation by ID."""
    try:
        db = get_firestore_client()
        doc = db.collection(COLLECTION_NAME).document(conversation_id).get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Conversation not found")

        doc_dict = doc.to_dict()
        doc_dict["id"] = doc.id

        # Ownership check
        if doc_dict.get("created_by") != user.uid:
            raise HTTPException(status_code=403, detail="Not authorized to view this conversation")

        if "agent_name" not in doc_dict:
            doc_dict["agent_name"] = _resolve_agent_name(db, doc_dict.get("agent_id"))

        return {
            "success": True,
            "data": ConversationResponse(**doc_dict).model_dump(mode="json"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get conversation %s", conversation_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to get conversation", detail=str(e)).model_dump(),
        )


@router.delete("/{conversation_id}", response_model=dict)
async def delete_conversation(
    conversation_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Delete a conversation and all its messages."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(conversation_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Conversation not found")

        doc_dict = doc.to_dict()
        if doc_dict.get("created_by") != user.uid:
            raise HTTPException(status_code=403, detail="Not authorized to delete this conversation")

        # Delete all messages in this conversation
        msgs_query = (
            db.collection(MESSAGES_COLLECTION)
            .where("conversation_id", "==", conversation_id)
        )
        for msg_doc in msgs_query.stream():
            msg_doc.reference.delete()

        # Delete the conversation itself
        doc_ref.delete()

        return {"success": True, "message": "Conversation deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete conversation %s", conversation_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to delete conversation", detail=str(e)).model_dump(),
        )


# ===================================================================
# Messages
# ===================================================================


@router.get("/{conversation_id}/messages", response_model=dict)
async def list_messages(
    conversation_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    user: CurrentUser = Depends(get_current_user),
):
    """List messages for a conversation, ordered by created_at ascending."""
    try:
        db = get_firestore_client()

        # Verify conversation exists and belongs to user
        conv_doc = db.collection(COLLECTION_NAME).document(conversation_id).get()
        if not conv_doc.exists:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if conv_doc.to_dict().get("created_by") != user.uid:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Sort in Python to avoid Firestore composite index requirements
        query = (
            db.collection(MESSAGES_COLLECTION)
            .where("conversation_id", "==", conversation_id)
        )

        docs = list(query.stream())
        docs.sort(key=lambda d: d.to_dict().get("created_at", ""))
        docs = docs[:limit]

        messages = []
        for doc in docs:
            doc_dict = doc.to_dict()
            doc_dict["id"] = doc.id
            messages.append(ChatMessage(**doc_dict).model_dump(mode="json"))

        return {"success": True, "data": messages}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list messages for conversation %s", conversation_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to list messages", detail=str(e)).model_dump(),
        )


@router.post("/{conversation_id}/messages", response_model=dict)
async def send_message(
    conversation_id: str,
    body: SendMessageBody,
    user: CurrentUser = Depends(get_current_user),
):
    """Send a user message and receive an AI assistant response.

    Pipeline:
    1. Save user message to Firestore.
    2. Fetch agent config (model, system_prompt, document_ids).
    3. Fetch conversation history (last 20 messages).
    4. Attempt to use RAGEngine for response generation.
    5. If RAG unavailable, fall back to direct Gemini generation.
    6. Save assistant message to Firestore.
    7. Update conversation metadata (message_count, last_message_at).
    8. Return both user and assistant messages.
    """
    try:
        db = get_firestore_client()

        # --- Verify conversation ownership ---
        conv_ref = db.collection(COLLECTION_NAME).document(conversation_id)
        conv_doc = conv_ref.get()
        if not conv_doc.exists:
            raise HTTPException(status_code=404, detail="Conversation not found")

        conv_data = conv_doc.to_dict()
        if conv_data.get("created_by") != user.uid:
            raise HTTPException(status_code=403, detail="Not authorized")

        agent_id = conv_data.get("agent_id")

        # --- 1. Save user message ---
        now = _now_iso()
        user_msg_id = str(uuid.uuid4())
        user_msg_dict = {
            "conversation_id": conversation_id,
            "role": MessageRole.USER.value,
            "content": body.content,
            "sources": [],
            "created_at": now,
        }
        db.collection(MESSAGES_COLLECTION).document(user_msg_id).set(user_msg_dict)

        # --- 2. Fetch agent config ---
        agent_doc = db.collection(AGENTS_COLLECTION).document(agent_id).get()
        if not agent_doc.exists:
            raise HTTPException(status_code=404, detail="Agent not found")

        agent_data = agent_doc.to_dict()
        agent_data["id"] = agent_id
        base_system_prompt = agent_data.get("system_prompt") or "You are a helpful AI assistant."
        document_ids = agent_data.get("document_ids", [])
        data_sources = agent_data.get("data_sources", [])

        # --- 2b. Load integration context via ClientAgent if data_sources configured ---
        INTEGRATION_SOURCES = {"drive", "gmail", "calendar"}
        has_integration_sources = bool(INTEGRATION_SOURCES & set(data_sources))
        system_prompt = base_system_prompt

        if has_integration_sources and agent_data.get("client_id"):
            try:
                from app.utils.client_agent import ClientAgent
                client_agent = ClientAgent(agent_data)
                context_data = await client_agent.get_client_context()
                context_str = client_agent._build_context_prompt(context_data)
                if context_str:
                    system_prompt = (
                        f"{base_system_prompt}\n\n"
                        "## Live Client Context (fetched now)\n"
                        f"{context_str}"
                    )
                    logger.info(
                        "Loaded integration context for agent %s (sources: %s)",
                        agent_id, data_sources,
                    )
            except Exception:
                logger.warning(
                    "Failed to load integration context for agent %s — using base prompt",
                    agent_id, exc_info=True,
                )

        # --- 3. Fetch conversation history (last 20) ---
        # Sort in Python to avoid Firestore composite index requirements
        history_query = (
            db.collection(MESSAGES_COLLECTION)
            .where("conversation_id", "==", conversation_id)
        )
        history_docs = list(history_query.stream())
        history_docs.sort(key=lambda d: d.to_dict().get("created_at", ""))
        history_docs = history_docs[:20]

        history_messages = []
        for msg_doc in history_docs:
            msg = msg_doc.to_dict()
            history_messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })

        # --- 4 & 5. Generate AI response (RAG or direct Gemini) ---
        assistant_content = ""
        sources: list[dict] = []

        rag = _get_rag_engine()

        if rag is not None and document_ids:
            # --- 4. RAG path ---
            try:
                rag_result = await rag.query(
                    query=body.content,
                    agent_id=agent_id,
                    system_prompt=system_prompt,
                    model="gemini-2.5-flash",
                )
                assistant_content = rag_result.get("answer", "")
                sources = rag_result.get("sources", [])
            except Exception:
                logger.warning("RAG query failed — falling back to direct Gemini", exc_info=True)
                rag = None  # fall through to direct path

        if not assistant_content:
            # --- 5. Direct Gemini fallback ---
            # Build the prompt from conversation history
            history_text_parts = []
            for msg in history_messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                history_text_parts.append(f"**{role}**: {content}")

            full_prompt = "\n\n".join(history_text_parts) if history_text_parts else body.content

            model = _get_gemini_model(system_prompt=system_prompt)
            response = await model.generate_content_async(
                full_prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=4000,
                ),
            )
            assistant_content = response.text or ""

        # --- 6. Save assistant message ---
        asst_now = _now_iso()
        asst_msg_id = str(uuid.uuid4())
        asst_msg_dict = {
            "conversation_id": conversation_id,
            "role": MessageRole.ASSISTANT.value,
            "content": assistant_content,
            "sources": sources,
            "created_at": asst_now,
        }
        db.collection(MESSAGES_COLLECTION).document(asst_msg_id).set(asst_msg_dict)

        # --- 7. Update conversation metadata ---
        current_count = conv_data.get("message_count", 0)
        conv_ref.update({
            "message_count": current_count + 2,  # user + assistant
            "last_message_at": asst_now,
        })

        # --- 8. Return both messages ---
        user_message = ChatMessage(id=user_msg_id, **user_msg_dict).model_dump(mode="json")
        assistant_message = ChatMessage(id=asst_msg_id, **asst_msg_dict).model_dump(mode="json")

        return {
            "success": True,
            "data": {
                "user_message": user_message,
                "assistant_message": assistant_message,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to send message in conversation %s", conversation_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to send message", detail=str(e)).model_dump(),
        )
