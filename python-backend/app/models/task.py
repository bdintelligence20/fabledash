from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from .base import BaseResponse

class TaskStatus(BaseModel):
    """Task status model."""
    id: int
    name: str
    color: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class TaskComment(BaseModel):
    """Task comment model."""
    id: int
    task_id: int
    content: str
    created_at: datetime
    updated_at: Optional[datetime] = None

class TaskAttachment(BaseModel):
    """Task attachment model."""
    id: int
    task_id: int
    filename: str
    file_type: str
    file_size: int
    content_type: str
    created_at: datetime
    updated_at: Optional[datetime] = None

class Task(BaseModel):
    """Task model."""
    id: int
    title: str
    description: Optional[str] = None
    client_id: Optional[int] = None
    status_id: int
    due_date: Optional[date] = None
    priority: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class TaskCreate(BaseModel):
    """Model for creating a new task."""
    title: str
    description: Optional[str] = None
    client_id: Optional[int] = None
    status_id: int
    due_date: Optional[date] = None
    priority: Optional[int] = None

class TaskUpdate(BaseModel):
    """Model for updating a task."""
    title: Optional[str] = None
    description: Optional[str] = None
    client_id: Optional[int] = None
    status_id: Optional[int] = None
    due_date: Optional[date] = None
    priority: Optional[int] = None

class TaskCommentCreate(BaseModel):
    """Model for creating a new task comment."""
    task_id: int
    content: str

class TaskStatusCreate(BaseModel):
    """Model for creating a new task status."""
    name: str
    color: Optional[str] = None

class TaskResponse(BaseResponse):
    """Response model for a single task."""
    task: Task

class TasksResponse(BaseResponse):
    """Response model for multiple tasks."""
    tasks: List[Task]

class TaskStatusResponse(BaseResponse):
    """Response model for a single task status."""
    status: TaskStatus

class TaskStatusesResponse(BaseResponse):
    """Response model for multiple task statuses."""
    statuses: List[TaskStatus]

class TaskCommentResponse(BaseResponse):
    """Response model for a single task comment."""
    comment: TaskComment

class TaskCommentsResponse(BaseResponse):
    """Response model for multiple task comments."""
    comments: List[TaskComment]

class TaskAttachmentResponse(BaseResponse):
    """Response model for a single task attachment."""
    attachment: TaskAttachment

class TaskAttachmentsResponse(BaseResponse):
    """Response model for multiple task attachments."""
    attachments: List[TaskAttachment]

class TaskWithDetails(Task):
    """Task model with additional details."""
    status: Optional[TaskStatus] = None
    comments: List[TaskComment] = []
    attachments: List[TaskAttachment] = []

class TaskWithDetailsResponse(BaseResponse):
    """Response model for a task with additional details."""
    task: TaskWithDetails
