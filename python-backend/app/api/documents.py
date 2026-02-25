"""Document upload, processing, and retrieval API endpoints."""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile

from app.dependencies.auth import get_current_user, require_ceo
from app.models.base import ErrorResponse
from app.models.document import (
    CHUNKS_COLLECTION,
    COLLECTION_NAME,
    DocumentChunk,
    DocumentResponse,
    DocumentStatus,
)
from app.models.user import CurrentUser
from app.utils.document_processor import DocumentProcessor
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=dict)
async def upload_document(
    file: UploadFile,
    agent_id: str | None = None,
    client_id: str | None = None,
    user: CurrentUser = Depends(get_current_user),
):
    """Upload a file, extract text, chunk it, and store in Firestore.

    Processing is performed synchronously before returning.
    """
    try:
        db = get_firestore_client()
        file_content = await file.read()
        now = datetime.utcnow()

        # Create the document record
        doc_dict = {
            "filename": file.filename,
            "file_type": file.content_type,
            "file_size": len(file_content),
            "status": DocumentStatus.PROCESSING.value,
            "agent_id": agent_id,
            "client_id": client_id,
            "chunk_count": 0,
            "error_message": None,
            "uploaded_at": now,
            "uploaded_by": user.uid,
        }

        _, doc_ref = db.collection(COLLECTION_NAME).add(doc_dict)
        doc_id = doc_ref.id

        # Process synchronously
        result = await DocumentProcessor.process_document(
            doc_id, file_content, file.filename or "unknown.txt"
        )

        # Fetch the updated document
        updated = doc_ref.get().to_dict()
        updated["id"] = doc_id

        return {
            "success": True,
            "data": DocumentResponse(**updated).model_dump(mode="json"),
            "processing": result,
        }
    except Exception as e:
        logger.exception("Failed to upload document")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to upload document", detail=str(e)).model_dump(),
        )


@router.get("/", response_model=dict)
async def list_documents(
    agent_id: str | None = None,
    client_id: str | None = None,
    status: DocumentStatus | None = None,
    limit: int = Query(default=50, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    """List documents with optional filtering by agent, client, or status."""
    try:
        db = get_firestore_client()
        query = db.collection(COLLECTION_NAME)

        if agent_id is not None:
            query = query.where("agent_id", "==", agent_id)
        if client_id is not None:
            query = query.where("client_id", "==", client_id)
        if status is not None:
            query = query.where("status", "==", status.value)

        query = query.order_by("uploaded_at", direction="DESCENDING").limit(limit)

        documents = []
        for doc in query.stream():
            doc_dict = doc.to_dict()
            doc_dict["id"] = doc.id
            documents.append(DocumentResponse(**doc_dict).model_dump(mode="json"))

        return {"success": True, "data": documents}
    except Exception as e:
        logger.exception("Failed to list documents")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to list documents", detail=str(e)).model_dump(),
        )


@router.get("/{document_id}", response_model=dict)
async def get_document(
    document_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a single document by ID."""
    try:
        db = get_firestore_client()
        doc = db.collection(COLLECTION_NAME).document(document_id).get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Document not found")

        doc_dict = doc.to_dict()
        doc_dict["id"] = doc.id
        return {
            "success": True,
            "data": DocumentResponse(**doc_dict).model_dump(mode="json"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get document %s", document_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to get document", detail=str(e)).model_dump(),
        )


@router.get("/{document_id}/chunks", response_model=dict)
async def get_document_chunks(
    document_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get all text chunks for a document, ordered by chunk_index."""
    try:
        db = get_firestore_client()

        # Verify document exists
        doc = db.collection(COLLECTION_NAME).document(document_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Document not found")

        # Fetch chunks
        chunks_query = (
            db.collection(CHUNKS_COLLECTION)
            .where("document_id", "==", document_id)
            .order_by("chunk_index")
        )

        chunks = []
        for chunk_doc in chunks_query.stream():
            chunk_dict = chunk_doc.to_dict()
            chunk_dict["id"] = chunk_doc.id
            chunks.append(DocumentChunk(**chunk_dict).model_dump(mode="json"))

        return {"success": True, "data": chunks}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get chunks for document %s", document_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to get document chunks", detail=str(e)).model_dump(),
        )


@router.delete("/{document_id}", response_model=dict)
async def delete_document(
    document_id: str,
    user: CurrentUser = Depends(require_ceo),
):
    """Delete a document and all its chunks. CEO only."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(document_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Document not found")

        # Delete all associated chunks
        chunks_query = db.collection(CHUNKS_COLLECTION).where("document_id", "==", document_id)
        batch = db.batch()
        for chunk_doc in chunks_query.stream():
            batch.delete(chunk_doc.reference)
        batch.commit()

        # Delete the document itself
        doc_ref.delete()

        return {"success": True, "message": "Document and chunks deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete document %s", document_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="Failed to delete document", detail=str(e)).model_dump(),
        )
