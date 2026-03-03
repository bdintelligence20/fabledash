"""OpsAI Engine — unified conversational query layer across all FableDash data sources.

Uses Google Gemini function calling to dynamically select data-retrieval tools based on the
CEO's natural-language question, queries Firestore, and generates a human-friendly answer.
"""

import json
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

import google.generativeai as genai

from app.config import get_settings
from app.models.agent import COLLECTION_NAME as AGENTS_COLLECTION
from app.models.client import COLLECTION_NAME as CLIENTS_COLLECTION
from app.models.document import COLLECTION_NAME as DOCUMENTS_COLLECTION
from app.models.financial import (
    COLLECTION_NAME as FINANCIAL_SNAPSHOTS_COLLECTION,
    FORECAST_COLLECTION,
    INVOICES_COLLECTION,
    PNL_COLLECTION,
)
from app.models.meeting import COLLECTION_NAME as MEETINGS_COLLECTION
from app.models.task import COLLECTION_NAME as TASKS_COLLECTION
from app.models.time_log import COLLECTION_NAME as TIME_LOGS_COLLECTION
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Gemini function-tool declarations
# ---------------------------------------------------------------------------

OPSAI_FUNCTION_DECLARATIONS = [
    genai.protos.FunctionDeclaration(
        name="get_utilization",
        description="Get team utilization data (billable vs total hours) for a date range from time logs.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "date_from": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="Start date in YYYY-MM-DD format.",
                ),
                "date_to": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="End date in YYYY-MM-DD format.",
                ),
            },
            required=["date_from", "date_to"],
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="get_revenue",
        description="Get revenue data from financial snapshots and invoices for a given period (e.g. '2026-02' or 'latest').",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "period": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="Period string such as 'latest', 'YYYY-MM', or 'YYYY'.",
                ),
            },
            required=["period"],
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="get_client_info",
        description="Look up a client by name and return their details, linked tasks, and recent time logs.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "client_name": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="Full or partial client name to search for.",
                ),
            },
            required=["client_name"],
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="get_recent_meetings",
        description="Get meetings from the last N days, including summaries and action items.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "days": genai.protos.Schema(
                    type=genai.protos.Type.INTEGER,
                    description="Number of days to look back. Defaults to 7.",
                ),
            },
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="get_overdue_tasks",
        description="Get all tasks that are overdue (due date in the past and not done).",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={},
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="get_cash_position",
        description="Get the latest cash-on-hand, accounts receivable, and accounts payable from financial snapshots.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={},
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="get_top_clients",
        description="Get the top clients ranked by a given metric (revenue or hours) with an optional date range and limit.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "metric": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="Metric to rank clients by. Must be 'revenue' or 'hours'.",
                ),
                "limit": genai.protos.Schema(
                    type=genai.protos.Type.INTEGER,
                    description="Number of top clients to return. Defaults to 5.",
                ),
                "date_from": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="Start date filter in YYYY-MM-DD format (inclusive). Use first day of month for 'this month' or 'last month' queries.",
                ),
                "date_to": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="End date filter in YYYY-MM-DD format (inclusive). Use last day of month for 'this month' or 'last month' queries.",
                ),
            },
            required=["metric"],
        ),
    ),
    # --- Integration data tools (Calendar, Gmail, Drive via Composio) ---
    genai.protos.FunctionDeclaration(
        name="get_upcoming_calendar_events",
        description="Get upcoming calendar meetings for the next N days from Google Calendar.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "days_ahead": genai.protos.Schema(
                    type=genai.protos.Type.INTEGER,
                    description="Number of days to look ahead. Defaults to 7.",
                ),
            },
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="get_email_stats",
        description="Get email communication statistics (sent, received, top correspondents) from Gmail for the last N days.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "days": genai.protos.Schema(
                    type=genai.protos.Type.INTEGER,
                    description="Number of days to look back. Defaults to 30.",
                ),
            },
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="get_client_emails",
        description="Get emails exchanged with a specific client email address from Gmail in the last N days.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "client_email": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="The client's email address to search for.",
                ),
                "days": genai.protos.Schema(
                    type=genai.protos.Type.INTEGER,
                    description="Number of days to look back. Defaults to 30.",
                ),
            },
            required=["client_email"],
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="get_drive_files",
        description="Search for files in Google Drive matching a query string.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "query": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="Search query to find files by name or content.",
                ),
            },
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="get_client_drive_files",
        description="Get files from a specific client's Google Drive folder.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "client_name": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="Client name to search for files.",
                ),
            },
            required=["client_name"],
        ),
    ),
    # --- New Firestore data tools ---
    genai.protos.FunctionDeclaration(
        name="get_pnl_data",
        description="Get P&L (profit and loss) data from uploaded financial documents. Shows actuals vs forecasts, revenue, expenses, and net profit.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "limit": genai.protos.Schema(
                    type=genai.protos.Type.INTEGER,
                    description="Number of most recent P&L uploads to return. Defaults to 3.",
                ),
            },
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="get_revenue_forecast",
        description="Get the 90-day revenue forecast from uploaded forecast documents. Shows projected revenue pipeline.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "limit": genai.protos.Schema(
                    type=genai.protos.Type.INTEGER,
                    description="Number of most recent forecasts to return. Defaults to 1.",
                ),
            },
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="get_task_overview",
        description="Get a broad task overview including counts by status, blocked tasks, tasks by client, and upcoming deadlines.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "client_name": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="Optional client name to filter tasks for a specific client.",
                ),
            },
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="get_partner_group_allocation",
        description="Get time allocation breakdown by partner group (Collab, EDCP, Direct Clients, Separate Businesses) for a date range.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "date_from": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="Start date in YYYY-MM-DD format.",
                ),
                "date_to": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="End date in YYYY-MM-DD format.",
                ),
            },
            required=["date_from", "date_to"],
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="get_agent_status",
        description="Get the status of all AI agents — their tier, active/paused state, assigned client, and conversation count.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "tier": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="Filter by tier: 'ops_traffic' or 'client_based'. Omit for all agents.",
                ),
            },
        ),
    ),
    genai.protos.FunctionDeclaration(
        name="search_documents",
        description="Search uploaded documents and knowledge base using semantic search. Finds relevant content from PDFs, briefs, contracts, and other uploaded files.",
        parameters=genai.protos.Schema(
            type=genai.protos.Type.OBJECT,
            properties={
                "query": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="The search query to find relevant document content.",
                ),
                "client_name": genai.protos.Schema(
                    type=genai.protos.Type.STRING,
                    description="Optional client name to scope the search to a specific client's documents.",
                ),
            },
            required=["query"],
        ),
    ),
]

OPSAI_TOOLS = [genai.protos.Tool(function_declarations=OPSAI_FUNCTION_DECLARATIONS)]


class OpsAIEngine:
    """Conversational intelligence engine that queries FableDash data via Gemini function calling.

    Workflow:
        1. ``query_data`` sends the user's question to Gemini with function tools.
        2. Gemini selects which tool(s) to call and provides arguments.
        3. The engine executes the corresponding Firestore queries.
        4. ``generate_answer`` produces a natural-language response from the data.
        5. ``ask`` orchestrates the full pipeline and returns a structured result.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.db = get_firestore_client()
        self._gemini_configured = False
        self._api_key = settings.GEMINI_API_KEY or settings.GOOGLE_AI_API_KEY

        if self._api_key:
            genai.configure(api_key=self._api_key)
            self._gemini_configured = True
        else:
            logger.warning("Gemini API key not configured — OpsAI engine AI features disabled")

    @property
    def openai_configured(self) -> bool:
        """Whether an AI client is available. Kept for backwards compatibility."""
        return self._gemini_configured

    def _require_gemini(self) -> None:
        """Raise if Gemini is not configured."""
        if not self._gemini_configured:
            raise RuntimeError("Gemini API key is not configured")

    # ------------------------------------------------------------------
    # Tool implementations — each returns a JSON-serialisable dict
    # ------------------------------------------------------------------

    async def _tool_get_utilization(self, date_from: str, date_to: str) -> dict:
        """Query time logs between *date_from* and *date_to*, returning utilization stats."""
        try:
            query = self.db.collection(TIME_LOGS_COLLECTION)
            if date_from:
                query = query.where("date", ">=", date_from)
            if date_to:
                query = query.where("date", "<=", date_to)

            total_minutes = 0
            billable_minutes = 0
            entries = 0
            by_client: dict[str, int] = defaultdict(int)

            for doc in query.stream():
                data = doc.to_dict()
                duration = data.get("duration_minutes", 0)
                total_minutes += duration
                entries += 1
                if data.get("is_billable", True):
                    billable_minutes += duration
                cid = data.get("client_id", "unknown")
                by_client[cid] += duration

            total_hours = round(total_minutes / 60, 1)
            billable_hours = round(billable_minutes / 60, 1)
            utilization_pct = round((billable_minutes / total_minutes * 100), 1) if total_minutes > 0 else 0.0

            return {
                "date_from": date_from,
                "date_to": date_to,
                "total_hours": total_hours,
                "billable_hours": billable_hours,
                "non_billable_hours": round(total_hours - billable_hours, 1),
                "utilization_percent": utilization_pct,
                "entry_count": entries,
                "top_clients_by_minutes": dict(sorted(by_client.items(), key=lambda x: x[1], reverse=True)[:5]),
            }
        except Exception:
            logger.exception("OpsAI: get_utilization failed")
            return {"error": "Failed to query utilization data"}

    async def _tool_get_revenue(self, period: str) -> dict:
        """Query financial snapshots and invoices for *period*."""
        try:
            # Latest snapshot
            snap_query = (
                self.db.collection(FINANCIAL_SNAPSHOTS_COLLECTION)
                .order_by("period_end", direction="DESCENDING")
            )
            if period and period != "latest":
                snap_query = snap_query.where("period_start", ">=", period)
            snap_query = snap_query.limit(1)

            snapshot = None
            for doc in snap_query.stream():
                snapshot = doc.to_dict()

            # Invoice summary
            inv_query = self.db.collection(INVOICES_COLLECTION)
            total_invoiced = 0.0
            paid_amount = 0.0
            outstanding_amount = 0.0
            invoice_count = 0

            for doc in inv_query.stream():
                data = doc.to_dict()
                amount = float(data.get("amount", 0))
                status = data.get("status", "")
                invoice_count += 1
                total_invoiced += amount
                if status == "paid":
                    paid_amount += amount
                elif status in ("draft", "sent", "overdue"):
                    outstanding_amount += amount

            result: dict = {
                "period": period,
                "invoice_count": invoice_count,
                "total_invoiced_zar": round(total_invoiced, 2),
                "paid_zar": round(paid_amount, 2),
                "outstanding_zar": round(outstanding_amount, 2),
            }

            if snapshot:
                result["snapshot"] = {
                    "total_revenue": snapshot.get("total_revenue", 0),
                    "total_expenses": snapshot.get("total_expenses", 0),
                    "net_profit": snapshot.get("net_profit", 0),
                    "period_start": snapshot.get("period_start", ""),
                    "period_end": snapshot.get("period_end", ""),
                }

            return result
        except Exception:
            logger.exception("OpsAI: get_revenue failed")
            return {"error": "Failed to query revenue data"}

    async def _tool_get_client_info(self, client_name: str) -> dict:
        """Look up a client by name (case-insensitive substring match)."""
        try:
            search_lower = client_name.lower()
            matched_client = None
            matched_id = None

            for doc in self.db.collection(CLIENTS_COLLECTION).stream():
                data = doc.to_dict()
                name = data.get("name", "")
                if search_lower in name.lower():
                    matched_client = data
                    matched_id = doc.id
                    break

            if not matched_client:
                return {"error": f"No client found matching '{client_name}'"}

            # Fetch linked tasks
            tasks: list[dict] = []
            try:
                task_query = (
                    self.db.collection(TASKS_COLLECTION)
                    .where("client_id", "==", matched_id)
                    .limit(10)
                )
                for doc in task_query.stream():
                    t = doc.to_dict()
                    tasks.append({
                        "title": t.get("title", ""),
                        "status": t.get("status", ""),
                        "priority": t.get("priority", ""),
                        "due_date": str(t.get("due_date", "")),
                    })
            except Exception:
                logger.warning("OpsAI: failed to fetch tasks for client %s", matched_id)

            # Fetch recent time logs
            recent_hours = 0
            try:
                tl_query = (
                    self.db.collection(TIME_LOGS_COLLECTION)
                    .where("client_id", "==", matched_id)
                    .order_by("date", direction="DESCENDING")
                    .limit(20)
                )
                for doc in tl_query.stream():
                    recent_hours += doc.to_dict().get("duration_minutes", 0)
                recent_hours = round(recent_hours / 60, 1)
            except Exception:
                logger.warning("OpsAI: failed to fetch time logs for client %s", matched_id)

            return {
                "client_id": matched_id,
                "name": matched_client.get("name", ""),
                "partner_group": matched_client.get("partner_group", ""),
                "contact_email": matched_client.get("contact_email", ""),
                "is_active": matched_client.get("is_active", True),
                "task_count": len(tasks),
                "tasks": tasks,
                "recent_logged_hours": recent_hours,
            }
        except Exception:
            logger.exception("OpsAI: get_client_info failed")
            return {"error": "Failed to query client information"}

    async def _tool_get_recent_meetings(self, days: int = 7) -> dict:
        """Return meetings from the last *days* days."""
        try:
            days = int(days)
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")

            meetings: list[dict] = []
            for doc in self.db.collection(MEETINGS_COLLECTION).stream():
                data = doc.to_dict()
                meeting_date = data.get("date", "")
                if isinstance(meeting_date, str) and meeting_date >= cutoff:
                    meetings.append({
                        "title": data.get("title", ""),
                        "date": meeting_date,
                        "participants": data.get("participants", []),
                        "client_name": data.get("client_name", ""),
                        "summary": data.get("summary", ""),
                        "action_items": data.get("action_items", []),
                        "key_topics": data.get("key_topics", []),
                    })

            meetings.sort(key=lambda m: m["date"], reverse=True)

            return {
                "days": days,
                "count": len(meetings),
                "meetings": meetings[:20],
            }
        except Exception:
            logger.exception("OpsAI: get_recent_meetings failed")
            return {"error": "Failed to query recent meetings"}

    async def _tool_get_overdue_tasks(self) -> dict:
        """Return all tasks where due_date < today and status != done."""
        try:
            now = datetime.now(timezone.utc)
            today = now.replace(hour=0, minute=0, second=0, microsecond=0)

            overdue: list[dict] = []
            for doc in self.db.collection(TASKS_COLLECTION).stream():
                task = doc.to_dict()
                due_date = task.get("due_date")
                status = task.get("status", "")

                if not due_date or status == "done":
                    continue

                if isinstance(due_date, str):
                    try:
                        due_dt = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        continue
                elif isinstance(due_date, datetime):
                    due_dt = due_date if due_date.tzinfo else due_date.replace(tzinfo=timezone.utc)
                else:
                    continue

                if due_dt < today:
                    overdue.append({
                        "task_id": doc.id,
                        "title": task.get("title", ""),
                        "status": status,
                        "priority": task.get("priority", ""),
                        "due_date": due_dt.strftime("%Y-%m-%d"),
                        "assigned_to": task.get("assigned_to", ""),
                        "client_id": task.get("client_id", ""),
                    })

            overdue.sort(key=lambda t: t["due_date"])

            return {
                "count": len(overdue),
                "tasks": overdue,
            }
        except Exception:
            logger.exception("OpsAI: get_overdue_tasks failed")
            return {"error": "Failed to query overdue tasks"}

    async def _tool_get_cash_position(self) -> dict:
        """Return the latest cash-on-hand, AR, AP from financial snapshots."""
        try:
            snap_query = (
                self.db.collection(FINANCIAL_SNAPSHOTS_COLLECTION)
                .order_by("period_end", direction="DESCENDING")
                .limit(1)
            )
            for doc in snap_query.stream():
                data = doc.to_dict()
                return {
                    "cash_on_hand_zar": data.get("cash_on_hand", 0),
                    "accounts_receivable_zar": data.get("accounts_receivable", 0),
                    "accounts_payable_zar": data.get("accounts_payable", 0),
                    "net_profit_zar": data.get("net_profit", 0),
                    "total_revenue_zar": data.get("total_revenue", 0),
                    "total_expenses_zar": data.get("total_expenses", 0),
                    "period_start": data.get("period_start", ""),
                    "period_end": data.get("period_end", ""),
                }
            return {"message": "No financial snapshots available"}
        except Exception:
            logger.exception("OpsAI: get_cash_position failed")
            return {"error": "Failed to query cash position"}

    async def _tool_get_top_clients(
        self,
        metric: str,
        limit: int = 5,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict:
        """Return top clients ranked by *metric* (revenue or hours), with optional date range."""
        try:
            limit = int(limit)  # Gemini sometimes sends integers as strings
        except (TypeError, ValueError):
            limit = 5

        try:
            # Build client name map
            client_map: dict[str, str] = {}
            for doc in self.db.collection(CLIENTS_COLLECTION).stream():
                client_map[doc.id] = doc.to_dict().get("name", "Unknown")

            if metric == "revenue":
                # Aggregate paid invoice amounts by client
                totals: dict[str, float] = defaultdict(float)
                query = self.db.collection(INVOICES_COLLECTION)
                for doc in query.stream():
                    data = doc.to_dict()
                    if data.get("status") == "paid":
                        # Apply date filter on invoice date if provided
                        inv_date = data.get("date", data.get("issue_date", ""))
                        if date_from and inv_date and str(inv_date) < date_from:
                            continue
                        if date_to and inv_date and str(inv_date) > date_to:
                            continue
                        cid = data.get("client_id", "")
                        if cid:
                            totals[cid] += float(data.get("amount", 0))

                ranked = sorted(totals.items(), key=lambda x: x[1], reverse=True)[:limit]
                result = {
                    "metric": "revenue",
                    "clients": [
                        {
                            "client_id": cid,
                            "client_name": client_map.get(cid, "Unknown"),
                            "total_revenue_zar": round(val, 2),
                        }
                        for cid, val in ranked
                    ],
                }

            else:  # hours
                totals_min: dict[str, int] = defaultdict(int)
                query = self.db.collection(TIME_LOGS_COLLECTION)
                if date_from:
                    query = query.where("date", ">=", date_from)
                if date_to:
                    query = query.where("date", "<=", date_to)
                for doc in query.stream():
                    data = doc.to_dict()
                    cid = data.get("client_id", "")
                    if cid:
                        totals_min[cid] += int(data.get("duration_minutes", 0))

                ranked = sorted(totals_min.items(), key=lambda x: x[1], reverse=True)[:limit]
                result = {
                    "metric": "hours",
                    "clients": [
                        {
                            "client_id": cid,
                            "client_name": client_map.get(cid, "Unknown"),
                            "total_hours": round(val / 60, 1),
                        }
                        for cid, val in ranked
                    ],
                }

            if date_from or date_to:
                result["period"] = {"date_from": date_from, "date_to": date_to}
            return result

        except Exception:
            logger.exception("OpsAI: get_top_clients failed")
            return {"error": "Failed to query top clients"}

    # ------------------------------------------------------------------
    # Integration tools (Calendar, Gmail, Drive via Composio)
    # ------------------------------------------------------------------

    async def _tool_get_upcoming_calendar_events(self, days_ahead: int = 7) -> dict:
        """Fetch upcoming meetings from Google Calendar."""
        try:
            days_ahead = int(days_ahead)
            from app.utils.calendar_client import get_calendar_client

            cal = get_calendar_client()
            if not cal.is_configured():
                return {"error": "Google Calendar not configured"}
            meetings = await cal.get_meetings(days_ahead=days_ahead, days_back=0)
            return {
                "count": len(meetings),
                "meetings": [
                    {
                        "summary": m.get("summary", "Untitled"),
                        "start": m.get("start", ""),
                        "end": m.get("end", ""),
                        "attendee_count": m.get("attendee_count", 0),
                    }
                    for m in meetings[:20]
                ],
            }
        except Exception:
            logger.exception("OpsAI: get_upcoming_calendar_events failed")
            return {"error": "Failed to fetch calendar events"}

    async def _tool_get_email_stats(self, days: int = 30) -> dict:
        """Fetch email statistics from Gmail."""
        try:
            days = int(days)
            from app.utils.gmail_client import get_gmail_client

            gmail = get_gmail_client()
            if not gmail.is_configured():
                return {"error": "Gmail not configured"}
            stats = await gmail.get_email_stats(days=days)
            return stats
        except Exception:
            logger.exception("OpsAI: get_email_stats failed")
            return {"error": "Failed to fetch email stats"}

    async def _tool_get_client_emails(self, client_email: str, days: int = 30) -> dict:
        """Fetch emails with a specific client from Gmail."""
        try:
            days = int(days)
            from app.utils.gmail_client import get_gmail_client

            gmail = get_gmail_client()
            if not gmail.is_configured():
                return {"error": "Gmail not configured"}
            emails = await gmail.get_client_emails(client_email, days=days)
            return {"count": len(emails), "emails": emails[:20]}
        except Exception:
            logger.exception("OpsAI: get_client_emails failed")
            return {"error": "Failed to fetch client emails"}

    async def _tool_get_drive_files(self, query: str = "") -> dict:
        """Search files in Google Drive."""
        try:
            from app.utils.gdrive_client import get_gdrive_client

            drive = get_gdrive_client()
            if not drive.is_configured():
                return {"error": "Google Drive not configured"}
            files = await drive.list_files(query=query or None)
            return {
                "count": len(files),
                "files": [
                    {
                        "name": f.get("name", ""),
                        "mimeType": f.get("mimeType", ""),
                        "modifiedTime": f.get("modifiedTime", ""),
                        "webViewLink": f.get("webViewLink", ""),
                    }
                    for f in files[:20]
                ],
            }
        except Exception:
            logger.exception("OpsAI: get_drive_files failed")
            return {"error": "Failed to search Drive files"}

    async def _tool_get_client_drive_files(self, client_name: str) -> dict:
        """Fetch files from a client's Drive folder."""
        try:
            from app.utils.gdrive_client import get_gdrive_client

            drive = get_gdrive_client()
            if not drive.is_configured():
                return {"error": "Google Drive not configured"}
            result = await drive.get_client_files(client_name)
            files = result.get("files", [])
            return {
                "client_name": client_name,
                "count": len(files),
                "files": [
                    {
                        "name": f.get("name", ""),
                        "mimeType": f.get("mimeType", ""),
                        "modifiedTime": f.get("modifiedTime", ""),
                    }
                    for f in files[:20]
                ],
            }
        except Exception:
            logger.exception("OpsAI: get_client_drive_files failed")
            return {"error": "Failed to fetch client Drive files"}

    # ------------------------------------------------------------------
    # New Firestore data tools
    # ------------------------------------------------------------------

    async def _tool_get_pnl_data(self, limit: int = 3) -> dict:
        """Return recent P&L uploads (actuals vs forecasts)."""
        try:
            limit = int(limit)
            docs = list(self.db.collection(PNL_COLLECTION).stream())
            docs.sort(key=lambda d: d.to_dict().get("uploaded_at", ""), reverse=True)
            docs = docs[:limit]
            results = []
            for doc in docs:
                data = doc.to_dict()
                results.append({
                    "id": doc.id,
                    "period": data.get("period", ""),
                    "uploaded_at": str(data.get("uploaded_at", "")),
                    "total_revenue": data.get("total_revenue"),
                    "total_expenses": data.get("total_expenses"),
                    "net_profit": data.get("net_profit"),
                    "gross_margin_pct": data.get("gross_margin_pct"),
                    "notes": data.get("notes", ""),
                    "rows": data.get("rows", [])[:20],
                })
            if not results:
                return {"message": "No P&L data uploaded yet"}
            return {"count": len(results), "pnl_uploads": results}
        except Exception:
            logger.exception("OpsAI: get_pnl_data failed")
            return {"error": "Failed to query P&L data"}

    async def _tool_get_revenue_forecast(self, limit: int = 1) -> dict:
        """Return recent revenue forecast documents."""
        try:
            limit = int(limit)
            docs = list(self.db.collection(FORECAST_COLLECTION).stream())
            docs.sort(key=lambda d: d.to_dict().get("uploaded_at", ""), reverse=True)
            docs = docs[:limit]
            results = []
            for doc in docs:
                data = doc.to_dict()
                results.append({
                    "id": doc.id,
                    "period_start": str(data.get("period_start", "")),
                    "period_end": str(data.get("period_end", "")),
                    "uploaded_at": str(data.get("uploaded_at", "")),
                    "total_forecast_revenue": data.get("total_forecast_revenue"),
                    "notes": data.get("notes", ""),
                    "rows": data.get("rows", [])[:20],
                })
            if not results:
                return {"message": "No revenue forecast data uploaded yet"}
            return {"count": len(results), "forecasts": results}
        except Exception:
            logger.exception("OpsAI: get_revenue_forecast failed")
            return {"error": "Failed to query revenue forecast"}

    async def _tool_get_task_overview(self, client_name: str = "") -> dict:
        """Return task counts by status, blocked tasks, and upcoming deadlines."""
        try:
            today_str = date.today().isoformat()
            status_counts: dict[str, int] = defaultdict(int)
            overdue: list[dict] = []
            due_soon: list[dict] = []
            blocked: list[dict] = []

            client_id_filter: str | None = None
            if client_name:
                for doc in self.db.collection(CLIENTS_COLLECTION).stream():
                    if client_name.lower() in doc.to_dict().get("name", "").lower():
                        client_id_filter = doc.id
                        break

            query = self.db.collection(TASKS_COLLECTION)
            if client_id_filter:
                query = query.where("client_id", "==", client_id_filter)

            for doc in query.stream():
                data = doc.to_dict()
                status = data.get("status", "unknown")
                status_counts[status] += 1
                due_date = data.get("due_date", "")

                if isinstance(due_date, str) and due_date:
                    if due_date < today_str and status not in ("done", "cancelled"):
                        overdue.append({
                            "title": data.get("title", ""),
                            "status": status,
                            "due_date": due_date,
                            "priority": data.get("priority", ""),
                        })
                    elif today_str <= due_date <= (date.today() + timedelta(days=7)).isoformat():
                        due_soon.append({
                            "title": data.get("title", ""),
                            "status": status,
                            "due_date": due_date,
                        })

                if status == "blocked":
                    blocked.append({"title": data.get("title", ""), "priority": data.get("priority", "")})

            return {
                "client_filter": client_name or "all",
                "total_tasks": sum(status_counts.values()),
                "status_breakdown": dict(status_counts),
                "overdue_count": len(overdue),
                "overdue_tasks": overdue[:10],
                "due_within_7_days": due_soon[:10],
                "blocked_tasks": blocked[:10],
            }
        except Exception:
            logger.exception("OpsAI: get_task_overview failed")
            return {"error": "Failed to query task overview"}

    async def _tool_get_partner_group_allocation(self, date_from: str, date_to: str) -> dict:
        """Return time allocation breakdown by partner group."""
        try:
            # Build client → partner_group map
            client_group: dict[str, str] = {}
            for doc in self.db.collection(CLIENTS_COLLECTION).stream():
                data = doc.to_dict()
                client_group[doc.id] = data.get("partner_group", "unknown")

            group_minutes: dict[str, int] = defaultdict(int)
            total_minutes = 0

            query = self.db.collection(TIME_LOGS_COLLECTION)
            if date_from:
                query = query.where("date", ">=", date_from)
            if date_to:
                query = query.where("date", "<=", date_to)

            for doc in query.stream():
                data = doc.to_dict()
                dur = data.get("duration_minutes", 0)
                cid = data.get("client_id", "")
                group = client_group.get(cid, "no_client")
                group_minutes[group] += dur
                total_minutes += dur

            if total_minutes == 0:
                return {"message": "No time logs found for this date range", "date_from": date_from, "date_to": date_to}

            allocation = []
            for group, minutes in sorted(group_minutes.items(), key=lambda x: x[1], reverse=True):
                allocation.append({
                    "partner_group": group,
                    "hours": round(minutes / 60, 1),
                    "percentage": round(minutes / total_minutes * 100, 1),
                })

            return {
                "date_from": date_from,
                "date_to": date_to,
                "total_hours": round(total_minutes / 60, 1),
                "allocation": allocation,
            }
        except Exception:
            logger.exception("OpsAI: get_partner_group_allocation failed")
            return {"error": "Failed to query partner group allocation"}

    async def _tool_get_agent_status(self, tier: str = "") -> dict:
        """Return current agent status across the agent ecosystem."""
        try:
            query = self.db.collection(AGENTS_COLLECTION)
            if tier:
                query = query.where("tier", "==", tier)

            agents = []
            for doc in query.stream():
                data = doc.to_dict()
                agents.append({
                    "id": doc.id,
                    "name": data.get("name", ""),
                    "tier": data.get("tier", ""),
                    "status": data.get("status", ""),
                    "client_name": data.get("client_name", ""),
                    "model": data.get("model", ""),
                    "conversation_count": data.get("conversation_count", 0),
                    "data_sources": data.get("data_sources", []),
                })

            status_summary = defaultdict(int)
            for a in agents:
                status_summary[a["status"]] += 1

            return {
                "total_agents": len(agents),
                "status_summary": dict(status_summary),
                "agents": agents[:20],
            }
        except Exception:
            logger.exception("OpsAI: get_agent_status failed")
            return {"error": "Failed to query agent status"}

    async def _tool_search_documents(self, query: str, client_name: str = "") -> dict:
        """Search the RAG vector store for relevant document content."""
        try:
            from app.utils.rag_engine import get_rag_engine
            rag = get_rag_engine()

            client_id: str | None = None
            if client_name:
                for doc in self.db.collection(CLIENTS_COLLECTION).stream():
                    if client_name.lower() in doc.to_dict().get("name", "").lower():
                        client_id = doc.id
                        break

            context = await rag.retrieve_context(
                query=query,
                client_id=client_id,
                top_k=5,
            )
            if not context:
                return {"message": "No relevant documents found", "query": query}
            return {
                "query": query,
                "client_filter": client_name or "all",
                "context": context,
            }
        except Exception:
            logger.exception("OpsAI: search_documents failed")
            return {"error": "Document search unavailable"}

    # ------------------------------------------------------------------
    # Tool dispatch
    # ------------------------------------------------------------------

    _TOOL_MAP: dict  # populated at class level below

    async def _execute_tool(self, name: str, arguments: dict) -> dict:
        """Execute a tool by name with the given arguments and return results."""
        handler = self._TOOL_MAP.get(name)
        if handler is None:
            return {"error": f"Unknown tool: {name}"}
        return await handler(self, **arguments)

    # ------------------------------------------------------------------
    # Core pipeline
    # ------------------------------------------------------------------

    async def query_data(self, question: str) -> dict:
        """Send the question to Gemini with function tools and execute selected tools.

        Returns:
            Dict with ``results`` (tool name -> output) and ``tools_used`` list.
        """
        self._require_gemini()

        system_instruction = (
            "You are OpsAI, the data-query planner for FableDash — a CEO operations intelligence hub for a South African creative agency. "
            "Given the user's question, decide which data-retrieval tool(s) to call. "
            "Call MULTIPLE tools when the question spans several data domains — don't be conservative. "
            "You have access to ALL of these data sources:\n"
            "- BUSINESS DATA: time_logs (utilization, hours by client/group), financial_snapshots (revenue, cash, P&L), "
            "invoices (outstanding, paid), pnl_uploads (monthly actuals vs forecasts), revenue_forecasts (90-day pipeline), "
            "clients (details, partner groups), tasks (status, overdue, blocked), meetings (transcripts, action items), "
            "agents (AI agent ecosystem status), documents (uploaded knowledge base via RAG search)\n"
            "- LIVE INTEGRATIONS: Google Calendar (upcoming meetings), Gmail (email stats, client emails), "
            "Google Drive (files, client folders)\n"
            "Today's date is " + date.today().isoformat() + ". "
            "All currency values are in South African Rand (ZAR). "
            "When uncertain which tool to use, call all plausibly relevant ones."
        )

        model = genai.GenerativeModel(
            "gemini-2.5-flash",
            system_instruction=system_instruction,
            tools=OPSAI_TOOLS,
        )

        response = await model.generate_content_async(
            question,
            generation_config=genai.GenerationConfig(temperature=0.1),
        )

        # Check if Gemini wants to call functions
        function_calls = []
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if part.function_call and part.function_call.name:
                    function_calls.append(part.function_call)

        if not function_calls:
            # No tools selected — Gemini answered directly
            direct_text = ""
            try:
                direct_text = response.text
            except (ValueError, AttributeError):
                if response.candidates and response.candidates[0].content.parts:
                    for part in response.candidates[0].content.parts:
                        if hasattr(part, 'text') and part.text:
                            direct_text = part.text
                            break
            return {
                "results": {"direct_answer": direct_text or ""},
                "tools_used": [],
            }

        # Execute each function call
        results: dict = {}
        tools_used: list[str] = []

        for fc in function_calls:
            fn_name = fc.name
            fn_args = dict(fc.args) if fc.args else {}

            tools_used.append(fn_name)
            result = await self._execute_tool(fn_name, fn_args)
            results[fn_name] = result

        return {"results": results, "tools_used": tools_used}

    async def generate_answer(self, question: str, data: dict) -> str:
        """Use Gemini to produce a natural-language answer from queried data.

        Args:
            question: The original user question.
            data: Dict of tool results from ``query_data``.

        Returns:
            A formatted, human-friendly answer string.
        """
        self._require_gemini()

        # Check if there's a direct answer (no tools were called)
        if "direct_answer" in data.get("results", {}):
            return data["results"]["direct_answer"]

        data_text = json.dumps(data.get("results", {}), indent=2, default=str)

        system_instruction = (
            "You are OpsAI, the conversational intelligence assistant for FableDash — "
            "a CEO operations hub for a South African creative agency. "
            "Answer the CEO's question using the data provided. "
            "Be concise, professional, and actionable. "
            "Format currency as ZAR with thousands separators (e.g. R 125,000.00). "
            "Use bullet points for lists. Highlight key insights and risks. "
            "If data is missing or unavailable, say so clearly."
        )

        model = genai.GenerativeModel(
            "gemini-2.5-flash",
            system_instruction=system_instruction,
        )

        prompt = (
            f"Question: {question}\n\n"
            f"Data from FableDash:\n{data_text}"
        )

        response = await model.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.3,
                max_output_tokens=2000,
            ),
        )
        return response.text or "I couldn't generate an answer from the available data."

    async def ask(self, question: str) -> dict:
        """Full OpsAI pipeline: query relevant data, then generate an answer.

        Args:
            question: Natural-language question from the CEO.

        Returns:
            Dict with ``answer``, ``data_sources``, and ``query_tools_used``.
        """
        data = await self.query_data(question)
        answer = await self.generate_answer(question, data)

        return {
            "answer": answer,
            "data_sources": list(data.get("results", {}).keys()),
            "query_tools_used": data.get("tools_used", []),
        }


# Bind tool implementations to names
OpsAIEngine._TOOL_MAP = {
    # Core Firestore tools
    "get_utilization": OpsAIEngine._tool_get_utilization,
    "get_revenue": OpsAIEngine._tool_get_revenue,
    "get_client_info": OpsAIEngine._tool_get_client_info,
    "get_recent_meetings": OpsAIEngine._tool_get_recent_meetings,
    "get_overdue_tasks": OpsAIEngine._tool_get_overdue_tasks,
    "get_cash_position": OpsAIEngine._tool_get_cash_position,
    "get_top_clients": OpsAIEngine._tool_get_top_clients,
    # New Firestore tools
    "get_pnl_data": OpsAIEngine._tool_get_pnl_data,
    "get_revenue_forecast": OpsAIEngine._tool_get_revenue_forecast,
    "get_task_overview": OpsAIEngine._tool_get_task_overview,
    "get_partner_group_allocation": OpsAIEngine._tool_get_partner_group_allocation,
    "get_agent_status": OpsAIEngine._tool_get_agent_status,
    "search_documents": OpsAIEngine._tool_search_documents,
    # Integration tools (Calendar, Gmail, Drive via Composio)
    "get_upcoming_calendar_events": OpsAIEngine._tool_get_upcoming_calendar_events,
    "get_email_stats": OpsAIEngine._tool_get_email_stats,
    "get_client_emails": OpsAIEngine._tool_get_client_emails,
    "get_drive_files": OpsAIEngine._tool_get_drive_files,
    "get_client_drive_files": OpsAIEngine._tool_get_client_drive_files,
}


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_engine: OpsAIEngine | None = None


def get_opsai_engine() -> OpsAIEngine:
    """Return the singleton OpsAIEngine instance, creating it on first call."""
    global _engine
    if _engine is None:
        _engine = OpsAIEngine()
    return _engine
