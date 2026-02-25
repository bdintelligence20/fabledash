"""Meeting intelligence API endpoints.

Provides CRUD operations for meetings, sync from external sources,
and AI-powered transcript processing.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies.auth import get_current_user, require_ceo
from app.models.base import ErrorResponse
from app.models.meeting import (
    COLLECTION_NAME,
    TRANSCRIPT_COLLECTION,
    MeetingCreate,
    MeetingResponse,
    MeetingSource,
    MeetingTranscript,
)
from app.models.user import CurrentUser
from app.utils.firebase_client import get_firestore_client
from app.utils.meeting_sync import get_meeting_sync_service
from app.utils.transcript_processor import get_transcript_processor

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Fixed-path routes FIRST (before /{meeting_id} param routes)
# ---------------------------------------------------------------------------


@router.get("/status", response_model=dict)
async def integration_status(
    user: CurrentUser = Depends(get_current_user),
):
    """Return integration configuration status for Read.AI and Fireflies."""
    try:
        from app.utils.fireflies_client import get_fireflies_client
        from app.utils.readai_client import get_readai_client

        readai = get_readai_client()
        fireflies = get_fireflies_client()

        # Check for last sync timestamp in Firestore
        last_sync: str | None = None
        try:
            db = get_firestore_client()
            meta_doc = db.collection("_meta").document("meeting_sync").get()
            if meta_doc.exists:
                last_sync = meta_doc.to_dict().get("last_sync")
        except Exception:
            logger.debug("Could not read sync metadata")

        return {
            "success": True,
            "data": {
                "readai_configured": readai.is_configured(),
                "fireflies_configured": fireflies.is_configured(),
                "last_sync": last_sync,
            },
        }
    except Exception as e:
        logger.exception("Failed to get integration status")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="Failed to get integration status", detail=str(e)
            ).model_dump(),
        )


@router.post("/sync", response_model=dict)
async def trigger_sync(
    user: CurrentUser = Depends(require_ceo),
):
    """Trigger a full meeting sync from all configured sources (CEO only)."""
    try:
        service = get_meeting_sync_service()
        result = await service.sync_all()

        # Record last sync timestamp
        try:
            db = get_firestore_client()
            db.collection("_meta").document("meeting_sync").set({
                "last_sync": datetime.utcnow().isoformat(),
                "last_sync_by": user.uid,
                "last_result": {
                    "total_synced": result["total_synced"],
                    "total_errors": result["total_errors"],
                },
            })
        except Exception:
            logger.debug("Could not write sync metadata")

        return {"success": True, "data": result}
    except Exception as e:
        logger.exception("Meeting sync failed")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="Meeting sync failed", detail=str(e)
            ).model_dump(),
        )


# ---------------------------------------------------------------------------
# Collection routes
# ---------------------------------------------------------------------------


@router.get("/", response_model=dict)
async def list_meetings(
    date_from: str | None = Query(None, description="Filter meetings from this date (ISO 8601)"),
    date_to: str | None = Query(None, description="Filter meetings up to this date (ISO 8601)"),
    client_id: str | None = Query(None, description="Filter by client ID"),
    source: MeetingSource | None = Query(None, description="Filter by meeting source"),
    limit: int = Query(50, ge=1, le=200, description="Max results to return"),
    user: CurrentUser = Depends(get_current_user),
):
    """List meetings with optional filters for date range, client, and source."""
    try:
        db = get_firestore_client()
        query = db.collection(COLLECTION_NAME)

        if client_id:
            query = query.where("client_id", "==", client_id)

        if source:
            query = query.where("source", "==", source.value)

        if date_from:
            query = query.where("date", ">=", date_from)

        if date_to:
            query = query.where("date", "<=", date_to)

        query = query.order_by("date", direction="DESCENDING").limit(limit)

        meetings = []
        for doc in query.stream():
            doc_dict = doc.to_dict()
            doc_dict["id"] = doc.id
            meetings.append(MeetingResponse(**doc_dict).model_dump(mode="json"))

        return {"success": True, "data": meetings}
    except Exception as e:
        logger.exception("Failed to list meetings")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="Failed to list meetings", detail=str(e)
            ).model_dump(),
        )


@router.post("/", response_model=dict)
async def create_meeting(
    body: MeetingCreate,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a manual meeting record in Firestore."""
    try:
        db = get_firestore_client()
        now = datetime.utcnow().isoformat()

        doc_dict = body.model_dump(mode="json")
        doc_dict["created_at"] = now
        doc_dict["updated_at"] = now
        doc_dict["created_by"] = user.uid
        doc_dict["has_transcript"] = False
        doc_dict["action_items"] = []
        doc_dict["key_topics"] = []
        doc_dict["summary"] = None
        doc_dict["source_id"] = None

        # Resolve client name if client_id provided
        if body.client_id:
            try:
                client_doc = db.collection("clients").document(body.client_id).get()
                if client_doc.exists:
                    doc_dict["client_name"] = client_doc.to_dict().get("name")
            except Exception:
                pass

        _, doc_ref = db.collection(COLLECTION_NAME).add(doc_dict)

        doc_dict["id"] = doc_ref.id
        return {
            "success": True,
            "data": MeetingResponse(**doc_dict).model_dump(mode="json"),
        }
    except Exception as e:
        logger.exception("Failed to create meeting")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="Failed to create meeting", detail=str(e)
            ).model_dump(),
        )


# ---------------------------------------------------------------------------
# Single-resource routes (must come AFTER fixed-path routes)
# ---------------------------------------------------------------------------


@router.get("/{meeting_id}", response_model=dict)
async def get_meeting(
    meeting_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a single meeting by ID."""
    try:
        db = get_firestore_client()
        doc = db.collection(COLLECTION_NAME).document(meeting_id).get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Meeting not found")

        doc_dict = doc.to_dict()
        doc_dict["id"] = doc.id
        return {
            "success": True,
            "data": MeetingResponse(**doc_dict).model_dump(mode="json"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get meeting %s", meeting_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="Failed to get meeting", detail=str(e)
            ).model_dump(),
        )


@router.put("/{meeting_id}", response_model=dict)
async def update_meeting(
    meeting_id: str,
    body: MeetingCreate,
    user: CurrentUser = Depends(get_current_user),
):
    """Update an existing meeting. Replaces mutable fields."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(meeting_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Meeting not found")

        update_dict = body.model_dump(mode="json")
        update_dict["updated_at"] = datetime.utcnow().isoformat()

        # Resolve client name if client_id changed
        if body.client_id:
            try:
                client_doc = db.collection("clients").document(body.client_id).get()
                if client_doc.exists:
                    update_dict["client_name"] = client_doc.to_dict().get("name")
            except Exception:
                pass

        doc_ref.update(update_dict)

        updated_doc = doc_ref.get()
        updated_dict = updated_doc.to_dict()
        updated_dict["id"] = updated_doc.id
        return {
            "success": True,
            "data": MeetingResponse(**updated_dict).model_dump(mode="json"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update meeting %s", meeting_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="Failed to update meeting", detail=str(e)
            ).model_dump(),
        )


@router.delete("/{meeting_id}", response_model=dict)
async def delete_meeting(
    meeting_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Delete a meeting and its associated transcript."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(meeting_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Meeting not found")

        # Also remove associated transcript
        transcript_id = f"transcript_{meeting_id}"
        transcript_ref = db.collection(TRANSCRIPT_COLLECTION).document(transcript_id)
        if transcript_ref.get().exists:
            transcript_ref.delete()

        doc_ref.delete()

        return {"success": True, "message": "Meeting deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete meeting %s", meeting_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="Failed to delete meeting", detail=str(e)
            ).model_dump(),
        )


@router.get("/{meeting_id}/transcript", response_model=dict)
async def get_transcript(
    meeting_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get the transcript for a specific meeting."""
    try:
        db = get_firestore_client()

        # Verify meeting exists
        meeting_doc = db.collection(COLLECTION_NAME).document(meeting_id).get()
        if not meeting_doc.exists:
            raise HTTPException(status_code=404, detail="Meeting not found")

        transcript_id = f"transcript_{meeting_id}"
        transcript_doc = db.collection(TRANSCRIPT_COLLECTION).document(transcript_id).get()

        if not transcript_doc.exists:
            raise HTTPException(
                status_code=404, detail="Transcript not found for this meeting"
            )

        doc_dict = transcript_doc.to_dict()
        doc_dict["id"] = transcript_doc.id
        return {
            "success": True,
            "data": MeetingTranscript(**doc_dict).model_dump(mode="json"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get transcript for meeting %s", meeting_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="Failed to get transcript", detail=str(e)
            ).model_dump(),
        )


# ---------------------------------------------------------------------------
# Transcript processing (AI-powered)
# ---------------------------------------------------------------------------


@router.post("/{meeting_id}/process", response_model=dict)
async def process_meeting_transcript(
    meeting_id: str,
    user: CurrentUser = Depends(require_ceo),
):
    """Trigger AI processing of a meeting transcript (CEO only).

    Extracts entities, generates a summary, identifies action items,
    and fuzzy-matches mentioned clients/tasks to Firestore records.
    The meeting document is updated in-place with the results.
    """
    try:
        db = get_firestore_client()

        # Fetch the meeting document
        meeting_ref = db.collection(COLLECTION_NAME).document(meeting_id)
        meeting_doc = meeting_ref.get()

        if not meeting_doc.exists:
            raise HTTPException(status_code=404, detail="Meeting not found")

        meeting_data = meeting_doc.to_dict()

        # Resolve transcript text ------------------------------------------
        # 1. Check for a dedicated transcript document in the transcripts
        #    sub-collection (or top-level transcripts collection).
        # 2. Fall back to the meeting's own notes field.
        transcript_text = ""

        # Try top-level transcripts collection
        try:
            transcript_query = (
                db.collection(TRANSCRIPT_COLLECTION)
                .where("meeting_id", "==", meeting_id)
                .limit(1)
            )
            for t_doc in transcript_query.stream():
                t_data = t_doc.to_dict()
                transcript_text = t_data.get("full_text", "")
                break
        except Exception:
            logger.debug(
                "Could not query transcripts collection for meeting %s",
                meeting_id,
            )

        if not transcript_text:
            transcript_text = meeting_data.get("notes", "") or ""

        if not transcript_text.strip():
            raise HTTPException(
                status_code=400,
                detail="No transcript or notes available for this meeting",
            )

        # Process -----------------------------------------------------------
        processor = get_transcript_processor()
        result = await processor.process_transcript(meeting_id, transcript_text)

        return {
            "success": True,
            "data": {
                "summary": result.get("summary"),
                "action_items": result.get("action_items", []),
                "matched_client": result.get("matched_client"),
                "matched_tasks": result.get("matched_tasks", []),
            },
        }

    except HTTPException:
        raise
    except RuntimeError as e:
        # Raised by TranscriptProcessor when OpenAI is not configured
        logger.warning("Transcript processing unavailable: %s", e)
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Failed to process meeting %s", meeting_id)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="Failed to process meeting transcript",
                detail=str(e),
            ).model_dump(),
        )
