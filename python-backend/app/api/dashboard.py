"""Dashboard summary endpoint — fetches all dashboard data in parallel.

Single endpoint that replaces 8 sequential frontend API calls with one
parallel server-side gather, dramatically reducing dashboard load time.
"""

import asyncio
import logging
from datetime import date

from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user
from app.models.client import COLLECTION_NAME as CLIENT_COLLECTION
from app.models.financial import (
    COLLECTION_NAME as FINANCIAL_COLLECTION,
    INVOICES_COLLECTION,
)
from app.models.meeting import COLLECTION_NAME as MEETINGS_COLLECTION
from app.models.time_log import COLLECTION_NAME as TIME_LOGS_COLLECTION
from app.models.user import CurrentUser
from app.utils.calendar_client import get_calendar_client
from app.utils.firebase_client import get_firestore_client
from app.utils.gmail_client import get_gmail_client
from app.utils.proactive_engine import ProactiveEngine

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Sync Firestore helpers (run in thread pool via asyncio.to_thread)
# ---------------------------------------------------------------------------


def _sync_financial(db) -> dict:
    """Latest financial snapshot + accounts receivable from invoices."""
    try:
        snap_docs = list(
            db.collection(FINANCIAL_COLLECTION)
            .order_by("period_end", direction="DESCENDING")
            .limit(1)
            .stream()
        )
        snapshot = snap_docs[0].to_dict() if snap_docs else None
    except Exception:
        logger.warning("dashboard: failed to fetch financial snapshot", exc_info=True)
        snapshot = None

    ar = 0.0
    try:
        for doc in db.collection(INVOICES_COLLECTION).stream():
            d = doc.to_dict()
            if d.get("status") in ("sent", "overdue"):
                ar += float(d.get("amount", 0))
    except Exception:
        logger.warning("dashboard: failed to fetch invoice AR", exc_info=True)

    return {"snapshot": snapshot, "accounts_receivable_live": ar}


def _sync_utilization(db) -> dict:
    """Utilization rate for the current calendar month."""
    try:
        month_start = date.today().replace(day=1).isoformat()
        docs = list(
            db.collection(TIME_LOGS_COLLECTION)
            .where("date", ">=", month_start)
            .stream()
        )
        total_min = 0
        billable_min = 0
        for doc in docs:
            d = doc.to_dict()
            mins = d.get("duration_minutes", 0)
            total_min += mins
            if d.get("is_billable"):
                billable_min += mins
        pct = round(billable_min / total_min * 100, 1) if total_min > 0 else 0.0
        return {
            "utilization_pct": pct,
            "total_hours": round(total_min / 60, 1),
            "billable_hours": round(billable_min / 60, 1),
        }
    except Exception:
        logger.warning("dashboard: failed to fetch utilization", exc_info=True)
        return {"utilization_pct": None}


def _sync_clients(db) -> dict:
    """Active client count."""
    try:
        docs = list(db.collection(CLIENT_COLLECTION).stream())
        active = sum(1 for d in docs if d.to_dict().get("is_active") is not False)
        return {"active_count": active}
    except Exception:
        logger.warning("dashboard: failed to fetch clients", exc_info=True)
        return {"active_count": None}


def _sync_recent_logs(db) -> list:
    """Five most recent time log entries with resolved client names."""
    try:
        client_map: dict[str, str] = {
            doc.id: (doc.to_dict().get("name") or "")
            for doc in db.collection(CLIENT_COLLECTION).stream()
        }
        docs = list(db.collection(TIME_LOGS_COLLECTION).stream())
        docs.sort(key=lambda d: d.to_dict().get("date", ""), reverse=True)
        result = []
        for doc in docs[:5]:
            d = doc.to_dict()
            result.append({
                "id": doc.id,
                "description": d.get("description", ""),
                "date": d.get("date", ""),
                "duration_minutes": d.get("duration_minutes", 0),
                "client_name": client_map.get(d.get("client_id", "")) or None,
            })
        return result
    except Exception:
        logger.warning("dashboard: failed to fetch recent logs", exc_info=True)
        return []


def _sync_internal_meetings(db) -> list:
    """Five most recent internal (Firestore) meetings."""
    try:
        docs = list(db.collection(MEETINGS_COLLECTION).stream())
        docs.sort(key=lambda d: d.to_dict().get("date", ""), reverse=True)
        result = []
        for doc in docs[:5]:
            d = doc.to_dict()
            d["id"] = doc.id
            result.append(d)
        return result
    except Exception:
        logger.warning("dashboard: failed to fetch internal meetings", exc_info=True)
        return []


# ---------------------------------------------------------------------------
# Async helpers (external integrations + proactive engine)
# ---------------------------------------------------------------------------


async def _fetch_calendar_meetings() -> dict:
    """Upcoming calendar meetings (next 7 days)."""
    client = get_calendar_client()
    if not client.is_configured():
        return {"configured": False, "meetings": [], "count": 0}
    try:
        meetings = await client.get_meetings(days_ahead=7, days_back=0)
        return {"configured": True, "meetings": meetings, "count": len(meetings)}
    except Exception:
        logger.warning("dashboard: calendar meetings failed", exc_info=True)
        return {"configured": True, "meetings": [], "count": 0}


async def _fetch_email_stats() -> dict:
    """Email stats + recent emails for the last 30 days."""
    client = get_gmail_client()
    if not client.is_configured():
        return {"configured": False}
    try:
        stats, recent = await asyncio.gather(
            client.get_email_stats(days=30),
            client.get_recent_emails(days=30, max_results=15),
            return_exceptions=True,
        )
        if isinstance(stats, Exception):
            stats = {"configured": True, "error": "Failed to fetch stats"}
        if isinstance(recent, Exception):
            recent = []
        result = dict(stats) if isinstance(stats, dict) else {"configured": True}
        result["recent_emails"] = recent if isinstance(recent, list) else []
        return result
    except Exception:
        logger.warning("dashboard: email stats failed", exc_info=True)
        return {"configured": True, "error": "Failed to fetch"}


async def _fetch_meeting_density() -> dict:
    """Meeting density metrics for the last 7 days."""
    client = get_calendar_client()
    if not client.is_configured():
        return {"configured": False}
    try:
        return await client.get_meeting_density(days=7)
    except Exception:
        logger.warning("dashboard: meeting density failed", exc_info=True)
        return {"configured": True}


async def _fetch_alerts(db) -> dict:
    """Run proactive intelligence checks."""
    try:
        engine = ProactiveEngine(db=db)
        return await engine.run_all_checks()
    except Exception:
        logger.warning("dashboard: proactive checks failed", exc_info=True)
        return {"alerts": [], "summary": {"total": 0, "high": 0, "medium": 0, "low": 0}}


# ---------------------------------------------------------------------------
# Summary endpoint
# ---------------------------------------------------------------------------


@router.get("/summary", response_model=dict)
async def dashboard_summary(
    user: CurrentUser = Depends(get_current_user),
):
    """Return all dashboard data in one parallel server-side fetch.

    Replaces 8 sequential frontend API calls with a single request that
    gathers financial, utilization, client, time log, calendar, email,
    meeting density, and alert data concurrently.
    """
    db = get_firestore_client()

    (
        financial,
        utilization,
        clients,
        recent_logs,
        internal_meetings,
        calendar_meetings,
        email_stats,
        meeting_density,
        alerts,
    ) = await asyncio.gather(
        asyncio.to_thread(_sync_financial, db),
        asyncio.to_thread(_sync_utilization, db),
        asyncio.to_thread(_sync_clients, db),
        asyncio.to_thread(_sync_recent_logs, db),
        asyncio.to_thread(_sync_internal_meetings, db),
        _fetch_calendar_meetings(),
        _fetch_email_stats(),
        _fetch_meeting_density(),
        _fetch_alerts(db),
        return_exceptions=True,
    )

    def _safe(val, default):
        if isinstance(val, Exception):
            logger.warning("dashboard: gather task raised %s", val)
            return default
        return val

    financial = _safe(financial, {"snapshot": None, "accounts_receivable_live": 0.0})
    utilization = _safe(utilization, {"utilization_pct": None})
    clients = _safe(clients, {"active_count": None})
    recent_logs = _safe(recent_logs, [])
    internal_meetings = _safe(internal_meetings, [])
    calendar_meetings = _safe(calendar_meetings, {"configured": False, "meetings": [], "count": 0})
    email_stats = _safe(email_stats, {"configured": False})
    meeting_density = _safe(meeting_density, {"configured": False})
    alerts = _safe(alerts, {"alerts": [], "summary": {"total": 0, "high": 0, "medium": 0, "low": 0}})

    snap = financial.get("snapshot") or {}

    return {
        "success": True,
        "data": {
            "metrics": {
                "revenue": snap.get("total_revenue"),
                "cash_position": snap.get("cash_on_hand"),
                "accounts_receivable": snap.get("accounts_receivable"),
                "accounts_payable": snap.get("accounts_payable"),
                "utilization_pct": utilization.get("utilization_pct"),
                "total_hours": utilization.get("total_hours"),
                "billable_hours": utilization.get("billable_hours"),
                "active_clients": clients.get("active_count"),
            },
            "recent_logs": recent_logs,
            "calendar_meetings": calendar_meetings,
            "email_stats": email_stats,
            "meeting_density": meeting_density,
            "internal_meetings": internal_meetings,
            "alerts": alerts,
        },
    }
