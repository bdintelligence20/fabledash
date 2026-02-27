"""Task CRUD API endpoints with comment and attachment sub-resources."""

import csv
import io
import json as json_module
import logging
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Query, UploadFile, File
from google.cloud.firestore_v1 import ArrayRemove, ArrayUnion
from pydantic import BaseModel, ValidationError

from app.dependencies.auth import get_current_user
from app.models.base import BaseResponse, ErrorResponse
from app.models.client import COLLECTION_NAME as CLIENTS_COLLECTION
from app.models.task import (
    COLLECTION_NAME,
    TaskAttachment,
    TaskComment,
    TaskCreate,
    TaskPriority,
    TaskResponse,
    TaskStatus,
    TaskUpdate,
)
from app.models.user import CurrentUser
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Helpers ---


def _doc_to_task(doc) -> dict:
    """Convert a Firestore document snapshot to a TaskResponse-compatible dict.

    Handles:
    - doc.id -> id mapping
    - Firestore DatetimeWithNanoseconds -> Python datetime
    - Nested comment/attachment reconstruction from raw dicts
    """
    data = doc.to_dict()
    data["id"] = doc.id

    # Ensure datetime fields are plain Python datetimes
    for field in ("created_at", "updated_at", "due_date"):
        if field in data and data[field] is not None:
            # Firestore DatetimeWithNanoseconds is a datetime subclass, so this is safe
            if hasattr(data[field], "isoformat"):
                data[field] = datetime.fromisoformat(data[field].isoformat())

    # Reconstruct embedded comments
    raw_comments = data.get("comments", [])
    comments = []
    for c in raw_comments:
        if isinstance(c, dict):
            if "created_at" in c and hasattr(c["created_at"], "isoformat"):
                c["created_at"] = datetime.fromisoformat(c["created_at"].isoformat())
            comments.append(c)
    data["comments"] = comments

    # Reconstruct embedded attachments
    raw_attachments = data.get("attachments", [])
    attachments = []
    for a in raw_attachments:
        if isinstance(a, dict):
            if "uploaded_at" in a and hasattr(a["uploaded_at"], "isoformat"):
                a["uploaded_at"] = datetime.fromisoformat(a["uploaded_at"].isoformat())
            attachments.append(a)
    data["attachments"] = attachments

    return data


# --- Core CRUD ---


@router.post("/", response_model=dict)
async def create_task(
    body: TaskCreate,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a new task."""
    try:
        db = get_firestore_client()
        now = datetime.utcnow()

        doc_dict = body.model_dump()
        # Convert enum values for Firestore storage
        doc_dict["status"] = doc_dict["status"].value if isinstance(doc_dict["status"], TaskStatus) else doc_dict["status"]
        doc_dict["priority"] = doc_dict["priority"].value if isinstance(doc_dict["priority"], TaskPriority) else doc_dict["priority"]

        doc_dict["created_at"] = now
        doc_dict["updated_at"] = now
        doc_dict["created_by"] = user.uid
        doc_dict["comments"] = []
        doc_dict["attachments"] = []

        _, doc_ref = db.collection(COLLECTION_NAME).add(doc_dict)

        # Build response with the generated ID
        doc_dict["id"] = doc_ref.id
        return {"success": True, "data": doc_dict}
    except Exception as e:
        logger.exception("Failed to create task")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=dict)
async def list_tasks(
    user: CurrentUser = Depends(get_current_user),
    client_id: str | None = Query(None, description="Filter by client ID"),
    status: TaskStatus | None = Query(None, description="Filter by status"),
    priority: TaskPriority | None = Query(None, description="Filter by priority"),
    assigned_to: str | None = Query(None, description="Filter by assignee UID"),
):
    """List tasks with optional filtering by client, status, priority, and assignee."""
    try:
        db = get_firestore_client()
        query = db.collection(COLLECTION_NAME)

        if client_id is not None:
            query = query.where("client_id", "==", client_id)
        if status is not None:
            query = query.where("status", "==", status.value)
        if priority is not None:
            query = query.where("priority", "==", priority.value)
        if assigned_to is not None:
            query = query.where("assigned_to", "==", assigned_to)

        # Sort in Python to avoid Firestore composite index requirements
        docs = list(query.stream())
        docs.sort(key=lambda d: d.to_dict().get("created_at", ""), reverse=True)

        tasks = []
        for doc in docs:
            tasks.append(_doc_to_task(doc))

        return {"success": True, "data": tasks}
    except Exception as e:
        logger.exception("Failed to list tasks")
        raise HTTPException(status_code=500, detail=str(e))


class TaskBulkItem(BaseModel):
    """Single item in a bulk task import."""

    title: str
    client_id: str
    description: str | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: str | None = None
    assigned_to: str | None = None


@router.post("/bulk", response_model=dict)
async def bulk_create_tasks(
    file: UploadFile | None = File(None),
    tasks: str | None = Body(None, description="JSON array of task objects"),
    user: CurrentUser = Depends(get_current_user),
):
    """Bulk create tasks from a CSV file or JSON array.

    CSV columns: title, client_id, description, status, priority, due_date, assigned_to
    JSON: array of task objects with at least title and client_id.
    """
    items: list[TaskBulkItem] = []
    parse_errors: list[dict] = []

    if file and file.filename:
        content = await file.read()
        text = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))
        for i, row in enumerate(reader):
            try:
                items.append(TaskBulkItem(
                    title=row.get("title", "").strip(),
                    client_id=row.get("client_id", "").strip(),
                    description=row.get("description", "").strip() or None,
                    status=row.get("status", "todo").strip() or "todo",
                    priority=row.get("priority", "medium").strip() or "medium",
                    due_date=row.get("due_date", "").strip() or None,
                    assigned_to=row.get("assigned_to", "").strip() or None,
                ))
            except (ValidationError, Exception) as e:
                parse_errors.append({"row": i + 1, "error": str(e)})
    elif tasks:
        try:
            data = json_module.loads(tasks)
            if not isinstance(data, list):
                raise HTTPException(status_code=400, detail="Expected JSON array")
            for i, item in enumerate(data):
                try:
                    items.append(TaskBulkItem(**item))
                except (ValidationError, Exception) as e:
                    parse_errors.append({"index": i, "error": str(e)})
        except json_module.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON")
    else:
        raise HTTPException(status_code=400, detail="Provide a CSV file or JSON array in 'tasks' field")

    if not items and not parse_errors:
        raise HTTPException(status_code=400, detail="No items to import")
    if len(items) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 tasks per batch")

    db = get_firestore_client()
    now = datetime.utcnow()
    created = []
    errors = list(parse_errors)

    # Validate client_ids exist (batch lookup)
    unique_client_ids = {item.client_id for item in items}
    valid_client_ids: set[str] = set()
    for cid in unique_client_ids:
        doc = db.collection(CLIENTS_COLLECTION).document(cid).get()
        if doc.exists:
            valid_client_ids.add(cid)

    for i, item in enumerate(items):
        if item.client_id not in valid_client_ids:
            errors.append({"index": i, "title": item.title, "error": f"Client ID '{item.client_id}' not found"})
            continue
        try:
            doc_dict = item.model_dump()
            # Convert enums
            doc_dict["status"] = doc_dict["status"].value if isinstance(doc_dict["status"], TaskStatus) else doc_dict["status"]
            doc_dict["priority"] = doc_dict["priority"].value if isinstance(doc_dict["priority"], TaskPriority) else doc_dict["priority"]
            # Handle due_date string -> datetime
            if doc_dict.get("due_date"):
                doc_dict["due_date"] = datetime.fromisoformat(doc_dict["due_date"])
            doc_dict["created_at"] = now
            doc_dict["updated_at"] = now
            doc_dict["created_by"] = user.uid
            doc_dict["comments"] = []
            doc_dict["attachments"] = []

            _, doc_ref = db.collection(COLLECTION_NAME).add(doc_dict)
            created.append({"id": doc_ref.id, "title": item.title})
        except Exception as e:
            errors.append({"index": i, "title": item.title, "error": str(e)})

    return {
        "success": True,
        "data": {
            "total": len(items) + len(parse_errors),
            "created": len(created),
            "failed": len(errors),
            "created_items": created,
            "errors": errors,
        },
    }


@router.get("/{task_id}", response_model=dict)
async def get_task(
    task_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a single task by ID."""
    try:
        db = get_firestore_client()
        doc = db.collection(COLLECTION_NAME).document(task_id).get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Task not found")

        return {"success": True, "data": _doc_to_task(doc)}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get task %s", task_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{task_id}", response_model=dict)
async def update_task(
    task_id: str,
    body: TaskUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    """Update a task (partial update)."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(task_id)

        # Verify task exists
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Task not found")

        update_dict = body.model_dump(exclude_none=True)

        # Convert enum values for Firestore storage
        if "status" in update_dict and isinstance(update_dict["status"], TaskStatus):
            update_dict["status"] = update_dict["status"].value
        if "priority" in update_dict and isinstance(update_dict["priority"], TaskPriority):
            update_dict["priority"] = update_dict["priority"].value

        update_dict["updated_at"] = datetime.utcnow()

        doc_ref.update(update_dict)

        # Re-fetch and return updated task
        updated_doc = doc_ref.get()
        return {"success": True, "data": _doc_to_task(updated_doc)}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update task %s", task_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{task_id}", response_model=BaseResponse)
async def delete_task(
    task_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Delete a task (hard delete)."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(task_id)

        # Verify task exists
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Task not found")

        doc_ref.delete()
        return BaseResponse(success=True, message="Task deleted")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete task %s", task_id)
        raise HTTPException(status_code=500, detail=str(e))


# --- Comment sub-resource ---


@router.post("/{task_id}/comments", response_model=dict)
async def add_comment(
    task_id: str,
    body: dict,
    user: CurrentUser = Depends(get_current_user),
):
    """Add a comment to a task."""
    content = body.get("content")
    if not content:
        raise HTTPException(status_code=400, detail="Comment content is required")

    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(task_id)

        # Verify task exists
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Task not found")

        now = datetime.utcnow()
        comment = TaskComment(
            id=uuid4().hex[:12],
            content=content,
            author_uid=user.uid,
            author_name=user.display_name,
            created_at=now,
        )
        comment_dict = comment.model_dump()

        doc_ref.update({
            "comments": ArrayUnion([comment_dict]),
            "updated_at": now,
        })

        return {"success": True, "data": comment_dict}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to add comment to task %s", task_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{task_id}/comments/{comment_id}", response_model=BaseResponse)
async def delete_comment(
    task_id: str,
    comment_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Remove a comment from a task."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(task_id)

        # Fetch task
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Task not found")

        # Find the comment
        data = doc.to_dict()
        comments = data.get("comments", [])
        target_comment = None
        for c in comments:
            if isinstance(c, dict) and c.get("id") == comment_id:
                target_comment = c
                break

        if target_comment is None:
            raise HTTPException(status_code=404, detail="Comment not found")

        doc_ref.update({
            "comments": ArrayRemove([target_comment]),
            "updated_at": datetime.utcnow(),
        })

        return BaseResponse(success=True, message="Comment deleted")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete comment %s from task %s", comment_id, task_id)
        raise HTTPException(status_code=500, detail=str(e))


# --- Attachment sub-resource ---


@router.post("/{task_id}/attachments", response_model=dict)
async def add_attachment(
    task_id: str,
    body: dict,
    user: CurrentUser = Depends(get_current_user),
):
    """Add attachment metadata to a task.

    NOTE: This stores metadata only. Actual file upload is a future concern.
    """
    filename = body.get("filename")
    url = body.get("url")
    if not filename or not url:
        raise HTTPException(status_code=400, detail="filename and url are required")

    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(task_id)

        # Verify task exists
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Task not found")

        now = datetime.utcnow()
        attachment = TaskAttachment(
            id=uuid4().hex[:12],
            filename=filename,
            url=url,
            content_type=body.get("content_type"),
            uploaded_by=user.uid,
            uploaded_at=now,
        )
        attachment_dict = attachment.model_dump()

        doc_ref.update({
            "attachments": ArrayUnion([attachment_dict]),
            "updated_at": now,
        })

        return {"success": True, "data": attachment_dict}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to add attachment to task %s", task_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{task_id}/attachments/{attachment_id}", response_model=BaseResponse)
async def delete_attachment(
    task_id: str,
    attachment_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Remove attachment metadata from a task."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(task_id)

        # Fetch task
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Task not found")

        # Find the attachment
        data = doc.to_dict()
        attachments = data.get("attachments", [])
        target_attachment = None
        for a in attachments:
            if isinstance(a, dict) and a.get("id") == attachment_id:
                target_attachment = a
                break

        if target_attachment is None:
            raise HTTPException(status_code=404, detail="Attachment not found")

        doc_ref.update({
            "attachments": ArrayRemove([target_attachment]),
            "updated_at": datetime.utcnow(),
        })

        return BaseResponse(success=True, message="Attachment deleted")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete attachment %s from task %s", attachment_id, task_id)
        raise HTTPException(status_code=500, detail=str(e))
