"""Report engine — operational efficiency, financial performance, process quality, and full health reports."""

import logging
from collections import defaultdict
from datetime import date, datetime, timedelta

from app.models.client import COLLECTION_NAME as CLIENT_COLLECTION, PartnerGroup
from app.models.financial import (
    COLLECTION_NAME as FINANCIAL_COLLECTION,
    INVOICES_COLLECTION,
)
from app.models.task import COLLECTION_NAME as TASK_COLLECTION, TaskStatus
from app.models.time_log import COLLECTION_NAME as TIME_LOG_COLLECTION
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)


class ReportEngine:
    """Core report engine for generating health and vitality reports."""

    def __init__(self):
        self.db = get_firestore_client()

    async def operational_efficiency(self, period_start: date, period_end: date) -> dict:
        """Calculate operational efficiency metrics for a given period.

        Returns utilization_rate, time_allocation_by_group, saturation_top5_clients,
        saturation_top5_tasks, avg_task_completion_time, and productivity_score.
        """
        start_str = period_start.isoformat()
        end_str = period_end.isoformat()

        # Fetch time logs for period
        tl_query = (
            self.db.collection(TIME_LOG_COLLECTION)
            .where("date", ">=", start_str)
            .where("date", "<=", end_str)
        )
        time_log_docs = list(tl_query.stream())

        # Fetch all clients for partner group mapping
        client_docs = list(self.db.collection(CLIENT_COLLECTION).stream())
        client_map: dict[str, dict] = {}
        for cdoc in client_docs:
            cdata = cdoc.to_dict()
            client_map[cdoc.id] = {
                "name": cdata.get("name", "Unknown"),
                "partner_group": cdata.get("partner_group", "direct_clients"),
            }

        # Fetch tasks for completion time calculation
        task_docs = list(self.db.collection(TASK_COLLECTION).stream())
        task_name_map: dict[str, str] = {}
        completed_task_durations: list[float] = []
        for tdoc in task_docs:
            tdata = tdoc.to_dict()
            task_name_map[tdoc.id] = tdata.get("title", "Unknown Task")
            # If task was completed within the period, calculate duration
            if tdata.get("status") == TaskStatus.DONE.value:
                created = tdata.get("created_at", "")
                updated = tdata.get("updated_at", "")
                if created and updated and created[:10] >= start_str and updated[:10] <= end_str:
                    try:
                        c_dt = datetime.fromisoformat(created)
                        u_dt = datetime.fromisoformat(updated)
                        days = (u_dt - c_dt).total_seconds() / 86400
                        if days >= 0:
                            completed_task_durations.append(round(days, 1))
                    except (ValueError, TypeError):
                        pass

        # Aggregate time logs
        total_minutes = 0
        billable_minutes = 0
        client_minutes: dict[str, int] = defaultdict(int)
        task_minutes: dict[str, dict] = defaultdict(lambda: {"minutes": 0, "client_id": ""})
        group_minutes: dict[str, int] = defaultdict(int)

        for doc in time_log_docs:
            data = doc.to_dict()
            minutes = data.get("duration_minutes", 0)
            is_billable = data.get("is_billable", True)
            client_id = data.get("client_id", "")
            task_id = data.get("task_id")

            total_minutes += minutes
            if is_billable:
                billable_minutes += minutes

            client_minutes[client_id] += minutes

            if task_id:
                task_minutes[task_id]["minutes"] += minutes
                task_minutes[task_id]["client_id"] = client_id

            partner_group = client_map.get(client_id, {}).get("partner_group", "direct_clients")
            group_minutes[partner_group] += minutes

        # Utilization rate
        utilization_rate = round((billable_minutes / total_minutes) * 100, 1) if total_minutes > 0 else 0.0

        # Time allocation by group
        all_groups = [pg.value for pg in PartnerGroup]
        time_allocation_by_group = {}
        for g in all_groups:
            g_min = group_minutes.get(g, 0)
            pct = round((g_min / total_minutes) * 100, 1) if total_minutes > 0 else 0.0
            time_allocation_by_group[g] = {
                "hours": round(g_min / 60, 1),
                "percentage": pct,
            }

        # Saturation top 5 clients
        sorted_clients = sorted(client_minutes.items(), key=lambda x: x[1], reverse=True)[:5]
        saturation_top5_clients = []
        for cid, mins in sorted_clients:
            info = client_map.get(cid, {"name": "Unknown"})
            saturation_top5_clients.append({
                "client_name": info["name"],
                "hours": round(mins / 60, 1),
                "percentage": round((mins / total_minutes) * 100, 1) if total_minutes > 0 else 0.0,
            })

        # Saturation top 5 tasks
        sorted_tasks = sorted(task_minutes.items(), key=lambda x: x[1]["minutes"], reverse=True)[:5]
        saturation_top5_tasks = []
        for tid, stats in sorted_tasks:
            saturation_top5_tasks.append({
                "task_name": task_name_map.get(tid, "Unknown Task"),
                "client_name": client_map.get(stats["client_id"], {}).get("name", "Unknown"),
                "hours": round(stats["minutes"] / 60, 1),
                "percentage": round((stats["minutes"] / total_minutes) * 100, 1) if total_minutes > 0 else 0.0,
            })

        # Average task completion time
        avg_task_completion_time = (
            round(sum(completed_task_durations) / len(completed_task_durations), 1)
            if completed_task_durations
            else None
        )

        # Productivity score (composite: weighted utilization + completion rate)
        total_tasks = len(task_docs)
        completed_tasks = sum(
            1 for tdoc in task_docs if tdoc.to_dict().get("status") == TaskStatus.DONE.value
        )
        completion_rate = round((completed_tasks / total_tasks) * 100, 1) if total_tasks > 0 else 0.0
        # Weighted: 60% utilization + 40% completion rate
        productivity_score = round(utilization_rate * 0.6 + completion_rate * 0.4, 1)

        return {
            "total_hours": round(total_minutes / 60, 1),
            "billable_hours": round(billable_minutes / 60, 1),
            "utilization_rate": utilization_rate,
            "time_allocation_by_group": time_allocation_by_group,
            "saturation_top5_clients": saturation_top5_clients,
            "saturation_top5_tasks": saturation_top5_tasks,
            "avg_task_completion_days": avg_task_completion_time,
            "productivity_score": productivity_score,
            "completion_rate": completion_rate,
        }

    async def financial_performance(self, period_start: date, period_end: date) -> dict:
        """Calculate financial performance metrics for a given period.

        Returns revenue, expenses, net profit, cash position, and cost-benefit rankings.
        """
        start_str = period_start.isoformat()
        end_str = period_end.isoformat()

        # Fetch financial snapshots for period
        snapshots = []
        try:
            snap_query = (
                self.db.collection(FINANCIAL_COLLECTION)
                .where("period_start", ">=", start_str)
                .where("period_start", "<=", end_str)
                .order_by("period_start", direction="ASCENDING")
            )
            snapshots = [doc.to_dict() for doc in snap_query.stream()]
        except Exception:
            logger.exception("Failed to fetch financial snapshots for report")

        total_revenue = sum(s.get("total_revenue", 0) for s in snapshots)
        total_expenses = sum(s.get("total_expenses", 0) for s in snapshots)
        net_profit = total_revenue - total_expenses
        latest_cash = snapshots[-1].get("cash_on_hand", 0) if snapshots else 0

        # Invoice analysis
        try:
            inv_docs = list(self.db.collection(INVOICES_COLLECTION).stream())
        except Exception:
            logger.exception("Failed to fetch invoices for report")
            inv_docs = []

        period_invoices = []
        for doc in inv_docs:
            data = doc.to_dict()
            issued = data.get("issued_date", "")
            if issued >= start_str and issued <= end_str:
                period_invoices.append(data)

        paid_count = sum(1 for inv in period_invoices if inv.get("status") == "paid")
        total_inv_count = len(period_invoices)
        collection_rate = round((paid_count / total_inv_count) * 100, 1) if total_inv_count > 0 else 0.0

        # Cost-benefit: revenue per client
        client_revenue: dict[str, float] = defaultdict(float)
        for inv in period_invoices:
            if inv.get("status") == "paid":
                cid = inv.get("client_id", "")
                if cid:
                    client_revenue[cid] += float(inv.get("amount", 0))

        # Fetch time logs for hours-per-client
        tl_query = (
            self.db.collection(TIME_LOG_COLLECTION)
            .where("date", ">=", start_str)
            .where("date", "<=", end_str)
        )
        client_hours: dict[str, float] = defaultdict(float)
        for doc in tl_query.stream():
            data = doc.to_dict()
            cid = data.get("client_id", "")
            if cid:
                client_hours[cid] += data.get("duration_minutes", 0) / 60

        # Client name map
        client_docs = list(self.db.collection(CLIENT_COLLECTION).stream())
        client_name_map = {cdoc.id: cdoc.to_dict().get("name", "Unknown") for cdoc in client_docs}

        # Build cost-benefit rankings (top 5 by ZAR/hr)
        cost_benefit_rankings = []
        for cid in set(client_revenue.keys()) | set(client_hours.keys()):
            rev = client_revenue.get(cid, 0.0)
            hrs = client_hours.get(cid, 0.0)
            zar_per_hour = round(rev / hrs, 2) if hrs > 0 else 0.0
            cost_benefit_rankings.append({
                "client_name": client_name_map.get(cid, "Unknown"),
                "revenue": round(rev, 2),
                "hours": round(hrs, 1),
                "zar_per_hour": zar_per_hour,
            })
        cost_benefit_rankings.sort(key=lambda x: x["zar_per_hour"], reverse=True)
        cost_benefit_rankings = cost_benefit_rankings[:5]

        return {
            "total_revenue": round(total_revenue, 2),
            "total_expenses": round(total_expenses, 2),
            "net_profit": round(net_profit, 2),
            "profit_margin": round((net_profit / total_revenue) * 100, 1) if total_revenue > 0 else 0.0,
            "cash_position": round(latest_cash, 2),
            "invoice_count": total_inv_count,
            "collection_rate": collection_rate,
            "cost_benefit_rankings": cost_benefit_rankings,
        }

    async def process_quality(self, period_start: date, period_end: date) -> dict:
        """Calculate process quality metrics for a given period.

        Returns task completion rates, overdue rate, meeting-to-action ratio,
        and time entry consistency.
        """
        start_str = period_start.isoformat()
        end_str = period_end.isoformat()

        # Fetch all tasks
        task_docs = list(self.db.collection(TASK_COLLECTION).stream())

        total_tasks = 0
        completed_tasks = 0
        overdue_tasks = 0

        for tdoc in task_docs:
            tdata = tdoc.to_dict()
            created = tdata.get("created_at", "")
            # Count tasks created during period
            if created and created[:10] >= start_str and created[:10] <= end_str:
                total_tasks += 1
                if tdata.get("status") == TaskStatus.DONE.value:
                    completed_tasks += 1
                # Overdue: has due_date in the past, not done
                due = tdata.get("due_date")
                if due and tdata.get("status") != TaskStatus.DONE.value:
                    due_str = due[:10] if isinstance(due, str) else str(due)[:10]
                    if due_str < end_str:
                        overdue_tasks += 1

        completion_rate = round((completed_tasks / total_tasks) * 100, 1) if total_tasks > 0 else 0.0
        overdue_rate = round((overdue_tasks / total_tasks) * 100, 1) if total_tasks > 0 else 0.0

        # Time entry consistency: check for gaps in logged days
        tl_query = (
            self.db.collection(TIME_LOG_COLLECTION)
            .where("date", ">=", start_str)
            .where("date", "<=", end_str)
        )
        time_log_docs = list(tl_query.stream())
        logged_dates = set()
        for doc in time_log_docs:
            data = doc.to_dict()
            d = data.get("date", "")
            if d:
                logged_dates.add(d)

        # Count weekdays in period
        current = period_start
        weekday_count = 0
        while current <= period_end:
            if current.weekday() < 5:  # Monday=0 through Friday=4
                weekday_count += 1
            current += timedelta(days=1)

        days_with_entries = len(logged_dates)
        time_entry_consistency = (
            round((days_with_entries / weekday_count) * 100, 1) if weekday_count > 0 else 0.0
        )

        # Meeting-to-action ratio (meetings collection -> tasks created)
        meeting_count = 0
        try:
            meeting_query = (
                self.db.collection("meetings")
                .where("date", ">=", start_str)
                .where("date", "<=", end_str)
            )
            meeting_count = len(list(meeting_query.stream()))
        except Exception:
            logger.warning("Failed to fetch meetings for process quality report")

        meeting_to_action_ratio = (
            round(total_tasks / meeting_count, 1) if meeting_count > 0 else None
        )

        return {
            "total_tasks_created": total_tasks,
            "tasks_completed": completed_tasks,
            "completion_rate": completion_rate,
            "overdue_tasks": overdue_tasks,
            "overdue_rate": overdue_rate,
            "time_entry_consistency": time_entry_consistency,
            "weekdays_in_period": weekday_count,
            "days_with_entries": days_with_entries,
            "meeting_count": meeting_count,
            "meeting_to_action_ratio": meeting_to_action_ratio,
            "total_time_entries": len(time_log_docs),
        }

    async def full_health_report(self, period_start: date, period_end: date) -> dict:
        """Generate a comprehensive health and vitality report combining all sections.

        Returns operational efficiency, financial performance, and process quality
        in a single response.
        """
        operational = await self.operational_efficiency(period_start, period_end)
        financial = await self.financial_performance(period_start, period_end)
        process = await self.process_quality(period_start, period_end)

        return {
            "period": {
                "start": period_start.isoformat(),
                "end": period_end.isoformat(),
            },
            "operational_efficiency": operational,
            "financial_performance": financial,
            "process_quality": process,
        }


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_engine: ReportEngine | None = None


def get_report_engine() -> ReportEngine:
    """Return the singleton ReportEngine instance, creating it on first call."""
    global _engine
    if _engine is None:
        _engine = ReportEngine()
    return _engine
