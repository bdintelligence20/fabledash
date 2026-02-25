"""Financial file upload endpoints — P&L and revenue forecast uploads."""

import logging
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile

from app.dependencies.auth import get_current_user, require_ceo
from app.models.financial import FORECAST_COLLECTION, PNL_COLLECTION, RevenueForecast
from app.models.user import CurrentUser
from app.utils.excel_parser import parse_forecast_file, parse_pnl_file
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# P&L upload endpoints
# ---------------------------------------------------------------------------


@router.post("/pnl")
async def upload_pnl(
    file: UploadFile,
    period: str | None = None,
    user: CurrentUser = Depends(require_ceo),
):
    """Upload a P&L report (CSV or Excel).

    Parses the file, extracts financial rows (actuals vs forecasts), stores
    a PnlUpload document in Firestore, and returns a summary.
    CEO-only endpoint.

    Args:
        file: The uploaded .csv or .xlsx file.
        period: Reporting period (e.g. "2026-02"). Defaults to current month.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Default period to current month
    effective_period = period or date.today().strftime("%Y-%m")

    # Parse the file
    try:
        rows = parse_pnl_file(content, file.filename, default_period=effective_period)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Build the upload document
    now = datetime.now(timezone.utc).isoformat()
    upload_id = uuid.uuid4().hex

    doc_data = {
        "id": upload_id,
        "filename": file.filename,
        "period": effective_period,
        "rows": [row.model_dump() for row in rows],
        "uploaded_at": now,
        "uploaded_by": user.uid,
    }

    # Store in Firestore
    try:
        db = get_firestore_client()
        db.collection(PNL_COLLECTION).document(upload_id).set(doc_data)
    except Exception:
        logger.exception("Failed to store P&L upload in Firestore")
        raise HTTPException(status_code=500, detail="Failed to save P&L upload.")

    logger.info(
        "P&L upload %s by %s — %d rows, period %s",
        upload_id,
        user.uid,
        len(rows),
        effective_period,
    )

    return {
        "success": True,
        "data": {
            "id": upload_id,
            "row_count": len(rows),
            "period": effective_period,
        },
    }


@router.get("/pnl")
async def list_pnl_uploads(
    period: str | None = None,
    limit: int = Query(12, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
):
    """List P&L uploads (summary only, most recent first).

    Optionally filter by reporting period.
    """
    try:
        db = get_firestore_client()
        query = db.collection(PNL_COLLECTION)

        if period:
            query = query.where("period", "==", period)

        query = query.order_by("uploaded_at", direction="DESCENDING").limit(limit)
        docs = query.stream()

        uploads = []
        for doc in docs:
            data = doc.to_dict()
            uploads.append({
                "id": data.get("id", doc.id),
                "filename": data.get("filename"),
                "period": data.get("period"),
                "row_count": len(data.get("rows", [])),
                "uploaded_at": data.get("uploaded_at"),
            })
    except Exception:
        logger.exception("Failed to list P&L uploads")
        raise HTTPException(status_code=500, detail="Failed to retrieve P&L uploads.")

    return {
        "success": True,
        "data": uploads,
    }


@router.get("/pnl/{upload_id}")
async def get_pnl_upload(
    upload_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Retrieve a full P&L upload including all rows."""
    try:
        db = get_firestore_client()
        doc = db.collection(PNL_COLLECTION).document(upload_id).get()
    except Exception:
        logger.exception("Failed to read P&L upload %s from Firestore", upload_id)
        raise HTTPException(status_code=500, detail="Failed to retrieve P&L upload.")

    if not doc.exists:
        raise HTTPException(status_code=404, detail="P&L upload not found.")

    return {
        "success": True,
        "data": doc.to_dict(),
    }


@router.delete("/pnl/{upload_id}")
async def delete_pnl_upload(
    upload_id: str,
    user: CurrentUser = Depends(require_ceo),
):
    """Delete a P&L upload. CEO-only endpoint."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(PNL_COLLECTION).document(upload_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="P&L upload not found.")

        doc_ref.delete()
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to delete P&L upload %s", upload_id)
        raise HTTPException(status_code=500, detail="Failed to delete P&L upload.")

    logger.info("P&L upload %s deleted by %s", upload_id, user.uid)

    return {
        "success": True,
        "message": "P&L upload deleted.",
    }


# ---------------------------------------------------------------------------
# Revenue forecast endpoints
# ---------------------------------------------------------------------------


@router.post("/forecast")
async def upload_forecast(
    file: UploadFile,
    forecast_date: date | None = None,
    user: CurrentUser = Depends(require_ceo),
):
    """Upload a 90-day revenue forecast document (CSV or Excel).

    Parses the file, stores the entries in Firestore, and returns a summary.
    CEO-only endpoint.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Parse the file
    try:
        entries = parse_forecast_file(content, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Build the forecast document
    now = datetime.now(timezone.utc).isoformat()
    forecast_id = uuid.uuid4().hex
    effective_date = (forecast_date or date.today()).isoformat()

    forecast = RevenueForecast(
        id=forecast_id,
        filename=file.filename,
        forecast_date=effective_date,
        entries=entries,
        uploaded_at=now,
        uploaded_by=user.uid,
    )

    # Store in Firestore
    try:
        db = get_firestore_client()
        db.collection(FORECAST_COLLECTION).document(forecast_id).set(
            forecast.model_dump()
        )
    except Exception:
        logger.exception("Failed to store revenue forecast in Firestore")
        raise HTTPException(status_code=500, detail="Failed to save forecast.")

    logger.info(
        "Revenue forecast %s uploaded by %s (%d entries)",
        forecast_id,
        user.uid,
        len(entries),
    )

    return {
        "success": True,
        "data": {
            "id": forecast_id,
            "entry_count": len(entries),
            "forecast_date": effective_date,
        },
    }


@router.get("/forecast")
async def list_forecasts(
    limit: int = Query(12, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
):
    """List revenue forecast uploads (summary only, most recent first)."""
    try:
        db = get_firestore_client()
        query = (
            db.collection(FORECAST_COLLECTION)
            .order_by("uploaded_at", direction="DESCENDING")
            .limit(limit)
        )
        docs = query.stream()

        forecasts = []
        for doc in docs:
            data = doc.to_dict()
            forecasts.append(
                {
                    "id": data.get("id", doc.id),
                    "filename": data.get("filename"),
                    "forecast_date": data.get("forecast_date"),
                    "entry_count": len(data.get("entries", [])),
                    "uploaded_at": data.get("uploaded_at"),
                }
            )
    except Exception:
        logger.exception("Failed to list revenue forecasts")
        raise HTTPException(status_code=500, detail="Failed to retrieve forecasts.")

    return {
        "success": True,
        "data": forecasts,
    }


@router.get("/forecast/{forecast_id}")
async def get_forecast(
    forecast_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Retrieve a full revenue forecast including all entries."""
    try:
        db = get_firestore_client()
        doc = db.collection(FORECAST_COLLECTION).document(forecast_id).get()
    except Exception:
        logger.exception("Failed to read forecast %s from Firestore", forecast_id)
        raise HTTPException(status_code=500, detail="Failed to retrieve forecast.")

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Forecast not found.")

    return {
        "success": True,
        "data": doc.to_dict(),
    }


@router.delete("/forecast/{forecast_id}")
async def delete_forecast(
    forecast_id: str,
    user: CurrentUser = Depends(require_ceo),
):
    """Delete a revenue forecast. CEO-only endpoint."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection(FORECAST_COLLECTION).document(forecast_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Forecast not found.")

        doc_ref.delete()
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to delete forecast %s", forecast_id)
        raise HTTPException(status_code=500, detail="Failed to delete forecast.")

    logger.info("Revenue forecast %s deleted by %s", forecast_id, user.uid)

    return {
        "success": True,
        "message": "Forecast deleted.",
    }
