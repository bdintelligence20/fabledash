"""Report Engine — comprehensive health & vitality reports across all FableDash data.

Produces four report types:
  1. Operational Efficiency — utilization, time allocation by partner group, saturation leaderboards, productivity
  2. Financial Performance — revenue growth QoQ, cost/benefit rankings, cash position, pass-through analysis
  3. Process Quality — task completion rates, overdue rate, meeting-to-action ratio, time entry consistency
  4. Full Health — combines all three into a single comprehensive report
"""

import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from app.models.client import COLLECTION_NAME as CLIENTS_COLLECTION, PartnerGroup
from app.models.financial import (
    COLLECTION_NAME as FINANCIAL_SNAPSHOTS_COLLECTION,
    INVOICES_COLLECTION,
)
from app.models.meeting import COLLECTION_NAME as MEETINGS_COLLECTION
from app.models.task import COLLECTION_NAME as TASKS_COLLECTION
from app.models.time_log import COLLECTION_NAME as TIME_LOGS_COLLECTION
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)


class ReportEngine:
    """Generates structured health & vitality reports from Firestore data."""

    def __init__(self) -> None:
        self.db = get_firestore_client()

    # ------------------------------------------------------------------
    # 1. Operational Efficiency
    # ------------------------------------------------------------------

    async def operational_efficiency(self, period_start: str, period_end: str) -> dict:
        """Calculate operational efficiency metrics for the given date range.

        Args:
            period_start: Start date (YYYY-MM-DD inclusive).
            period_end: End date (YYYY-MM-DD inclusive).

        Returns:
            Dict with utilization_rate, time_allocation_by_group, saturation
            leaderboards, avg_task_completion_time, and productivity_score.
        """
        try:
            # --- Fetch time logs for period ---
            tl_query = self.db.collection(TIME_LOGS_COLLECTION)
            if period_start:
                tl_query = tl_query.where("date", ">=", period_start)
            if period_end:
                tl_query = tl_query.where("date", "<=", period_end)

            time_logs = list(tl_query.stream())

            # --- Fetch clients for partner group mapping ---
            client_docs = self.db.collection(CLIENTS_COLLECTION).stream()
            client_map: dict[str, dict] = {}  # id -> {name, partner_group}
            for cdoc in client_docs:
                cdata = cdoc.to_dict()
                client_map[cdoc.id] = {
                    "name": cdata.get("name", "Unknown"),
                    "partner_group": cdata.get("partner_group", "direct_clients"),
                }

            # --- Fetch tasks for completion time analysis ---
            task_docs = self.db.collection(TASKS_COLLECTION).stream()
            task_map: dict[str, dict] = {}  # id -> task data
            for tdoc in task_docs:
                tdata = tdoc.to_dict()
                task_map[tdoc.id] = {
                    "title": tdata.get("title", "Unknown Task"),
                    "status": tdata.get("status", ""),
                    "created_at": tdata.get("created_at", ""),
                    "updated_at": tdata.get("updated_at", ""),
                }

            # --- Accumulate metrics ---
            total_minutes = 0
            billable_minutes = 0
            client_minutes: dict[str, int] = defaultdict(int)
            task_minutes: dict[str, int] = defaultdict(int)
            group_stats: dict[str, dict] = {
                pg.value: {"total_minutes": 0, "billable_minutes": 0, "entry_count": 0}
                for pg in PartnerGroup
            }

            for doc in time_logs:
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
                    task_minutes[task_id] += minutes

                # Partner group allocation
                pg = client_map.get(client_id, {}).get("partner_group", "direct_clients")
                if pg not in group_stats:
                    pg = "direct_clients"
                group_stats[pg]["total_minutes"] += minutes
                if is_billable:
                    group_stats[pg]["billable_minutes"] += minutes
                group_stats[pg]["entry_count"] += 1

            # Utilization rate
            utilization_rate = round(
                (billable_minutes / total_minutes * 100), 1
            ) if total_minutes > 0 else 0.0

            # Time allocation by group
            time_allocation_by_group = []
            for pg in PartnerGroup:
                gs = group_stats[pg.value]
                pct = round((gs["total_minutes"] / total_minutes * 100), 1) if total_minutes > 0 else 0.0
                time_allocation_by_group.append({
                    "partner_group": pg.value,
                    "total_hours": round(gs["total_minutes"] / 60, 1),
                    "billable_hours": round(gs["billable_minutes"] / 60, 1),
                    "entry_count": gs["entry_count"],
                    "percentage": pct,
                })

            # Saturation top 5 clients
            sorted_clients = sorted(client_minutes.items(), key=lambda x: x[1], reverse=True)[:5]
            saturation_top5_clients = []
            for cid, mins in sorted_clients:
                pct = round((mins / total_minutes * 100), 1) if total_minutes > 0 else 0.0
                saturation_top5_clients.append({
                    "client_name": client_map.get(cid, {}).get("name", "Unknown"),
                    "total_hours": round(mins / 60, 1),
                    "percentage_of_total": pct,
                })

            # Saturation top 5 tasks
            sorted_tasks = sorted(task_minutes.items(), key=lambda x: x[1], reverse=True)[:5]
            saturation_top5_tasks = []
            for tid, mins in sorted_tasks:
                pct = round((mins / total_minutes * 100), 1) if total_minutes > 0 else 0.0
                saturation_top5_tasks.append({
                    "task_name": task_map.get(tid, {}).get("title", "Unknown Task"),
                    "total_hours": round(mins / 60, 1),
                    "percentage_of_total": pct,
                })

            # Average task completion time (for tasks marked done with created_at/updated_at)
            completion_days: list[float] = []
            for tid, tdata in task_map.items():
                if tdata["status"] == "done" and tdata["created_at"] and tdata["updated_at"]:
                    try:
                        created = datetime.fromisoformat(str(tdata["created_at"]).replace("Z", "+00:00"))
                        updated = datetime.fromisoformat(str(tdata["updated_at"]).replace("Z", "+00:00"))
                        delta = (updated - created).total_seconds() / 86400  # days
                        if delta >= 0:
                            completion_days.append(delta)
                    except (ValueError, TypeError):
                        pass

            avg_task_completion_days = round(
                sum(completion_days) / len(completion_days), 1
            ) if completion_days else 0.0

            # Productivity score (composite: weighted utilization + allocation spread)
            # Formula: 60% utilization rate + 20% client diversity + 20% task throughput
            unique_clients = len(client_minutes)
            client_diversity_score = min(unique_clients / 10 * 100, 100)  # 10+ clients = 100
            task_throughput = len([t for t in task_map.values() if t["status"] == "done"])
            throughput_score = min(task_throughput / 20 * 100, 100)  # 20+ done tasks = 100
            productivity_score = round(
                utilization_rate * 0.6 + client_diversity_score * 0.2 + throughput_score * 0.2, 1
            )

            return {
                "period": {"start": period_start, "end": period_end},
                "utilization_rate": utilization_rate,
                "total_logged_hours": round(total_minutes / 60, 1),
                "total_billable_hours": round(billable_minutes / 60, 1),
                "time_allocation_by_group": time_allocation_by_group,
                "saturation_top5_clients": saturation_top5_clients,
                "saturation_top5_tasks": saturation_top5_tasks,
                "avg_task_completion_days": avg_task_completion_days,
                "productivity_score": productivity_score,
            }

        except Exception:
            logger.exception("ReportEngine: operational_efficiency failed")
            return {"error": "Failed to generate operational efficiency report"}

    # ------------------------------------------------------------------
    # 2. Financial Performance
    # ------------------------------------------------------------------

    async def financial_performance(self, period_start: str, period_end: str) -> dict:
        """Calculate financial performance metrics.

        Args:
            period_start: Start date (YYYY-MM-DD inclusive).
            period_end: End date (YYYY-MM-DD inclusive).

        Returns:
            Dict with revenue growth, cost/benefit rankings, cash position,
            and pass-through analysis.
        """
        try:
            # --- Fetch financial snapshots ---
            snap_query = (
                self.db.collection(FINANCIAL_SNAPSHOTS_COLLECTION)
                .order_by("period_end", direction="DESCENDING")
            )
            snapshots: list[dict] = []
            for doc in snap_query.stream():
                sdata = doc.to_dict()
                sdata["id"] = doc.id
                snapshots.append(sdata)

            # --- Revenue growth QoQ ---
            # Compare latest two snapshots
            revenue_growth_qoq = None
            current_revenue = 0.0
            previous_revenue = 0.0
            if len(snapshots) >= 2:
                current_revenue = float(snapshots[0].get("total_revenue", 0))
                previous_revenue = float(snapshots[1].get("total_revenue", 0))
                if previous_revenue > 0:
                    revenue_growth_qoq = round(
                        ((current_revenue - previous_revenue) / previous_revenue) * 100, 1
                    )

            # --- Cost/benefit rankings by client ---
            # Revenue from invoices vs hours logged
            inv_by_client: dict[str, float] = defaultdict(float)
            for doc in self.db.collection(INVOICES_COLLECTION).stream():
                idata = doc.to_dict()
                cid = idata.get("client_id", "")
                if cid and idata.get("status") in ("paid", "sent"):
                    inv_by_client[cid] += float(idata.get("amount", 0))

            # Fetch client names + time logged
            client_docs = self.db.collection(CLIENTS_COLLECTION).stream()
            client_name_map: dict[str, str] = {}
            for cdoc in client_docs:
                client_name_map[cdoc.id] = cdoc.to_dict().get("name", "Unknown")

            tl_query = self.db.collection(TIME_LOGS_COLLECTION)
            if period_start:
                tl_query = tl_query.where("date", ">=", period_start)
            if period_end:
                tl_query = tl_query.where("date", "<=", period_end)

            hours_by_client: dict[str, float] = defaultdict(float)
            for doc in tl_query.stream():
                data = doc.to_dict()
                cid = data.get("client_id", "")
                if cid:
                    hours_by_client[cid] += data.get("duration_minutes", 0) / 60

            # Build cost/benefit list (revenue per hour)
            cost_benefit_rankings: list[dict] = []
            all_client_ids = set(inv_by_client.keys()) | set(hours_by_client.keys())
            for cid in all_client_ids:
                revenue = round(inv_by_client.get(cid, 0), 2)
                hours = round(hours_by_client.get(cid, 0), 1)
                rev_per_hour = round(revenue / hours, 2) if hours > 0 else 0.0
                cost_benefit_rankings.append({
                    "client_name": client_name_map.get(cid, "Unknown"),
                    "revenue_zar": revenue,
                    "hours_logged": hours,
                    "revenue_per_hour_zar": rev_per_hour,
                })
            cost_benefit_rankings.sort(key=lambda x: x["revenue_per_hour_zar"], reverse=True)

            # --- Cash position (from latest snapshot) ---
            cash_position = {}
            if snapshots:
                latest = snapshots[0]
                cash_position = {
                    "cash_on_hand_zar": latest.get("cash_on_hand", 0),
                    "accounts_receivable_zar": latest.get("accounts_receivable", 0),
                    "accounts_payable_zar": latest.get("accounts_payable", 0),
                    "net_profit_zar": latest.get("net_profit", 0),
                    "total_revenue_zar": latest.get("total_revenue", 0),
                    "total_expenses_zar": latest.get("total_expenses", 0),
                    "period_start": latest.get("period_start", ""),
                    "period_end": latest.get("period_end", ""),
                }

            # --- Pass-through analysis (billable vs non-billable revenue impact) ---
            total_invoiced = sum(inv_by_client.values())
            total_hours = sum(hours_by_client.values())
            effective_rate = round(total_invoiced / total_hours, 2) if total_hours > 0 else 0.0

            pass_through_analysis = {
                "total_invoiced_zar": round(total_invoiced, 2),
                "total_hours_logged": round(total_hours, 1),
                "effective_hourly_rate_zar": effective_rate,
            }

            return {
                "period": {"start": period_start, "end": period_end},
                "revenue_growth_qoq_percent": revenue_growth_qoq,
                "current_revenue_zar": round(current_revenue, 2),
                "previous_revenue_zar": round(previous_revenue, 2),
                "cost_benefit_rankings": cost_benefit_rankings[:10],
                "cash_position": cash_position,
                "pass_through_analysis": pass_through_analysis,
            }

        except Exception:
            logger.exception("ReportEngine: financial_performance failed")
            return {"error": "Failed to generate financial performance report"}

    # ------------------------------------------------------------------
    # 3. Process Quality
    # ------------------------------------------------------------------

    async def process_quality(self, period_start: str, period_end: str) -> dict:
        """Calculate process quality metrics.

        Args:
            period_start: Start date (YYYY-MM-DD inclusive).
            period_end: End date (YYYY-MM-DD inclusive).

        Returns:
            Dict with task completion rates, overdue rate, meeting-to-action
            ratio, and time entry consistency.
        """
        try:
            # --- Task metrics ---
            task_docs = list(self.db.collection(TASKS_COLLECTION).stream())

            total_tasks = 0
            done_tasks = 0
            overdue_tasks = 0
            today_str = date.today().isoformat()

            for doc in task_docs:
                tdata = doc.to_dict()
                total_tasks += 1
                status = tdata.get("status", "")

                if status == "done":
                    done_tasks += 1
                else:
                    # Check overdue
                    due_date = tdata.get("due_date")
                    if due_date:
                        due_str = str(due_date)[:10]  # handle datetime or string
                        if due_str < today_str:
                            overdue_tasks += 1

            completion_rate = round(
                (done_tasks / total_tasks * 100), 1
            ) if total_tasks > 0 else 0.0
            overdue_rate = round(
                (overdue_tasks / total_tasks * 100), 1
            ) if total_tasks > 0 else 0.0

            # --- Meeting-to-action ratio ---
            meeting_docs = list(self.db.collection(MEETINGS_COLLECTION).stream())
            total_meetings = 0
            total_action_items = 0

            for doc in meeting_docs:
                mdata = doc.to_dict()
                meeting_date = mdata.get("date", "")
                # Filter to period if dates are comparable strings
                if period_start and str(meeting_date) < period_start:
                    continue
                if period_end and str(meeting_date) > period_end:
                    continue
                total_meetings += 1
                action_items = mdata.get("action_items", [])
                total_action_items += len(action_items)

            meeting_to_action_ratio = round(
                total_action_items / total_meetings, 1
            ) if total_meetings > 0 else 0.0

            # --- Time entry consistency ---
            tl_query = self.db.collection(TIME_LOGS_COLLECTION)
            if period_start:
                tl_query = tl_query.where("date", ">=", period_start)
            if period_end:
                tl_query = tl_query.where("date", "<=", period_end)

            time_log_docs = list(tl_query.stream())
            entries_by_date: dict[str, int] = defaultdict(int)
            entries_with_description = 0
            entries_with_task = 0
            total_entries = 0

            for doc in time_log_docs:
                data = doc.to_dict()
                total_entries += 1
                date_str = data.get("date", "")
                entries_by_date[date_str] += 1
                if data.get("description"):
                    entries_with_description += 1
                if data.get("task_id"):
                    entries_with_task += 1

            # Calculate working days in period
            try:
                start_dt = date.fromisoformat(period_start)
                end_dt = date.fromisoformat(period_end)
                total_days = (end_dt - start_dt).days + 1
                working_days = sum(
                    1 for d in range(total_days)
                    if (start_dt + timedelta(days=d)).weekday() < 5
                )
            except (ValueError, TypeError):
                working_days = 0

            days_with_entries = len(entries_by_date)
            entry_consistency_rate = round(
                (days_with_entries / working_days * 100), 1
            ) if working_days > 0 else 0.0
            description_rate = round(
                (entries_with_description / total_entries * 100), 1
            ) if total_entries > 0 else 0.0
            task_linkage_rate = round(
                (entries_with_task / total_entries * 100), 1
            ) if total_entries > 0 else 0.0

            return {
                "period": {"start": period_start, "end": period_end},
                "task_completion": {
                    "total_tasks": total_tasks,
                    "completed_tasks": done_tasks,
                    "completion_rate": completion_rate,
                },
                "overdue": {
                    "overdue_tasks": overdue_tasks,
                    "overdue_rate": overdue_rate,
                },
                "meetings": {
                    "total_meetings": total_meetings,
                    "total_action_items": total_action_items,
                    "meeting_to_action_ratio": meeting_to_action_ratio,
                },
                "time_entry_consistency": {
                    "total_entries": total_entries,
                    "working_days_in_period": working_days,
                    "days_with_entries": days_with_entries,
                    "entry_consistency_rate": entry_consistency_rate,
                    "description_rate": description_rate,
                    "task_linkage_rate": task_linkage_rate,
                },
            }

        except Exception:
            logger.exception("ReportEngine: process_quality failed")
            return {"error": "Failed to generate process quality report"}

    # ------------------------------------------------------------------
    # 4. Full Health Report
    # ------------------------------------------------------------------

    async def full_health_report(self, period_start: str, period_end: str) -> dict:
        """Generate a comprehensive health & vitality report combining all sections.

        Args:
            period_start: Start date (YYYY-MM-DD inclusive).
            period_end: End date (YYYY-MM-DD inclusive).

        Returns:
            Dict with operational_efficiency, financial_performance, and
            process_quality sections plus an overall health score.
        """
        ops = await self.operational_efficiency(period_start, period_end)
        fin = await self.financial_performance(period_start, period_end)
        quality = await self.process_quality(period_start, period_end)

        # Overall health score (composite of sub-scores)
        # 40% operational, 30% financial, 30% process quality
        ops_score = ops.get("productivity_score", 0)

        # Financial score: based on revenue growth direction + cash position health
        fin_score = 50.0  # neutral baseline
        growth = ops.get("revenue_growth_qoq_percent")
        if growth is not None:
            fin_score = min(max(50 + growth, 0), 100)

        # Process quality score: weighted task completion + time consistency
        task_completion = quality.get("task_completion", {}).get("completion_rate", 0)
        consistency = quality.get("time_entry_consistency", {}).get("entry_consistency_rate", 0)
        quality_score = round(task_completion * 0.6 + consistency * 0.4, 1)

        overall_health_score = round(
            ops_score * 0.4 + fin_score * 0.3 + quality_score * 0.3, 1
        )

        return {
            "period": {"start": period_start, "end": period_end},
            "overall_health_score": overall_health_score,
            "operational_efficiency": ops,
            "financial_performance": fin,
            "process_quality": quality,
            "generated_at": datetime.now(timezone.utc).isoformat(),
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
