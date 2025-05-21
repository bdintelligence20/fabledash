from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from .base import BaseResponse
from .agent import Agent

class Message(BaseModel):
    """Message model."""
    id: int
    chat_id: int
    role: str  # 'system', 'user', or 'assistant'
    content: str
    created_at: datetime

class MessageCreate(BaseModel):
    """Model for creating a new message."""
    chat_id: int
    role: str
    content: str

class Chat(BaseModel):
    """Chat model."""
    id: int
    agent_id: int
    title: str
    parent_chat_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class ChatWithAgent(Chat):
    """Chat model with agent information."""
    agents: Optional[Agent] = None

class ChatCreate(BaseModel):
    """Model for creating a new chat."""
    agent_id: int
    title: Optional[str] = None
    parent_chat_id: Optional[int] = None

class ChatResponse(BaseResponse):
    """Response model for a single chat."""
    chat: Chat

class ChatsResponse(BaseResponse):
    """Response model for multiple chats."""
    chats: List[Chat]

class ChatWithMessagesResponse(BaseResponse):
    """Response model for a chat with its messages."""
    chat: Chat
    messages: List[Message]

class MessagesResponse(BaseResponse):
    """Response model for messages."""
    messages: List[Message]

class LinkedChatsResponse(BaseResponse):
    """Response model for linked chats (parent and child chats)."""
    chat: Chat
    parentChat: Optional[Chat] = None
    childChats: List[Chat] = []

class ChatHistoryResponse(BaseResponse):
    """Response model for agent chat history."""
    agent: Agent
    agentChats: List[Chat] = []
    childAgentChats: List[Chat] = []
    parentAgentChats: List[Chat] = []
