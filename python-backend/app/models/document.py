"""Document models for Firestore document management and chunking."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel

COLLECTION_NAME = "documents"
CHUNKS_COLLECTION = "document_chunks"


class DocumentStatus(str, Enum):
    """Processing status for uploaded documents."""

    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


class DocumentResponse(BaseModel):
    """Full document representation returned from API."""

    id: str
    filename: str
    file_type: str | None = None
    file_size: int = 0
    status: DocumentStatus = DocumentStatus.PROCESSING
    agent_id: str | None = None
    client_id: str | None = None
    chunk_count: int = 0
    error_message: str | None = None
    uploaded_at: datetime
    uploaded_by: str


class DocumentChunk(BaseModel):
    """A single chunk of extracted document text stored in Firestore."""

    id: str
    document_id: str
    content: str
    chunk_index: int
    metadata: dict = {}
