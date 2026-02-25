"""Agent CRUD API endpoints with Firestore persistence."""

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies.auth import get_current_user, require_ceo
from app.models.base import ErrorResponse
from app.models.agent import (
    COLLECTION_NAME,
    AgentCreate,
    AgentModel,
    AgentResponse,
    AgentStatus,
    AgentTier,
    AgentUpdate,
)
from app.models.client import COLLECTION_NAME as CLIENTS_COLLECTION
from app.models.user import CurrentUser
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)

router = APIRouter()


def _resolve_client_name(db, client_id: str | None) -> str | None:
    """Look up a client's name by ID. Returns None if not found or no client_id."""
    if not client_id:
        return None
    try:
        doc = db.collection(CLIENTS_COLLECTION).document(client_id).get()
        if doc.exists:
            return doc.to_dict().get("name")
    except Exception:
        logger.warning("Failed to resolve client name for %s", client_id)
    return None


@router.get("/", response_model=dict)
async def list_agents(
    tier: AgentTier | None = None,
    client_id: str | None = None,
    status: AgentStatus | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    """List agents with optional filtering by tier, client_id, status."""
    try:
        db = get_firestore_client()
        query = db.collection(COLLECTION_NAME)

        if tier is not None:
            query = query.where("tier", "==", tier.value)
        if client_id is not None:
            query = query.where("client_id", "==", client_id)
        if status is not None:
            query = query.where("status", "==", status.value)

        query = query.order_by("created_at", direction="DESCENDING").limit(limit)

        agents = []
        for doc in query.stream():
            doc_dict = doc.to_dict()
            doc_dict["id"] = doc.id
            if "client_name" not in doc_dict:
                doc_dict["client_name"] = _resolve_client_name(db, doc_dict.get("client_id"))
            agents.append(AgentResponse(**doc_dict).model_dump(mode="json"))

        return {"success": True, "data": agents}
    except Exception as e:
        logger.exception("Failed to list agents")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to list agents", detail=str(e)).model_dump(),
        )


@router.post("/", response_model=dict)
async def create_agent(
    body: AgentCreate,
    user: CurrentUser = Depends(require_ceo),
):
    """Create a new agent (CEO only).

    Tier 2 (client_based) agents require a client_id.
    """
    # Validate: Tier 2 requires client_id
    if body.tier == AgentTier.CLIENT_BASED and not body.client_id:
        raise HTTPException(
            status_code=422,
            detail="client_id is required for client_based (Tier 2) agents",
        )

    try:
        db = get_firestore_client()
        now = datetime.utcnow()
        agent_id = str(uuid.uuid4())

        # Resolve client name if client_id provided
        client_name = _resolve_client_name(db, body.client_id)

        doc_dict = body.model_dump()
        doc_dict["status"] = AgentStatus.ACTIVE.value
        doc_dict["client_name"] = client_name
        doc_dict["conversation_count"] = 0
        doc_dict["created_at"] = now
        doc_dict["updated_at"] = now
        doc_dict["created_by"] = user.uid

        db.collection(COLLECTION_NAME).document(agent_id).set(doc_dict)

        return {
            "success": True,
            "data": AgentResponse(id=agent_id, **doc_dict).model_dump(mode="json"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create agent")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to create agent", detail=str(e)).model_dump(),
        )


@router.get("/{agent_id}", response_model=dict)
async def get_agent(
    agent_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a single agent by ID."""
    try:
        db = get_firestore_client()
        doc = db.collection(COLLECTION_NAME).document(agent_id).get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Agent not found")

        doc_dict = doc.to_dict()
        doc_dict["id"] = doc.id
        if "client_name" not in doc_dict:
            doc_dict["client_name"] = _resolve_client_name(db, doc_dict.get("client_id"))

        return {
            "success": True,
            "data": AgentResponse(**doc_dict).model_dump(mode="json"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get agent %s", agent_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to get agent", detail=str(e)).model_dump(),
        )


@router.put("/{agent_id}", response_model=dict)
async def update_agent(
    agent_id: str,
    body: AgentUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    """Update an existing agent. Only provided fields are updated."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(agent_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Agent not found")

        update_dict = body.model_dump(exclude_none=True)

        # If tier is changing to client_based, ensure client_id is present
        current_data = doc.to_dict()
        new_tier = update_dict.get("tier", current_data.get("tier"))
        new_client_id = update_dict.get("client_id", current_data.get("client_id"))
        if new_tier == AgentTier.CLIENT_BASED.value and not new_client_id:
            raise HTTPException(
                status_code=422,
                detail="client_id is required for client_based (Tier 2) agents",
            )

        # Re-resolve client name if client_id changed
        if "client_id" in update_dict:
            update_dict["client_name"] = _resolve_client_name(db, update_dict["client_id"])

        update_dict["updated_at"] = datetime.utcnow()
        doc_ref.update(update_dict)

        # Fetch updated document to return full response
        updated_doc = doc_ref.get()
        updated_dict = updated_doc.to_dict()
        updated_dict["id"] = updated_doc.id

        return {
            "success": True,
            "data": AgentResponse(**updated_dict).model_dump(mode="json"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update agent %s", agent_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to update agent", detail=str(e)).model_dump(),
        )


@router.delete("/{agent_id}", response_model=dict)
async def delete_agent(
    agent_id: str,
    user: CurrentUser = Depends(require_ceo),
):
    """Delete an agent (CEO only). Sets status to ARCHIVED."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(agent_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Agent not found")

        doc_ref.update({
            "status": AgentStatus.ARCHIVED.value,
            "updated_at": datetime.utcnow(),
        })

        return {"success": True, "message": "Agent archived"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete agent %s", agent_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to delete agent", detail=str(e)).model_dump(),
        )


@router.post("/{agent_id}/activate", response_model=dict)
async def activate_agent(
    agent_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Set agent status to ACTIVE."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(agent_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Agent not found")

        doc_ref.update({
            "status": AgentStatus.ACTIVE.value,
            "updated_at": datetime.utcnow(),
        })

        updated_doc = doc_ref.get()
        updated_dict = updated_doc.to_dict()
        updated_dict["id"] = updated_doc.id

        return {
            "success": True,
            "data": AgentResponse(**updated_dict).model_dump(mode="json"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to activate agent %s", agent_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to activate agent", detail=str(e)).model_dump(),
        )


@router.post("/{agent_id}/pause", response_model=dict)
async def pause_agent(
    agent_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Set agent status to PAUSED."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(agent_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Agent not found")

        doc_ref.update({
            "status": AgentStatus.PAUSED.value,
            "updated_at": datetime.utcnow(),
        })

        updated_doc = doc_ref.get()
        updated_dict = updated_doc.to_dict()
        updated_dict["id"] = updated_doc.id

        return {
            "success": True,
            "data": AgentResponse(**updated_dict).model_dump(mode="json"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to pause agent %s", agent_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to pause agent", detail=str(e)).model_dump(),
        )
