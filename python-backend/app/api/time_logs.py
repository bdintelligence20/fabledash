"""Time log CRUD API endpoints with auto-duration calculation."""

import datetime as dt
import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies.auth import get_current_user
from app.models.base import BaseResponse, ErrorResponse
from app.models.time_log import (
    COLLECTION_NAME,
    TimeLogCreate,
    TimeLogResponse,
    TimeLogUpdate,
    calculate_duration_minutes,
)
from app.models.user import CurrentUser
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)

router = APIRouter()


def _doc_to_time_log(doc) -> dict:
    """Convert a Firestore document snapshot to a TimeLogResponse-compatible dict.

    Handles string-to-Python type conversion for date, time, and datetime fields
    stored as ISO strings in Firestore.
    """
    data = doc.to_dict()
    data["id"] = doc.id

    # Convert date string -> date object
    if isinstance(data.get("date"), str):
        data["date"] = dt.date.fromisoformat(data["date"])

    # Convert time strings -> time objects
    for field in ("start_time", "end_time"):
        if isinstance(data.get(field), str):
            data[field] = dt.time.fromisoformat(data[field])

    # Convert datetime strings -> datetime objects
    for field in ("created_at", "updated_at"):
        val = data.get(field)
        if isinstance(val, str):
            data[field] = dt.datetime.fromisoformat(val)

    return data


@router.post("/", response_model=None)
async def create_time_log(
    body: TimeLogCreate,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a new time log entry with auto-calculated duration."""
    # Validate end_time > start_time
    if body.end_time <= body.start_time:
        raise HTTPException(
            status_code=400,
            detail="End time must be after start time",
        )

    try:
        duration_minutes = calculate_duration_minutes(body.start_time, body.end_time)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    now = dt.datetime.utcnow()

    doc_dict = {
        "date": body.date.isoformat(),
        "client_id": body.client_id,
        "task_id": body.task_id,
        "description": body.description,
        "start_time": body.start_time.isoformat(),
        "end_time": body.end_time.isoformat(),
        "is_billable": body.is_billable,
        "duration_minutes": duration_minutes,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": user.uid,
    }

    try:
        db = get_firestore_client()
        _, doc_ref = db.collection(COLLECTION_NAME).add(doc_dict)
    except Exception:
        logger.exception("Failed to create time log")
        return ErrorResponse(error="Failed to create time log").model_dump()

    # Build response with the generated ID
    response_data = {**doc_dict, "id": doc_ref.id}
    # Convert ISO strings back to Python types for Pydantic validation
    response_data["date"] = body.date
    response_data["start_time"] = body.start_time
    response_data["end_time"] = body.end_time
    response_data["created_at"] = now
    response_data["updated_at"] = now

    return {"success": True, "data": TimeLogResponse(**response_data).model_dump(mode="json")}


@router.get("/", response_model=None)
async def list_time_logs(
    user: CurrentUser = Depends(get_current_user),
    client_id: str | None = Query(None, description="Filter by client ID"),
    task_id: str | None = Query(None, description="Filter by task ID"),
    date_from: dt.date | None = Query(None, description="Filter logs on or after this date"),
    date_to: dt.date | None = Query(None, description="Filter logs on or before this date"),
    created_by: str | None = Query(None, description="Filter by user who created the entry"),
    is_billable: bool | None = Query(None, description="Filter by billable status"),
):
    """List time logs with optional filtering by client, task, date range, and creator."""
    try:
        db = get_firestore_client()
        query = db.collection(COLLECTION_NAME)

        if client_id:
            query = query.where("client_id", "==", client_id)
        if task_id:
            query = query.where("task_id", "==", task_id)
        if date_from:
            query = query.where("date", ">=", date_from.isoformat())
        if date_to:
            query = query.where("date", "<=", date_to.isoformat())
        if created_by:
            query = query.where("created_by", "==", created_by)
        if is_billable is not None:
            query = query.where("is_billable", "==", is_billable)

        query = query.order_by("date", direction="DESCENDING")
        query = query.order_by("start_time", direction="DESCENDING")

        docs = query.stream()
        time_logs = []
        for doc in docs:
            try:
                data = _doc_to_time_log(doc)
                time_logs.append(TimeLogResponse(**data).model_dump(mode="json"))
            except Exception:
                logger.warning("Skipping malformed time log doc %s", doc.id, exc_info=True)

        return {"success": True, "data": time_logs}

    except Exception:
        logger.exception("Failed to list time logs")
        return ErrorResponse(error="Failed to list time logs").model_dump()


@router.get("/{time_log_id}", response_model=None)
async def get_time_log(
    time_log_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a single time log entry by ID."""
    try:
        db = get_firestore_client()
        doc = db.collection(COLLECTION_NAME).document(time_log_id).get()
    except Exception:
        logger.exception("Failed to fetch time log %s", time_log_id)
        return ErrorResponse(error="Failed to fetch time log").model_dump()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Time log not found")

    data = _doc_to_time_log(doc)
    return {"success": True, "data": TimeLogResponse(**data).model_dump(mode="json")}


@router.put("/{time_log_id}", response_model=None)
async def update_time_log(
    time_log_id: str,
    body: TimeLogUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    """Update a time log entry. Recalculates duration if start/end times change."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(time_log_id)
        doc = doc_ref.get()
    except Exception:
        logger.exception("Failed to fetch time log %s for update", time_log_id)
        return ErrorResponse(error="Failed to fetch time log for update").model_dump()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Time log not found")

    update_dict = body.model_dump(exclude_none=True)

    # Recalculate duration if start_time or end_time is being updated
    if "start_time" in update_dict or "end_time" in update_dict:
        existing = doc.to_dict()

        new_start = update_dict.get("start_time") or dt.time.fromisoformat(existing["start_time"])
        new_end = update_dict.get("end_time") or dt.time.fromisoformat(existing["end_time"])

        if new_end <= new_start:
            raise HTTPException(
                status_code=400,
                detail="End time must be after start time",
            )

        try:
            update_dict["duration_minutes"] = calculate_duration_minutes(new_start, new_end)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    # Convert date/time fields to ISO strings for Firestore storage
    if "date" in update_dict:
        update_dict["date"] = update_dict["date"].isoformat()
    if "start_time" in update_dict:
        update_dict["start_time"] = update_dict["start_time"].isoformat()
    if "end_time" in update_dict:
        update_dict["end_time"] = update_dict["end_time"].isoformat()

    update_dict["updated_at"] = dt.datetime.utcnow().isoformat()

    try:
        doc_ref.update(update_dict)
    except Exception:
        logger.exception("Failed to update time log %s", time_log_id)
        return ErrorResponse(error="Failed to update time log").model_dump()

    # Re-fetch and return updated document
    try:
        updated_doc = doc_ref.get()
        data = _doc_to_time_log(updated_doc)
        return {"success": True, "data": TimeLogResponse(**data).model_dump(mode="json")}
    except Exception:
        logger.exception("Failed to re-fetch time log %s after update", time_log_id)
        return ErrorResponse(error="Time log updated but failed to fetch result").model_dump()


@router.delete("/{time_log_id}", response_model=None)
async def delete_time_log(
    time_log_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Delete a time log entry (hard delete)."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(time_log_id)
        doc = doc_ref.get()
    except Exception:
        logger.exception("Failed to fetch time log %s for deletion", time_log_id)
        return ErrorResponse(error="Failed to fetch time log for deletion").model_dump()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Time log not found")

    try:
        doc_ref.delete()
    except Exception:
        logger.exception("Failed to delete time log %s", time_log_id)
        return ErrorResponse(error="Failed to delete time log").model_dump()

    return BaseResponse(success=True, message="Time log deleted").model_dump()
