"""OpsAI Engine — unified conversational query layer across all FableDash data sources.

Uses OpenAI function calling to dynamically select data-retrieval tools based on the
CEO's natural-language question, queries Firestore, and generates a human-friendly answer.
"""

import json
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from openai import AsyncOpenAI

from app.config import get_settings
from app.models.client import COLLECTION_NAME as CLIENTS_COLLECTION
from app.models.financial import (
    COLLECTION_NAME as FINANCIAL_SNAPSHOTS_COLLECTION,
    INVOICES_COLLECTION,
)
from app.models.meeting import COLLECTION_NAME as MEETINGS_COLLECTION
from app.models.task import COLLECTION_NAME as TASKS_COLLECTION
from app.models.time_log import COLLECTION_NAME as TIME_LOGS_COLLECTION
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OpenAI function-tool schemas
# ---------------------------------------------------------------------------

OPSAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_utilization",
            "description": "Get team utilization data (billable vs total hours) for a date range from time logs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date_from": {
                        "type": "string",
                        "description": "Start date in YYYY-MM-DD format.",
                    },
                    "date_to": {
                        "type": "string",
                        "description": "End date in YYYY-MM-DD format.",
                    },
                },
                "required": ["date_from", "date_to"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_revenue",
            "description": "Get revenue data from financial snapshots and invoices for a given period (e.g. '2026-02' or 'latest').",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {
                        "type": "string",
                        "description": "Period string such as 'latest', 'YYYY-MM', or 'YYYY'.",
                    },
                },
                "required": ["period"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_client_info",
            "description": "Look up a client by name and return their details, linked tasks, and recent time logs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_name": {
                        "type": "string",
                        "description": "Full or partial client name to search for.",
                    },
                },
                "required": ["client_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_meetings",
            "description": "Get meetings from the last N days, including summaries and action items.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {
                        "type": "integer",
                        "description": "Number of days to look back. Defaults to 7.",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_overdue_tasks",
            "description": "Get all tasks that are overdue (due date in the past and not done).",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_cash_position",
            "description": "Get the latest cash-on-hand, accounts receivable, and accounts payable from financial snapshots.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_top_clients",
            "description": "Get the top clients ranked by a given metric (revenue or hours) with an optional limit.",
            "parameters": {
                "type": "object",
                "properties": {
                    "metric": {
                        "type": "string",
                        "enum": ["revenue", "hours"],
                        "description": "Metric to rank clients by.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Number of top clients to return. Defaults to 5.",
                    },
                },
                "required": ["metric"],
            },
        },
    },
]


class OpsAIEngine:
    """Conversational intelligence engine that queries FableDash data via OpenAI function calling.

    Workflow:
        1. ``query_data`` sends the user's question to OpenAI with function tools.
        2. OpenAI selects which tool(s) to call and provides arguments.
        3. The engine executes the corresponding Firestore queries.
        4. ``generate_answer`` produces a natural-language response from the data.
        5. ``ask`` orchestrates the full pipeline and returns a structured result.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.db = get_firestore_client()
        self._openai: AsyncOpenAI | None = None

        if settings.OPENAI_API_KEY:
            self._openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        else:
            logger.warning("OPENAI_API_KEY not configured — OpsAI engine AI features disabled")

    @property
    def openai_configured(self) -> bool:
        """Whether an OpenAI client is available."""
        return self._openai is not None

    def _require_openai(self) -> AsyncOpenAI:
        """Return the OpenAI client or raise if unavailable."""
        if self._openai is None:
            raise RuntimeError("OpenAI API key is not configured")
        return self._openai

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

    async def _tool_get_top_clients(self, metric: str, limit: int = 5) -> dict:
        """Return top clients ranked by *metric* (revenue or hours)."""
        try:
            # Build client name map
            client_map: dict[str, str] = {}
            for doc in self.db.collection(CLIENTS_COLLECTION).stream():
                client_map[doc.id] = doc.to_dict().get("name", "Unknown")

            if metric == "revenue":
                # Aggregate paid invoice amounts by client
                totals: dict[str, float] = defaultdict(float)
                for doc in self.db.collection(INVOICES_COLLECTION).stream():
                    data = doc.to_dict()
                    if data.get("status") == "paid":
                        cid = data.get("client_id", "")
                        if cid:
                            totals[cid] += float(data.get("amount", 0))

                ranked = sorted(totals.items(), key=lambda x: x[1], reverse=True)[:limit]
                return {
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
                for doc in self.db.collection(TIME_LOGS_COLLECTION).stream():
                    data = doc.to_dict()
                    cid = data.get("client_id", "")
                    if cid:
                        totals_min[cid] += data.get("duration_minutes", 0)

                ranked = sorted(totals_min.items(), key=lambda x: x[1], reverse=True)[:limit]
                return {
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
        except Exception:
            logger.exception("OpsAI: get_top_clients failed")
            return {"error": "Failed to query top clients"}

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
        """Send the question to OpenAI with function tools and execute selected tools.

        Returns:
            Dict with ``results`` (tool name -> output) and ``tools_used`` list.
        """
        client = self._require_openai()

        messages = [
            {
                "role": "system",
                "content": (
                    "You are OpsAI, the data-query planner for FableDash — a CEO operations intelligence hub. "
                    "Given the user's question, decide which data-retrieval tool(s) to call. "
                    "You may call multiple tools if the question spans several data domains. "
                    "Today's date is " + date.today().isoformat() + ". "
                    "All currency values are in South African Rand (ZAR)."
                ),
            },
            {"role": "user", "content": question},
        ]

        completion = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=OPSAI_TOOLS,
            tool_choice="auto",
            temperature=0.1,
        )

        response_message = completion.choices[0].message
        tool_calls = response_message.tool_calls

        if not tool_calls:
            # No tools selected — OpenAI answered directly
            return {
                "results": {"direct_answer": response_message.content or ""},
                "tools_used": [],
            }

        # Execute each tool call
        results: dict = {}
        tools_used: list[str] = []

        for tool_call in tool_calls:
            fn_name = tool_call.function.name
            try:
                fn_args = json.loads(tool_call.function.arguments)
            except json.JSONDecodeError:
                fn_args = {}

            tools_used.append(fn_name)
            result = await self._execute_tool(fn_name, fn_args)
            results[fn_name] = result

        return {"results": results, "tools_used": tools_used}

    async def generate_answer(self, question: str, data: dict) -> str:
        """Use OpenAI to produce a natural-language answer from queried data.

        Args:
            question: The original user question.
            data: Dict of tool results from ``query_data``.

        Returns:
            A formatted, human-friendly answer string.
        """
        client = self._require_openai()

        # Check if there's a direct answer (no tools were called)
        if "direct_answer" in data.get("results", {}):
            return data["results"]["direct_answer"]

        data_text = json.dumps(data.get("results", {}), indent=2, default=str)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are OpsAI, the conversational intelligence assistant for FableDash — "
                    "a CEO operations hub for a South African creative agency. "
                    "Answer the CEO's question using the data provided. "
                    "Be concise, professional, and actionable. "
                    "Format currency as ZAR with thousands separators (e.g. R 125,000.00). "
                    "Use bullet points for lists. Highlight key insights and risks. "
                    "If data is missing or unavailable, say so clearly."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Question: {question}\n\n"
                    f"Data from FableDash:\n{data_text}"
                ),
            },
        ]

        completion = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.3,
            max_tokens=2000,
        )
        return completion.choices[0].message.content or "I couldn't generate an answer from the available data."

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
    "get_utilization": OpsAIEngine._tool_get_utilization,
    "get_revenue": OpsAIEngine._tool_get_revenue,
    "get_client_info": OpsAIEngine._tool_get_client_info,
    "get_recent_meetings": OpsAIEngine._tool_get_recent_meetings,
    "get_overdue_tasks": OpsAIEngine._tool_get_overdue_tasks,
    "get_cash_position": OpsAIEngine._tool_get_cash_position,
    "get_top_clients": OpsAIEngine._tool_get_top_clients,
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
