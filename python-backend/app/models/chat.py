"""Chat and conversation models for Firestore persistence."""

from enum import Enum

from pydantic import BaseModel

COLLECTION_NAME = "conversations"
MESSAGES_COLLECTION = "messages"


class MessageRole(str, Enum):
    """Role of the message sender."""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    """A single message within a conversation."""

    id: str
    conversation_id: str
    role: MessageRole
    content: str
    sources: list[dict] = []
    created_at: str


class ConversationCreate(BaseModel):
    """Request body for creating a new conversation."""

    agent_id: str
    title: str | None = None


class SendMessageBody(BaseModel):
    """Request body for sending a message in a conversation."""

    content: str


class ConversationResponse(BaseModel):
    """Full conversation representation returned from API."""

    id: str
    agent_id: str
    agent_name: str | None = None
    title: str | None = None
    message_count: int = 0
    last_message_at: str | None = None
    created_at: str
    created_by: str
