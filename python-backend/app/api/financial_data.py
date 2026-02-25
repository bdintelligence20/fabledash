"""Aggregated financial data API endpoints — summary, revenue trends, cost-benefit, volume-rate."""

import logging
import statistics
from collections import defaultdict
from datetime import date, timedelta

import firebase_admin
from fastapi import APIRouter, Depends, Query
from google.cloud.firestore_v1 import FieldFilter

from app.dependencies.auth import get_current_user
from app.models.client import COLLECTION_NAME as CLIENT_COLLECTION
from app.models.financial import (
    COLLECTION_NAME,
    FORECAST_COLLECTION,
    INVOICES_COLLECTION,
    PNL_COLLECTION,
    SAGE_CREDENTIALS_COLLECTION,
)
from app.models.time_log import COLLECTION_NAME as TIME_LOG_COLLECTION
from app.models.user import CurrentUser
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/summary")
async def financial_summary(
    period: str | None = Query(None, description="Filter by period (e.g. 2026-02)"),
    user: CurrentUser = Depends(get_current_user),
):
    """Aggregated financial overview.

    Returns the latest snapshot, invoice statistics, most recent P&L upload,
    latest revenue forecast, and Sage connection status.
    """
    db = get_firestore_client()

    # 1. Latest financial snapshot (most recent by period_end)
    snapshot = None
    try:
        snap_query = db.collection(COLLECTION_NAME).order_by(
            "period_end", direction="DESCENDING"
        )
        if period:
            snap_query = snap_query.where(
                filter=FieldFilter("period_end", ">=", period)
            )
        snap_query = snap_query.limit(1)
        snap_docs = list(snap_query.stream())
        if snap_docs:
            snapshot = snap_docs[0].to_dict()
    except Exception:
        logger.exception("Failed to fetch latest financial snapshot")

    # 2. Invoice stats: count by status, totals
    invoices_summary = {
        "total": 0,
        "paid": 0,
        "outstanding": 0,
        "overdue": 0,
        "total_revenue": 0.0,
        "total_outstanding_amount": 0.0,
    }
    try:
        inv_docs = list(db.collection(INVOICES_COLLECTION).stream())
        for doc in inv_docs:
            data = doc.to_dict()
            status = data.get("status", "")
            amount = float(data.get("amount", 0))
            invoices_summary["total"] += 1

            if status == "paid":
                invoices_summary["paid"] += 1
                invoices_summary["total_revenue"] += amount
            elif status == "overdue":
                invoices_summary["overdue"] += 1
                invoices_summary["outstanding"] += 1
                invoices_summary["total_outstanding_amount"] += amount
            elif status in ("draft", "sent"):
                invoices_summary["outstanding"] += 1
                invoices_summary["total_outstanding_amount"] += amount
    except Exception:
        logger.exception("Failed to compute invoice statistics")

    # 3. Latest P&L upload for the period
    pnl_summary = None
    try:
        pnl_query = db.collection(PNL_COLLECTION).order_by(
            "uploaded_at", direction="DESCENDING"
        )
        if period:
            pnl_query = pnl_query.where(filter=FieldFilter("period", "==", period))
        pnl_query = pnl_query.limit(1)
        pnl_docs = list(pnl_query.stream())
        if pnl_docs:
            pnl_data = pnl_docs[0].to_dict()
            pnl_summary = {
                "id": pnl_data.get("id"),
                "filename": pnl_data.get("filename"),
                "period": pnl_data.get("period"),
                "row_count": len(pnl_data.get("rows", [])),
                "uploaded_at": pnl_data.get("uploaded_at"),
            }
    except Exception:
        logger.exception("Failed to fetch latest P&L upload")

    # 4. Latest revenue forecast
    forecast_summary = None
    try:
        fc_query = (
            db.collection(FORECAST_COLLECTION)
            .order_by("uploaded_at", direction="DESCENDING")
            .limit(1)
        )
        fc_docs = list(fc_query.stream())
        if fc_docs:
            fc_data = fc_docs[0].to_dict()
            forecast_summary = {
                "id": fc_data.get("id"),
                "filename": fc_data.get("filename"),
                "forecast_date": fc_data.get("forecast_date"),
                "entry_count": len(fc_data.get("entries", [])),
                "uploaded_at": fc_data.get("uploaded_at"),
            }
    except Exception:
        logger.exception("Failed to fetch latest revenue forecast")

    # 5. Sage connection status
    sage_connected = False
    try:
        if firebase_admin._apps:
            cred_doc = (
                db.collection(SAGE_CREDENTIALS_COLLECTION).document("current").get()
            )
            sage_connected = cred_doc.exists
    except Exception:
        logger.exception("Failed to check Sage connection status")

    return {
        "success": True,
        "data": {
            "snapshot": snapshot,
            "invoices": invoices_summary,
            "pnl": pnl_summary,
            "forecast": forecast_summary,
            "sage_connected": sage_connected,
        },
    }


@router.get("/revenue-trend")
async def revenue_trend(
    months: int = Query(6, ge=1, le=24, description="Number of months of trend data"),
    user: CurrentUser = Depends(get_current_user),
):
    """Monthly revenue trend over the last N months.

    Returns an array of period-level revenue, expenses, and net profit data
    from financial snapshots.
    """
    db = get_firestore_client()

    # Calculate the start date (N months ago)
    today = date.today()
    start_date = today.replace(day=1)
    # Walk back N months
    for _ in range(months):
        start_date = (start_date - timedelta(days=1)).replace(day=1)

    start_str = start_date.isoformat()

    trend_data: list[dict] = []
    try:
        query = (
            db.collection(COLLECTION_NAME)
            .where(filter=FieldFilter("period_start", ">=", start_str))
            .order_by("period_start", direction="ASCENDING")
        )
        docs = list(query.stream())
        for doc in docs:
            data = doc.to_dict()
            trend_data.append(
                {
                    "period": data.get("period_start", "")[:7],  # YYYY-MM
                    "revenue": data.get("total_revenue", 0),
                    "expenses": data.get("total_expenses", 0),
                    "net_profit": data.get("net_profit", 0),
                    "cash_on_hand": data.get("cash_on_hand", 0),
                }
            )
    except Exception:
        logger.exception("Failed to fetch revenue trend data")

    return {
        "success": True,
        "data": trend_data,
    }


@router.get("/cost-benefit")
async def cost_benefit(
    date_from: date | None = Query(None, description="Start of period (inclusive)"),
    date_to: date | None = Query(None, description="End of period (inclusive)"),
    user: CurrentUser = Depends(get_current_user),
):
    """Client cost-benefit analysis — ZAR per hour rankings.

    Calculates revenue-per-hour for each client, identifies pass-through
    projects (revenue > 0 but < 2 hours logged), and returns clients sorted
    by ZAR/Hr descending.
    """
    db = get_firestore_client()

    try:
        # 1. Fetch all clients
        client_docs = list(db.collection(CLIENT_COLLECTION).stream())
        client_map: dict[str, dict] = {}
        for cdoc in client_docs:
            cdata = cdoc.to_dict()
            client_map[cdoc.id] = {
                "name": cdata.get("name", "Unknown Client"),
                "partner_group": cdata.get("partner_group", "direct_clients"),
            }

        # 2. Fetch paid invoices within date range — accumulate revenue by client_id
        inv_query = db.collection(INVOICES_COLLECTION).where("status", "==", "paid")
        if date_from:
            inv_query = inv_query.where("issued_date", ">=", date_from.isoformat())
        if date_to:
            inv_query = inv_query.where("issued_date", "<=", date_to.isoformat())

        revenue_by_client: dict[str, float] = defaultdict(float)
        invoice_count_by_client: dict[str, int] = defaultdict(int)
        for doc in inv_query.stream():
            data = doc.to_dict()
            cid = data.get("client_id", "")
            if cid:
                revenue_by_client[cid] += float(data.get("amount", 0))
                invoice_count_by_client[cid] += 1

        # 3. Fetch time logs within date range — accumulate hours by client_id
        tl_query = db.collection(TIME_LOG_COLLECTION)
        if date_from:
            tl_query = tl_query.where("date", ">=", date_from.isoformat())
        if date_to:
            tl_query = tl_query.where("date", "<=", date_to.isoformat())

        minutes_by_client: dict[str, int] = defaultdict(int)
        for doc in tl_query.stream():
            data = doc.to_dict()
            cid = data.get("client_id", "")
            if cid:
                minutes_by_client[cid] += data.get("duration_minutes", 0)

        # 4. Build per-client cost-benefit rows
        all_client_ids = set(revenue_by_client.keys()) | set(minutes_by_client.keys())

        clients_list: list[dict] = []
        total_revenue = 0.0
        total_hours = 0.0
        pass_through_count = 0
        pass_through_revenue = 0.0

        for cid in all_client_ids:
            revenue = revenue_by_client.get(cid, 0.0)
            minutes = minutes_by_client.get(cid, 0)
            hours = round(minutes / 60, 1)
            inv_count = invoice_count_by_client.get(cid, 0)

            # Pass-through: revenue > 0 but very low hours (< 2)
            is_pass_through = revenue > 0 and hours < 2

            if hours > 0 and not is_pass_through:
                zar_per_hour = round(revenue / hours, 2)
            else:
                zar_per_hour = 0.0

            client_info = client_map.get(cid, {"name": "Unknown Client", "partner_group": "direct_clients"})

            clients_list.append({
                "client_id": cid,
                "client_name": client_info["name"],
                "partner_group": client_info["partner_group"],
                "total_revenue": round(revenue, 2),
                "total_hours": hours,
                "zar_per_hour": zar_per_hour,
                "invoice_count": inv_count,
                "is_pass_through": is_pass_through,
            })

            total_revenue += revenue
            total_hours += hours
            if is_pass_through:
                pass_through_count += 1
                pass_through_revenue += revenue

        # 5. Sort by zar_per_hour descending (pass-through at the end)
        clients_list.sort(
            key=lambda c: (not c["is_pass_through"], c["zar_per_hour"]),
            reverse=True,
        )

        average_zar_per_hour = round(total_revenue / total_hours, 2) if total_hours > 0 else 0.0

        return {
            "success": True,
            "data": {
                "clients": clients_list,
                "summary": {
                    "total_revenue": round(total_revenue, 2),
                    "total_hours": round(total_hours, 1),
                    "average_zar_per_hour": average_zar_per_hour,
                    "pass_through_count": pass_through_count,
                    "pass_through_revenue": round(pass_through_revenue, 2),
                },
            },
        }

    except Exception:
        logger.exception("Failed to compute cost-benefit analysis")
        return {"success": False, "error": "Failed to compute cost-benefit analysis"}


@router.get("/volume-rate")
async def volume_rate(
    date_from: date | None = Query(None, description="Start of period (inclusive)"),
    date_to: date | None = Query(None, description="End of period (inclusive)"),
    user: CurrentUser = Depends(get_current_user),
):
    """Volume vs rate analysis — classifies clients into quadrants by hours and ZAR/hr.

    Calculates total hours (volume) and ZAR per hour (rate) for each client,
    then classifies into four quadrants using median thresholds:
    - high_volume_high_rate (stars)
    - high_volume_low_rate (compression risk)
    - low_volume_high_rate (efficient)
    - low_volume_low_rate (review needed)
    """
    db = get_firestore_client()

    try:
        # 1. Fetch all clients
        client_docs = list(db.collection(CLIENT_COLLECTION).stream())
        client_map: dict[str, dict] = {}
        for cdoc in client_docs:
            cdata = cdoc.to_dict()
            client_map[cdoc.id] = {
                "name": cdata.get("name", "Unknown Client"),
                "partner_group": cdata.get("partner_group", "direct_clients"),
            }

        # 2. Fetch paid invoices within date range — accumulate revenue by client_id
        inv_query = db.collection(INVOICES_COLLECTION).where("status", "==", "paid")
        if date_from:
            inv_query = inv_query.where("issued_date", ">=", date_from.isoformat())
        if date_to:
            inv_query = inv_query.where("issued_date", "<=", date_to.isoformat())

        revenue_by_client: dict[str, float] = defaultdict(float)
        for doc in inv_query.stream():
            data = doc.to_dict()
            cid = data.get("client_id", "")
            if cid:
                revenue_by_client[cid] += float(data.get("amount", 0))

        # 3. Fetch time logs within date range — accumulate hours by client_id
        tl_query = db.collection(TIME_LOG_COLLECTION)
        if date_from:
            tl_query = tl_query.where("date", ">=", date_from.isoformat())
        if date_to:
            tl_query = tl_query.where("date", "<=", date_to.isoformat())

        minutes_by_client: dict[str, int] = defaultdict(int)
        for doc in tl_query.stream():
            data = doc.to_dict()
            cid = data.get("client_id", "")
            if cid:
                minutes_by_client[cid] += data.get("duration_minutes", 0)

        # 4. Build per-client rows (only clients with hours > 0)
        all_client_ids = set(revenue_by_client.keys()) | set(minutes_by_client.keys())

        clients_list: list[dict] = []
        hours_values: list[float] = []
        rate_values: list[float] = []

        for cid in all_client_ids:
            revenue = revenue_by_client.get(cid, 0.0)
            minutes = minutes_by_client.get(cid, 0)
            hours = round(minutes / 60, 1)

            if hours <= 0:
                continue

            zar_per_hour = round(revenue / hours, 2)
            client_info = client_map.get(
                cid, {"name": "Unknown Client", "partner_group": "direct_clients"}
            )

            clients_list.append({
                "client_id": cid,
                "client_name": client_info["name"],
                "total_hours": hours,
                "zar_per_hour": zar_per_hour,
                "total_revenue": round(revenue, 2),
                "classification": "",  # filled after medians
            })
            hours_values.append(hours)
            rate_values.append(zar_per_hour)

        # 5. Calculate medians
        median_hours = (
            round(statistics.median(hours_values), 1) if hours_values else 0.0
        )
        median_rate = (
            round(statistics.median(rate_values), 2) if rate_values else 0.0
        )

        # 6. Classify into quadrants
        quadrant_counts = {
            "high_volume_high_rate": 0,
            "high_volume_low_rate": 0,
            "low_volume_high_rate": 0,
            "low_volume_low_rate": 0,
        }

        for client in clients_list:
            high_vol = client["total_hours"] > median_hours
            high_rate = client["zar_per_hour"] > median_rate

            if high_vol and high_rate:
                classification = "high_volume_high_rate"
            elif high_vol and not high_rate:
                classification = "high_volume_low_rate"
            elif not high_vol and high_rate:
                classification = "low_volume_high_rate"
            else:
                classification = "low_volume_low_rate"

            client["classification"] = classification
            quadrant_counts[classification] += 1

        # 7. Sort by revenue descending
        clients_list.sort(key=lambda c: c["total_revenue"], reverse=True)

        return {
            "success": True,
            "data": {
                "clients": clients_list,
                "medians": {
                    "hours": median_hours,
                    "zar_per_hour": median_rate,
                },
                "quadrant_counts": quadrant_counts,
            },
        }

    except Exception:
        logger.exception("Failed to compute volume-rate analysis")
        return {"success": False, "error": "Failed to compute volume-rate analysis"}
