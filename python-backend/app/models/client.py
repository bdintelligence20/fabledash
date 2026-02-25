"""Client models for Firestore client documents."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel

COLLECTION_NAME = "clients"


class PartnerGroup(str, Enum):
    """Partner group classification for clients."""

    COLLAB = "collab"
    EDCP = "edcp"
    DIRECT_CLIENTS = "direct_clients"
    SEPARATE_BUSINESSES = "separate_businesses"


class ClientBase(BaseModel):
    """Shared fields for client create/update operations."""

    name: str
    partner_group: PartnerGroup
    contact_email: str | None = None
    contact_phone: str | None = None
    description: str | None = None
    is_active: bool = True


class ClientCreate(ClientBase):
    """Request body for creating a new client."""

    pass


class ClientUpdate(BaseModel):
    """Request body for updating a client. All fields optional for partial updates."""

    name: str | None = None
    partner_group: PartnerGroup | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    description: str | None = None
    is_active: bool | None = None


class ClientResponse(ClientBase):
    """Full client document representation returned from API."""

    id: str
    created_at: datetime
    updated_at: datetime
    created_by: str
