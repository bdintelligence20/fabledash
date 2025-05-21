from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from .base import BaseResponse

class Client(BaseModel):
    """Client model."""
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class ClientCreate(BaseModel):
    """Model for creating a new client."""
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    notes: Optional[str] = None

class ClientUpdate(BaseModel):
    """Model for updating a client."""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    notes: Optional[str] = None

class ClientResponse(BaseResponse):
    """Response model for a single client."""
    client: Client

class ClientsResponse(BaseResponse):
    """Response model for multiple clients."""
    clients: List[Client]
