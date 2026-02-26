"""Integration endpoints for Google Drive, Gmail, and Google Calendar."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies.auth import get_current_user
from app.models.user import CurrentUser
from app.utils.calendar_client import get_calendar_client
from app.utils.firebase_client import get_firestore_client
from app.utils.gdrive_client import get_gdrive_client
from app.utils.gmail_client import get_gmail_client

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Gmail endpoints ---


@router.get("/gmail/status")
async def gmail_status(user: CurrentUser = Depends(get_current_user)):
    """Check whether Gmail integration is configured.

    Returns the connection status of the Gmail client.
    """
    client = get_gmail_client()
    return {
        "success": True,
        "data": {
            "configured": client.is_configured(),
        },
    }


@router.get("/gmail/stats")
async def gmail_stats(
    days: int = Query(30, ge=1, le=90, description="Number of days to analyze"),
    user: CurrentUser = Depends(get_current_user),
):
    """Get email statistics including sent/received counts and top correspondents.

    Returns communication pattern data for the specified period.
    """
    client = get_gmail_client()
    if not client.is_configured():
        return {
            "success": True,
            "data": {"configured": False, "message": "Gmail not configured"},
        }

    try:
        stats = await client.get_email_stats(days=days)
        return {
            "success": True,
            "data": stats,
        }
    except Exception as exc:
        logger.exception("Failed to fetch Gmail stats")
        raise HTTPException(status_code=500, detail=f"Failed to fetch email stats: {exc}")


@router.get("/gmail/volume")
async def gmail_volume(
    days: int = Query(30, ge=1, le=90, description="Number of days to analyze"),
    user: CurrentUser = Depends(get_current_user),
):
    """Get daily email volume trend.

    Returns per-day sent and received email counts for the specified period.
    """
    client = get_gmail_client()
    if not client.is_configured():
        return {
            "success": True,
            "data": {"configured": False, "trend": []},
        }

    try:
        trend = await client.get_volume_trend(days=days)
        return {
            "success": True,
            "data": {
                "configured": True,
                "period_days": days,
                "trend": trend,
            },
        }
    except Exception as exc:
        logger.exception("Failed to fetch Gmail volume trend")
        raise HTTPException(status_code=500, detail=f"Failed to fetch volume trend: {exc}")


# --- Calendar endpoints ---


@router.get("/calendar/status")
async def calendar_status(user: CurrentUser = Depends(get_current_user)):
    """Check whether Google Calendar integration is configured.

    Returns the connection status of the Calendar client.
    """
    client = get_calendar_client()
    return {
        "success": True,
        "data": {
            "configured": client.is_configured(),
        },
    }


@router.get("/calendar/meetings")
async def calendar_meetings(
    days_ahead: int = Query(7, ge=0, le=30, description="Days to look ahead"),
    days_back: int = Query(7, ge=0, le=30, description="Days to look back"),
    user: CurrentUser = Depends(get_current_user),
):
    """Get upcoming and recent calendar meetings.

    Returns meetings within the specified date window around today.
    """
    client = get_calendar_client()
    if not client.is_configured():
        return {
            "success": True,
            "data": {"configured": False, "meetings": []},
        }

    try:
        meetings = await client.get_meetings(days_ahead=days_ahead, days_back=days_back)
        return {
            "success": True,
            "data": {
                "configured": True,
                "meetings": meetings,
                "count": len(meetings),
            },
        }
    except Exception as exc:
        logger.exception("Failed to fetch calendar meetings")
        raise HTTPException(status_code=500, detail=f"Failed to fetch meetings: {exc}")


@router.get("/calendar/density")
async def calendar_density(
    days: int = Query(30, ge=1, le=90, description="Number of days to analyze"),
    user: CurrentUser = Depends(get_current_user),
):
    """Get meeting density metrics over a period.

    Returns meetings per day average, busiest day, total meeting hours,
    and daily breakdown for the specified period.
    """
    client = get_calendar_client()
    if not client.is_configured():
        return {
            "success": True,
            "data": {"configured": False},
        }

    try:
        density = await client.get_meeting_density(days=days)
        return {
            "success": True,
            "data": density,
        }
    except Exception as exc:
        logger.exception("Failed to fetch meeting density")
        raise HTTPException(status_code=500, detail=f"Failed to fetch meeting density: {exc}")
