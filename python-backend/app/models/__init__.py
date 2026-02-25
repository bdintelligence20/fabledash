"""Pydantic models for all Firestore document types.

Single import point: from app.models import ClientCreate, TaskResponse, ...
"""

from app.models.base import BaseResponse, ErrorResponse
from app.models.client import (
    COLLECTION_NAME as CLIENTS_COLLECTION,
    ClientBase,
    ClientCreate,
    ClientResponse,
    ClientUpdate,
    PartnerGroup,
)
from app.models.task import (
    COLLECTION_NAME as TASKS_COLLECTION,
    TaskAttachment,
    TaskBase,
    TaskComment,
    TaskCreate,
    TaskPriority,
    TaskResponse,
    TaskStatus,
    TaskUpdate,
)
from app.models.time_log import (
    COLLECTION_NAME as TIME_LOGS_COLLECTION,
    TimeLogBase,
    TimeLogCreate,
    TimeLogResponse,
    TimeLogUpdate,
    calculate_duration_minutes,
)
from app.models.user import CurrentUser, UserRole

__all__ = [
    # Base
    "BaseResponse",
    "ErrorResponse",
    # Client
    "CLIENTS_COLLECTION",
    "ClientBase",
    "ClientCreate",
    "ClientResponse",
    "ClientUpdate",
    "PartnerGroup",
    # Task
    "TASKS_COLLECTION",
    "TaskAttachment",
    "TaskBase",
    "TaskComment",
    "TaskCreate",
    "TaskPriority",
    "TaskResponse",
    "TaskStatus",
    "TaskUpdate",
    # Time Log
    "TIME_LOGS_COLLECTION",
    "TimeLogBase",
    "TimeLogCreate",
    "TimeLogResponse",
    "TimeLogUpdate",
    "calculate_duration_minutes",
    # User
    "CurrentUser",
    "UserRole",
]
