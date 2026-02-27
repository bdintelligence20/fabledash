"""Client CRUD API endpoints with Firestore persistence."""

import csv
import io
import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Body, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, ValidationError

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


class ClientBulkItem(BaseModel):
    """Single item in a bulk client import."""

    name: str
    partner_group: PartnerGroup = PartnerGroup.DIRECT_CLIENTS
    contact_email: str | None = None
    contact_phone: str | None = None
    description: str | None = None
    is_active: bool = True


@router.post("/bulk", response_model=dict)
async def bulk_create_clients(
    file: UploadFile | None = File(None),
    clients: str | None = Body(None, description="JSON array of client objects"),
    user: CurrentUser = Depends(get_current_user),
):
    """Bulk create clients from a CSV file or JSON array.

    CSV columns: name, partner_group, contact_email, contact_phone, description
    JSON: array of {name, partner_group?, contact_email?, contact_phone?, description?}
    """
    items: list[ClientBulkItem] = []
    parse_errors: list[dict] = []

    if file and file.filename:
        content = await file.read()
        text = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))
        for i, row in enumerate(reader):
            try:
                items.append(ClientBulkItem(
                    name=row.get("name", "").strip(),
                    partner_group=row.get("partner_group", "direct_clients").strip(),
                    contact_email=row.get("contact_email", "").strip() or None,
                    contact_phone=row.get("contact_phone", "").strip() or None,
                    description=row.get("description", "").strip() or None,
                ))
            except (ValidationError, Exception) as e:
                parse_errors.append({"row": i + 1, "error": str(e)})
    elif clients:
        import json
        try:
            data = json.loads(clients)
            if not isinstance(data, list):
                raise HTTPException(status_code=400, detail="Expected JSON array")
            for i, item in enumerate(data):
                try:
                    items.append(ClientBulkItem(**item))
                except (ValidationError, Exception) as e:
                    parse_errors.append({"index": i, "error": str(e)})
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON")
    else:
        raise HTTPException(status_code=400, detail="Provide a CSV file or JSON array in 'clients' field")

    if not items and not parse_errors:
        raise HTTPException(status_code=400, detail="No items to import")
    if len(items) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 clients per batch")

    db = get_firestore_client()
    now = datetime.utcnow()
    created = []
    errors = list(parse_errors)

    for i, item in enumerate(items):
        try:
            doc_dict = item.model_dump()
            doc_dict["created_at"] = now
            doc_dict["updated_at"] = now
            doc_dict["created_by"] = user.uid
            _, doc_ref = db.collection(COLLECTION_NAME).add(doc_dict)
            created.append({"id": doc_ref.id, "name": item.name})
        except Exception as e:
            errors.append({"index": i, "name": item.name, "error": str(e)})

    return {
        "success": True,
        "data": {
            "total": len(items) + len(parse_errors),
            "created": len(created),
            "failed": len(errors),
            "created_items": created,
            "errors": errors,
        },
    }


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
