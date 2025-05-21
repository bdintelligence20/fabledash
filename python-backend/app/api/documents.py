from fastapi import APIRouter, HTTPException, Depends, Query, Path, UploadFile, File, Form
from typing import List, Optional
import logging
import os
import shutil
from tempfile import NamedTemporaryFile
import uuid

from app.models.document import (
    Document, DocumentCreate, DocumentResponse, DocumentsResponse
)
from app.utils.supabase_client import get_supabase_client
from app.services.document_processor import process_document

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Get Supabase client
supabase = get_supabase_client()

# Create uploads directory if it doesn't exist
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/", response_model=DocumentsResponse)
async def get_documents(
    agent_id: Optional[int] = Query(None, description="Filter documents by agent ID")
):
    """
    Get all documents, optionally filtered by agent ID.
    """
    try:
        query = supabase.table("documents").select("*")
        
        if agent_id is not None:
            query = query.eq("agent_id", agent_id)
        
        result = query.order("created_at", desc=True).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error fetching documents: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching documents: {result.error}")
        
        return {"success": True, "documents": result.data}
    except Exception as e:
        logger.error(f"Error fetching documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: int = Path(..., description="The ID of the document to get")):
    """
    Get a specific document by ID.
    """
    try:
        result = supabase.table("documents").select("*").eq("id", document_id).single().execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Document not found: {result.error}")
            raise HTTPException(status_code=404, detail=f"Document not found: {result.error}")
        
        return {"success": True, "document": result.data}
    except Exception as e:
        logger.error(f"Error fetching document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    agent_id: int = Form(..., description="The ID of the agent to associate the document with")
):
    """
    Upload a document and associate it with an agent.
    """
    try:
        # Check if agent exists
        agent_result = supabase.table("agents").select("*").eq("id", agent_id).single().execute()
        
        if hasattr(agent_result, 'error') and agent_result.error:
            logger.error(f"Agent not found: {agent_result.error}")
            raise HTTPException(status_code=404, detail=f"Agent not found: {agent_result.error}")
        
        # Get file info
        filename = file.filename
        file_size = 0
        file_extension = os.path.splitext(filename)[1].lower().lstrip(".")
        content_type = file.content_type or "application/octet-stream"
        
        # Validate file type
        allowed_extensions = ["pdf", "docx", "txt"]
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Allowed types: {', '.join(allowed_extensions)}"
            )
        
        # Generate unique filename
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save file to disk
        with open(file_path, "wb") as buffer:
            # Read file in chunks to handle large files
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                buffer.write(chunk)
                file_size += len(chunk)
        
        # Create document in database
        document_data = {
            "agent_id": agent_id,
            "filename": filename,
            "file_type": file_extension,
            "file_size": file_size,
            "content_type": content_type
        }
        
        result = supabase.table("documents").insert(document_data).execute()
        
        if hasattr(result, 'error') and result.error:
            # Clean up file if database insert fails
            os.remove(file_path)
            logger.error(f"Error creating document: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error creating document: {result.error}")
        
        document = result.data[0]
        document_id = document["id"]
        
        # Process document asynchronously
        # Note: In a production environment, this should be done in a background task
        await process_document(document_id, file_path, file_extension)
        
        return {"success": True, "document": document}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{document_id}", response_model=DocumentResponse)
async def delete_document(document_id: int = Path(..., description="The ID of the document to delete")):
    """
    Delete a document.
    """
    try:
        # Check if document exists
        document_result = supabase.table("documents").select("*").eq("id", document_id).single().execute()
        
        if hasattr(document_result, 'error') and document_result.error:
            logger.error(f"Document not found: {document_result.error}")
            raise HTTPException(status_code=404, detail=f"Document not found: {document_result.error}")
        
        # Delete document chunks
        chunks_result = supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
        
        if hasattr(chunks_result, 'error') and chunks_result.error:
            logger.error(f"Error deleting document chunks: {chunks_result.error}")
            raise HTTPException(status_code=500, detail=f"Error deleting document chunks: {chunks_result.error}")
        
        # Delete document
        result = supabase.table("documents").delete().eq("id", document_id).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error deleting document: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error deleting document: {result.error}")
        
        return {"success": True, "document": document_result.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {e}")
        raise HTTPException(status_code=500, detail=str(e))
