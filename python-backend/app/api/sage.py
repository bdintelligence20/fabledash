"""Sage Business Cloud Accounting connection management endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse

from app.dependencies.auth import get_current_user, require_ceo
from app.models.user import CurrentUser
from app.utils.firebase_client import get_firestore_client
from app.utils.sage_client import get_sage_client

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
async def sage_sync(user: CurrentUser = Depends(require_ceo)):
    """Trigger a manual sync of financial data from Sage.

    CEO-only endpoint. This is a placeholder that will be fully
    implemented in plan 06-02.
    """
    return {
        "success": True,
        "message": "Sync started",
    }
