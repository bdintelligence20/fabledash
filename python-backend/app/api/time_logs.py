"""Time log CRUD API endpoints with auto-duration calculation."""

import datetime as dt
import logging
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies.auth import get_current_user
from app.models.base import BaseResponse, ErrorResponse
from app.models.client import COLLECTION_NAME as CLIENT_COLLECTION, PartnerGroup
from app.models.task import COLLECTION_NAME as TASK_COLLECTION
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


@router.get("/allocation", response_model=None)
async def get_time_allocation(
    user: CurrentUser = Depends(get_current_user),
    date_from: dt.date | None = Query(None, description="Start of period (inclusive)"),
    date_to: dt.date | None = Query(None, description="End of period (inclusive)"),
):
    """Aggregate logged time by partner group for time allocation dashboard."""
    try:
        db = get_firestore_client()

        # Build time logs query with optional date range
        tl_query = db.collection(COLLECTION_NAME)
        if date_from:
            tl_query = tl_query.where("date", ">=", date_from.isoformat())
        if date_to:
            tl_query = tl_query.where("date", "<=", date_to.isoformat())

        time_log_docs = tl_query.stream()

        # Fetch all clients to build client_id -> partner_group map
        client_docs = db.collection(CLIENT_COLLECTION).stream()
        client_group_map: dict[str, str] = {}
        for cdoc in client_docs:
            cdata = cdoc.to_dict()
            client_group_map[cdoc.id] = cdata.get("partner_group", "direct_clients")

        # Accumulate per-group stats
        ALL_GROUPS = [pg.value for pg in PartnerGroup]
        group_stats: dict[str, dict] = {
            g: {
                "total_minutes": 0,
                "billable_minutes": 0,
                "entry_count": 0,
            }
            for g in ALL_GROUPS
        }

        grand_total_minutes = 0

        for doc in time_log_docs:
            data = doc.to_dict()
            client_id = data.get("client_id", "")
            partner_group = client_group_map.get(client_id, "direct_clients")
            # Ensure group is valid; fall back to direct_clients
            if partner_group not in group_stats:
                partner_group = "direct_clients"

            minutes = data.get("duration_minutes", 0)
            is_billable = data.get("is_billable", True)

            group_stats[partner_group]["total_minutes"] += minutes
            if is_billable:
                group_stats[partner_group]["billable_minutes"] += minutes
            group_stats[partner_group]["entry_count"] += 1
            grand_total_minutes += minutes

        # Build response groups
        groups = []
        for g in ALL_GROUPS:
            s = group_stats[g]
            total_min = s["total_minutes"]
            billable_min = s["billable_minutes"]
            non_billable_min = total_min - billable_min
            percentage = round((total_min / grand_total_minutes) * 100, 1) if grand_total_minutes > 0 else 0.0
            groups.append({
                "partner_group": g,
                "total_hours": round(total_min / 60, 1),
                "billable_hours": round(billable_min / 60, 1),
                "non_billable_hours": round(non_billable_min / 60, 1),
                "entry_count": s["entry_count"],
                "percentage": percentage,
            })

        period_from = date_from.isoformat() if date_from else None
        period_to = date_to.isoformat() if date_to else None

        return {
            "success": True,
            "data": {
                "period": {"from": period_from, "to": period_to},
                "total_hours": round(grand_total_minutes / 60, 1),
                "groups": groups,
            },
        }

    except Exception:
        logger.exception("Failed to aggregate time allocation")
        return ErrorResponse(error="Failed to aggregate time allocation").model_dump()


@router.get("/utilization", response_model=None)
async def get_utilization(
    user: CurrentUser = Depends(get_current_user),
    date_from: dt.date | None = Query(None, description="Start of period (inclusive)"),
    date_to: dt.date | None = Query(None, description="End of period (inclusive)"),
):
    """Calculate utilization rate and saturation leaderboards."""
    try:
        db = get_firestore_client()

        # Build time logs query with optional date range
        tl_query = db.collection(COLLECTION_NAME)
        if date_from:
            tl_query = tl_query.where("date", ">=", date_from.isoformat())
        if date_to:
            tl_query = tl_query.where("date", "<=", date_to.isoformat())

        time_log_docs = list(tl_query.stream())

        # ---- Utilization metrics ----
        total_minutes = 0
        billable_minutes = 0
        # Per-client accumulator: { client_id: { minutes, billable_minutes, count } }
        client_agg: dict[str, dict] = defaultdict(lambda: {"minutes": 0, "count": 0})
        # Per-task accumulator: { task_id: { minutes, client_id, count } }
        task_agg: dict[str, dict] = defaultdict(lambda: {"minutes": 0, "client_id": "", "count": 0})
        # Per-day accumulator: { date_str: { total_minutes, billable_minutes } }
        day_agg: dict[str, dict] = defaultdict(lambda: {"total_minutes": 0, "billable_minutes": 0})

        for doc in time_log_docs:
            data = doc.to_dict()
            minutes = data.get("duration_minutes", 0)
            is_billable = data.get("is_billable", True)
            client_id = data.get("client_id", "")
            task_id = data.get("task_id")
            date_str = data.get("date", "")

            total_minutes += minutes
            if is_billable:
                billable_minutes += minutes

            # Client aggregation
            client_agg[client_id]["minutes"] += minutes
            client_agg[client_id]["count"] += 1

            # Task aggregation (skip null/empty task_id)
            if task_id:
                task_agg[task_id]["minutes"] += minutes
                task_agg[task_id]["client_id"] = client_id
                task_agg[task_id]["count"] += 1

            # Daily aggregation
            day_agg[date_str]["total_minutes"] += minutes
            if is_billable:
                day_agg[date_str]["billable_minutes"] += minutes

        non_billable_minutes = total_minutes - billable_minutes
        total_hours = round(total_minutes / 60, 1)
        billable_hours = round(billable_minutes / 60, 1)
        non_billable_hours = round(non_billable_minutes / 60, 1)
        utilization_rate = round((billable_minutes / total_minutes) * 100, 1) if total_minutes > 0 else 0.0

        # ---- Saturation by client (top 5) ----
        # Fetch all clients to resolve names
        client_docs = db.collection(CLIENT_COLLECTION).stream()
        client_name_map: dict[str, str] = {}
        for cdoc in client_docs:
            cdata = cdoc.to_dict()
            client_name_map[cdoc.id] = cdata.get("name", "Unknown Client")

        sorted_clients = sorted(client_agg.items(), key=lambda x: x[1]["minutes"], reverse=True)[:5]
        saturation_by_client = []
        for cid, stats in sorted_clients:
            c_hours = round(stats["minutes"] / 60, 1)
            pct = round((stats["minutes"] / total_minutes) * 100, 1) if total_minutes > 0 else 0.0
            saturation_by_client.append({
                "client_name": client_name_map.get(cid, "Unknown Client"),
                "total_hours": c_hours,
                "percentage_of_total": pct,
                "entry_count": stats["count"],
            })

        # ---- Saturation by task (top 5) ----
        # Fetch all tasks to resolve names
        task_docs = db.collection(TASK_COLLECTION).stream()
        task_name_map: dict[str, str] = {}
        for tdoc in task_docs:
            tdata = tdoc.to_dict()
            task_name_map[tdoc.id] = tdata.get("title", "Unknown Task")

        sorted_tasks = sorted(task_agg.items(), key=lambda x: x[1]["minutes"], reverse=True)[:5]
        saturation_by_task = []
        for tid, stats in sorted_tasks:
            t_hours = round(stats["minutes"] / 60, 1)
            pct = round((stats["minutes"] / total_minutes) * 100, 1) if total_minutes > 0 else 0.0
            saturation_by_task.append({
                "task_name": task_name_map.get(tid, "Unknown Task"),
                "client_name": client_name_map.get(stats["client_id"], "Unknown Client"),
                "total_hours": t_hours,
                "percentage_of_total": pct,
                "entry_count": stats["count"],
            })

        # ---- Daily trend ----
        daily_trend = []
        for date_key in sorted(day_agg.keys()):
            d = day_agg[date_key]
            daily_trend.append({
                "date": date_key,
                "total_hours": round(d["total_minutes"] / 60, 1),
                "billable_hours": round(d["billable_minutes"] / 60, 1),
            })

        period_from = date_from.isoformat() if date_from else None
        period_to = date_to.isoformat() if date_to else None

        return {
            "success": True,
            "data": {
                "period": {"from": period_from, "to": period_to},
                "utilization": {
                    "total_logged_hours": total_hours,
                    "total_billable_hours": billable_hours,
                    "total_non_billable_hours": non_billable_hours,
                    "utilization_rate": utilization_rate,
                },
                "saturation_by_client": saturation_by_client,
                "saturation_by_task": saturation_by_task,
                "daily_trend": daily_trend,
            },
        }

    except Exception:
        logger.exception("Failed to calculate utilization metrics")
        return ErrorResponse(error="Failed to calculate utilization metrics").model_dump()


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
