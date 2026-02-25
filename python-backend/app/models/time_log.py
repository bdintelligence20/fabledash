"""Time log models for Firestore time log documents."""

import datetime as dt

from pydantic import BaseModel

COLLECTION_NAME = "time_logs"


def calculate_duration_minutes(start: dt.time, end: dt.time) -> int:
    """Calculate duration in minutes between two times (same-day).

    Args:
        start: Start time (HH:MM).
        end: End time (HH:MM). Must be after start.

    Returns:
        Duration in minutes.

    Raises:
        ValueError: If end time is not after start time.
    """
    start_minutes = start.hour * 60 + start.minute
    end_minutes = end.hour * 60 + end.minute
    if end_minutes <= start_minutes:
        raise ValueError(
            f"End time ({end}) must be after start time ({start})"
        )
    return end_minutes - start_minutes


class TimeLogBase(BaseModel):
    """Shared fields for time log create/update operations."""

    date: dt.date
    client_id: str
    task_id: str | None = None
    description: str
    start_time: dt.time
    end_time: dt.time
    is_billable: bool = True


class TimeLogCreate(TimeLogBase):
    """Request body for creating a new time log entry."""

    pass


class TimeLogUpdate(BaseModel):
    """Request body for updating a time log. All fields optional for partial updates."""

    date: dt.date | None = None
    client_id: str | None = None
    task_id: str | None = None
    description: str | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    is_billable: bool | None = None


class TimeLogResponse(TimeLogBase):
    """Full time log document representation returned from API."""

    id: str
    duration_minutes: int
    created_at: dt.datetime
    updated_at: dt.datetime
    created_by: str
