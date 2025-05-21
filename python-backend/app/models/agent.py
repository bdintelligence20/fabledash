from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from .base import BaseResponse

class Agent(BaseModel):
    """Agent model."""
    id: int
    name: str
    description: Optional[str] = None
    client_id: Optional[int] = None
    is_parent: bool = False
    parent_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class AgentCreate(BaseModel):
    """Model for creating a new agent."""
    name: str
    description: Optional[str] = None
    client_id: Optional[int] = None
    is_parent: bool = False
    parent_id: Optional[int] = None

class AgentUpdate(BaseModel):
    """Model for updating an agent."""
    name: Optional[str] = None
    description: Optional[str] = None
    client_id: Optional[int] = None
    is_parent: Optional[bool] = None
    parent_id: Optional[int] = None

class AgentResponse(BaseResponse):
    """Response model for a single agent."""
    agent: Agent

class AgentsResponse(BaseResponse):
    """Response model for multiple agents."""
    agents: List[Agent]
