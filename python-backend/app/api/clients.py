"""Client CRUD API endpoints with Firestore persistence."""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies.auth import get_current_user
from app.models.base import BaseResponse, ErrorResponse
from app.models.client import (
    COLLECTION_NAME,
    ClientCreate,
    ClientResponse,
    ClientUpdate,
    PartnerGroup,
)
from app.models.user import CurrentUser
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=dict)
async def create_client(
    body: ClientCreate,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a new client document in Firestore."""
    try:
        db = get_firestore_client()
        now = datetime.utcnow()

        doc_dict = body.model_dump()
        doc_dict["created_at"] = now
        doc_dict["updated_at"] = now
        doc_dict["created_by"] = user.uid

        # Firestore generates the document ID
        _, doc_ref = db.collection(COLLECTION_NAME).add(doc_dict)

        return {
            "success": True,
            "data": ClientResponse(id=doc_ref.id, **doc_dict).model_dump(mode="json"),
        }
    except Exception as e:
        logger.exception("Failed to create client")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to create client", detail=str(e)).model_dump(),
        )


@router.get("/", response_model=dict)
async def list_clients(
    partner_group: PartnerGroup | None = None,
    is_active: bool | None = True,
    user: CurrentUser = Depends(get_current_user),
):
    """List clients with optional partner_group and is_active filtering.

    Defaults to active clients only. Pass is_active=null to get all.
    """
    try:
        db = get_firestore_client()
        query = db.collection(COLLECTION_NAME)

        if partner_group is not None:
            query = query.where("partner_group", "==", partner_group.value)

        if is_active is not None:
            query = query.where("is_active", "==", is_active)

        # Sort in Python to avoid Firestore composite index requirements
        docs = list(query.stream())
        docs.sort(key=lambda d: d.to_dict().get("created_at", ""), reverse=True)

        clients = []
        for doc in docs:
            doc_dict = doc.to_dict()
            doc_dict["id"] = doc.id
            clients.append(ClientResponse(**doc_dict).model_dump(mode="json"))

        return {"success": True, "data": clients}
    except Exception as e:
        logger.exception("Failed to list clients")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to list clients", detail=str(e)).model_dump(),
        )


@router.get("/{client_id}", response_model=dict)
async def get_client(
    client_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a single client by ID."""
    try:
        db = get_firestore_client()
        doc = db.collection(COLLECTION_NAME).document(client_id).get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Client not found")

        doc_dict = doc.to_dict()
        doc_dict["id"] = doc.id
        return {
            "success": True,
            "data": ClientResponse(**doc_dict).model_dump(mode="json"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get client %s", client_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to get client", detail=str(e)).model_dump(),
        )


@router.put("/{client_id}", response_model=dict)
async def update_client(
    client_id: str,
    body: ClientUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    """Update an existing client. Only provided fields are updated."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(client_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Client not found")

        update_dict = body.model_dump(exclude_none=True)
        update_dict["updated_at"] = datetime.utcnow()

        doc_ref.update(update_dict)

        # Fetch updated document to return full response
        updated_doc = doc_ref.get()
        updated_dict = updated_doc.to_dict()
        updated_dict["id"] = updated_doc.id

        return {
            "success": True,
            "data": ClientResponse(**updated_dict).model_dump(mode="json"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update client %s", client_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to update client", detail=str(e)).model_dump(),
        )


@router.delete("/{client_id}", response_model=dict)
async def delete_client(
    client_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Soft-delete a client by setting is_active=False.

    Clients are referenced by tasks and time logs, so hard delete
    would orphan those references.
    """
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(client_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Client not found")

        doc_ref.update({
            "is_active": False,
            "updated_at": datetime.utcnow(),
        })

        return {"success": True, "message": "Client deactivated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete client %s", client_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to delete client", detail=str(e)).model_dump(),
        )
