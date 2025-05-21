from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from .base import BaseResponse

class Document(BaseModel):
    """Document model."""
    id: int
    agent_id: int
    filename: str
    file_type: str
    file_size: int
    content_type: str
    created_at: datetime
    updated_at: Optional[datetime] = None

class DocumentCreate(BaseModel):
    """Model for creating a new document."""
    agent_id: int
    filename: str
    file_type: str
    file_size: int
    content_type: str

class DocumentResponse(BaseResponse):
    """Response model for a single document."""
    document: Document

class DocumentsResponse(BaseResponse):
    """Response model for multiple documents."""
    documents: List[Document]

class DocumentChunk(BaseModel):
    """Document chunk model for vector search."""
    id: int
    document_id: int
    content: str
    embedding: Optional[List[float]] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

class DocumentChunkCreate(BaseModel):
    """Model for creating a new document chunk."""
    document_id: int
    content: str
    embedding: Optional[List[float]] = None
    metadata: Optional[Dict[str, Any]] = None

class RelevantChunk(BaseModel):
    """Model for a relevant document chunk with similarity score."""
    chunk: DocumentChunk
    similarity: float
    document: Optional[Document] = None

class RelevantChunksResponse(BaseResponse):
    """Response model for relevant document chunks."""
    chunks: List[RelevantChunk]
