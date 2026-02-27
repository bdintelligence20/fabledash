"""Agent models for Firestore agent documents."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel

COLLECTION_NAME = "agents"


class AgentTier(str, Enum):
    """Agent tier classification."""

    OPS_TRAFFIC = "ops_traffic"
    CLIENT_BASED = "client_based"


class AgentStatus(str, Enum):
    """Agent lifecycle status."""

    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class AgentModel(str, Enum):
    """Supported LLM models for agents."""

    GPT4O = "gpt-4o"
    GPT4O_MINI = "gpt-4o-mini"
    CLAUDE_SONNET = "claude-sonnet-4-6"
    CLAUDE_HAIKU = "claude-haiku-4-5"


class AgentDataSource(str, Enum):
    """Available data sources for agent context."""

    FIRESTORE = "firestore"
    CALENDAR = "calendar"
    GMAIL = "gmail"
    DRIVE = "drive"


class AgentCreate(BaseModel):
    """Request body for creating a new agent."""

    name: str
    description: str | None = None
    tier: AgentTier
    client_id: str | None = None
    parent_agent_id: str | None = None
    model: AgentModel = AgentModel.GPT4O_MINI
    system_prompt: str | None = None
    capabilities: list[str] = []
    document_ids: list[str] = []
    data_sources: list[AgentDataSource] = [AgentDataSource.FIRESTORE]


class AgentUpdate(BaseModel):
    """Request body for updating an agent. All fields optional for partial updates."""

    name: str | None = None
    description: str | None = None
    tier: AgentTier | None = None
    client_id: str | None = None
    parent_agent_id: str | None = None
    model: AgentModel | None = None
    system_prompt: str | None = None
    capabilities: list[str] | None = None
    document_ids: list[str] | None = None
    data_sources: list[AgentDataSource] | None = None


class AgentResponse(BaseModel):
    """Full agent document representation returned from API."""

    id: str
    name: str
    description: str | None = None
    tier: AgentTier
    status: AgentStatus
    client_id: str | None = None
    client_name: str | None = None
    parent_agent_id: str | None = None
    model: AgentModel
    system_prompt: str | None = None
    capabilities: list[str] = []
    document_ids: list[str] = []
    data_sources: list[AgentDataSource] = [AgentDataSource.FIRESTORE]
    conversation_count: int = 0
    created_at: datetime
    updated_at: datetime
    created_by: str
