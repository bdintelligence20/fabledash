"""Task models for Firestore task documents."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel

COLLECTION_NAME = "tasks"


class TaskStatus(str, Enum):
    """Workflow status for tasks."""

    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"
    BLOCKED = "blocked"


class TaskPriority(str, Enum):
    """Priority levels for tasks."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskComment(BaseModel):
    """Embedded comment within a task document."""

    id: str
    content: str
    author_uid: str
    author_name: str | None = None
    created_at: datetime


class TaskAttachment(BaseModel):
    """Embedded attachment metadata within a task document."""

    id: str
    filename: str
    url: str
    content_type: str | None = None
    uploaded_by: str
    uploaded_at: datetime


class TaskBase(BaseModel):
    """Shared fields for task create/update operations."""

    title: str
    description: str | None = None
    client_id: str
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: datetime | None = None
    assigned_to: str | None = None


class TaskCreate(TaskBase):
    """Request body for creating a new task."""

    pass


class TaskUpdate(BaseModel):
    """Request body for updating a task. All fields optional for partial updates."""

    title: str | None = None
    description: str | None = None
    client_id: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: datetime | None = None
    assigned_to: str | None = None


class TaskResponse(TaskBase):
    """Full task document representation returned from API."""

    id: str
    comments: list[TaskComment] = []
    attachments: list[TaskAttachment] = []
    created_at: datetime
    updated_at: datetime
    created_by: str
