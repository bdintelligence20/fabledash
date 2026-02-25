"""Sage Business Cloud Accounting connection management and data sync endpoints."""

import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from google.cloud.firestore_v1 import FieldFilter

from app.dependencies.auth import get_current_user, require_ceo
from app.models.financial import (
    COLLECTION_NAME as SNAPSHOTS_COLLECTION,
    INVOICES_COLLECTION,
    PAYMENTS_COLLECTION,
)
from app.models.user import CurrentUser
from app.utils.firebase_client import get_firestore_client
from app.utils.sage_client import get_sage_client
from app.utils.sage_sync import SageSyncService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status")
async def sage_status(user: CurrentUser = Depends(get_current_user)):
    """Check whether Sage Business Cloud Accounting is connected.

    Returns the connection status and the timestamp of the last credential update
    (used as a proxy for last sync time).
    """
    client = get_sage_client()
    connected = await client.is_connected()
    last_sync = None

    if connected:
        creds = await client.get_credentials()
        if creds:
            last_sync = creds.updated_at

    return {
        "success": True,
        "data": {
            "connected": connected,
            "last_sync": last_sync,
        },
    }


@router.get("/connect")
async def sage_connect(user: CurrentUser = Depends(require_ceo)):
    """Initiate the Sage OAuth2 authorization flow.

    Returns the authorization URL that the frontend should redirect the user to.
    CEO-only endpoint.
    """
    client = get_sage_client()
    authorization_url = client.build_authorization_url()

    return {
        "success": True,
        "data": {
            "authorization_url": authorization_url,
        },
    }


@router.get("/callback", response_class=HTMLResponse)
async def sage_callback(code: str = Query(..., description="OAuth2 authorization code")):
    """Handle the OAuth2 callback from Sage.

    This endpoint is called by Sage after the user authorizes the application.
    It exchanges the authorization code for access/refresh tokens and stores
    them in Firestore. No authentication is required because Sage redirects
    the browser here directly.
    """
    client = get_sage_client()

    try:
        await client.exchange_code(code)
    except RuntimeError as exc:
        logger.error("Sage OAuth2 callback failed: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))

    return HTMLResponse(
        content="""
        <!DOCTYPE html>
        <html>
        <head><title>Sage Connected</title></head>
        <body style="font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
            <div style="text-align: center;">
                <h1>Connected successfully!</h1>
                <p>Sage Business Cloud Accounting has been linked to FableDash.</p>
                <p>You can close this window.</p>
            </div>
        </body>
        </html>
        """,
        status_code=200,
    )


@router.post("/disconnect")
async def sage_disconnect(user: CurrentUser = Depends(require_ceo)):
    """Remove stored Sage credentials, disconnecting the integration.

    CEO-only endpoint.
    """
    try:
        db = get_firestore_client()
        from app.models.financial import SAGE_CREDENTIALS_COLLECTION

        db.collection(SAGE_CREDENTIALS_COLLECTION).document("current").delete()
        logger.info("Sage credentials removed by user %s", user.uid)
    except Exception:
        logger.exception("Failed to delete Sage credentials")
        raise HTTPException(status_code=500, detail="Failed to disconnect Sage")

    return {
        "success": True,
        "message": "Sage disconnected",
    }


@router.post("/sync")
async def sage_sync(
    full: bool = Query(False, description="Run a full sync (True) or incremental last-7-days sync (False)"),
    user: CurrentUser = Depends(require_ceo),
):
    """Trigger a manual sync of financial data from Sage.

    CEO-only endpoint.

    - ``full=False`` (default): incremental sync of the last 7 days.
    - ``full=True``: full sync of all invoices, payments, and creates a snapshot.
    """
    client = get_sage_client()
    if not await client.is_connected():
        raise HTTPException(status_code=400, detail="Sage is not connected")

    sync_service = SageSyncService(client)

    try:
        if full:
            result = await sync_service.full_sync()
        else:
            since = date.today() - timedelta(days=7)
            invoice_result = await sync_service.sync_invoices(since=since)
            payment_result = await sync_service.sync_payments(since=since)
            result = {
                "invoices": invoice_result,
                "payments": payment_result,
            }
    except Exception as exc:
        logger.exception("Sage sync failed")
        raise HTTPException(status_code=500, detail=f"Sync failed: {exc}")

    return {
        "success": True,
        "data": result,
    }


@router.get("/invoices")
async def list_invoices(
    status: str | None = Query(None, description="Filter by invoice status"),
    client_id: str | None = Query(None, description="Filter by client ID"),
    date_from: str | None = Query(None, description="Filter invoices issued on or after this date (YYYY-MM-DD)"),
    date_to: str | None = Query(None, description="Filter invoices issued on or before this date (YYYY-MM-DD)"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of invoices to return"),
    user: CurrentUser = Depends(get_current_user),
):
    """List synced invoices from Firestore.

    Supports filtering by status, client, and date range.
    """
    try:
        db = get_firestore_client()
        query = db.collection(INVOICES_COLLECTION)

        if status:
            query = query.where(filter=FieldFilter("status", "==", status))
        if client_id:
            query = query.where(filter=FieldFilter("client_id", "==", client_id))
        if date_from:
            query = query.where(filter=FieldFilter("issued_date", ">=", date_from))
        if date_to:
            query = query.where(filter=FieldFilter("issued_date", "<=", date_to))

        query = query.order_by("issued_date", direction="DESCENDING").limit(limit)

        docs = list(query.stream())
        invoices = [doc.to_dict() for doc in docs]

        return {
            "success": True,
            "data": invoices,
            "count": len(invoices),
        }
    except Exception as exc:
        logger.exception("Failed to list invoices")
        raise HTTPException(status_code=500, detail=f"Failed to list invoices: {exc}")


@router.get("/payments")
async def list_payments(
    date_from: str | None = Query(None, description="Filter payments on or after this date (YYYY-MM-DD)"),
    date_to: str | None = Query(None, description="Filter payments on or before this date (YYYY-MM-DD)"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of payments to return"),
    user: CurrentUser = Depends(get_current_user),
):
    """List synced payments from Firestore.

    Supports filtering by date range.
    """
    try:
        db = get_firestore_client()
        query = db.collection(PAYMENTS_COLLECTION)

        if date_from:
            query = query.where(filter=FieldFilter("payment_date", ">=", date_from))
        if date_to:
            query = query.where(filter=FieldFilter("payment_date", "<=", date_to))

        query = query.order_by("payment_date", direction="DESCENDING").limit(limit)

        docs = list(query.stream())
        payments = [doc.to_dict() for doc in docs]

        return {
            "success": True,
            "data": payments,
            "count": len(payments),
        }
    except Exception as exc:
        logger.exception("Failed to list payments")
        raise HTTPException(status_code=500, detail=f"Failed to list payments: {exc}")


@router.get("/snapshots")
async def list_snapshots(
    limit: int = Query(12, ge=1, le=60, description="Maximum number of snapshots to return"),
    user: CurrentUser = Depends(get_current_user),
):
    """List financial snapshots, most recent first.

    Returns up to ``limit`` snapshots ordered by creation date descending.
    """
    try:
        db = get_firestore_client()
        query = (
            db.collection(SNAPSHOTS_COLLECTION)
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
        )

        docs = list(query.stream())
        snapshots = [doc.to_dict() for doc in docs]

        return {
            "success": True,
            "data": snapshots,
            "count": len(snapshots),
        }
    except Exception as exc:
        logger.exception("Failed to list financial snapshots")
        raise HTTPException(status_code=500, detail=f"Failed to list snapshots: {exc}")
