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


# --- Google Drive endpoints ---


@router.get("/drive/status")
async def drive_status(user: CurrentUser = Depends(get_current_user)):
    """Check Google Drive connection status."""
    client = get_gdrive_client()
    return {
        "success": True,
        "data": {
            "configured": client.is_configured(),
            "service": "google_drive",
        },
    }


@router.get("/drive/files")
async def list_drive_files(
    folder_id: Optional[str] = Query(None, description="Folder ID to list"),
    query: Optional[str] = Query(None, description="Additional Drive query filter"),
    user: CurrentUser = Depends(get_current_user),
):
    """List files from Google Drive."""
    client = get_gdrive_client()
    if not client.is_configured():
        raise HTTPException(status_code=503, detail="Google Drive is not configured")
    try:
        files = await client.list_files(folder_id=folder_id, query=query)
        return {"success": True, "data": {"files": files, "count": len(files)}}
    except Exception as exc:
        logger.exception("Failed to list Drive files")
        raise HTTPException(status_code=502, detail=f"Drive API error: {exc}") from exc


@router.get("/drive/files/{file_id}")
async def get_drive_file(
    file_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get metadata for a single Google Drive file."""
    client = get_gdrive_client()
    if not client.is_configured():
        raise HTTPException(status_code=503, detail="Google Drive is not configured")
    try:
        file_meta = await client.get_file(file_id)
        return {"success": True, "data": {"file": file_meta}}
    except Exception as exc:
        logger.exception("Failed to get Drive file %s", file_id)
        raise HTTPException(status_code=502, detail=f"Drive API error: {exc}") from exc


@router.get("/drive/client/{client_id}/files")
async def get_client_drive_files(
    client_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """List files in a client's Google Drive folder.

    Looks up the client name from Firestore, finds a matching Drive folder,
    then lists its contents.
    """
    gdrive = get_gdrive_client()
    if not gdrive.is_configured():
        raise HTTPException(status_code=503, detail="Google Drive is not configured")

    # Look up client name from Firestore
    db = get_firestore_client()
    client_doc = db.collection("clients").document(client_id).get()
    if not client_doc.exists:
        raise HTTPException(status_code=404, detail="Client not found")

    client_data = client_doc.to_dict()
    client_name = client_data.get("name", "")

    try:
        folder = await gdrive.get_client_folder(client_name)
        if not folder:
            return {"success": True, "data": {"files": [], "count": 0, "folder": None}}

        files = await gdrive.list_files(folder_id=folder["id"])
        return {
            "success": True,
            "data": {"files": files, "count": len(files), "folder": folder},
        }
    except Exception as exc:
        logger.exception("Failed to get Drive files for client %s", client_id)
        raise HTTPException(status_code=502, detail=f"Drive API error: {exc}") from exc
