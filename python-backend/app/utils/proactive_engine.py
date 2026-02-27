"""Proactive intelligence engine for FableDash OpsAI.

Detects operational anomalies and generates CEO-level alerts:
- Over-servicing (high hours, low ZAR/Hr)
- Utilization drops (current vs 4-week average)
- Cash position alerts (low cash, high AR, AP due)
- Scope creep (tasks with excessive time logs)
- Deadline risks (approaching deadlines with low progress)
"""

import logging
from datetime import datetime, timedelta

import google.generativeai as genai

logger = logging.getLogger(__name__)

# Firestore collection names (mirrored from models)
CLIENTS_COLLECTION = "clients"
TASKS_COLLECTION = "tasks"
TIME_LOGS_COLLECTION = "time_logs"
FINANCIAL_SNAPSHOTS_COLLECTION = "financial_snapshots"
INVOICES_COLLECTION = "invoices"
OPSAI_CONFIG_COLLECTION = "opsai_config"

# Default thresholds
DEFAULT_THRESHOLDS = {
    "over_servicing_zar_hr_min": 350.0,
    "over_servicing_hours_min": 20.0,
    "utilization_drop_pct": 15.0,
    "cash_warning_level": 50000.0,
    "ar_warning_level": 100000.0,
    "ap_due_days": 7,
    "scope_creep_hours_multiplier": 1.5,
    "scope_creep_min_logs": 10,
    "deadline_risk_days": 3,
}


class ProactiveEngine:
    """Proactive intelligence engine that analyses Firestore data for operational alerts."""

    def __init__(self, db, gemini_model=None):
        """Initialise engine with Firestore client and optional Gemini model.

        Args:
            db: Firestore client instance.
            gemini_model: Optional Gemini GenerativeModel instance for AI summaries.
        """
        self.db = db
        self.gemini_model = gemini_model
        self._thresholds: dict | None = None

    # ------------------------------------------------------------------
    # Threshold helpers
    # ------------------------------------------------------------------

    async def _load_thresholds(self) -> dict:
        """Load alert thresholds from Firestore, falling back to defaults."""
        if self._thresholds is not None:
            return self._thresholds

        try:
            doc = self.db.collection(OPSAI_CONFIG_COLLECTION).document("thresholds").get()
            if doc.exists:
                self._thresholds = {**DEFAULT_THRESHOLDS, **doc.to_dict()}
            else:
                self._thresholds = dict(DEFAULT_THRESHOLDS)
        except Exception:
            logger.warning("Could not load opsai_config thresholds, using defaults")
            self._thresholds = dict(DEFAULT_THRESHOLDS)

        return self._thresholds

    # ------------------------------------------------------------------
    # Detection: Over-servicing
    # ------------------------------------------------------------------

    async def detect_over_servicing(self) -> list[dict]:
        """Find clients where billable hours are high but ZAR/Hr is low.

        Returns:
            List of alert dicts with client_id, client_name, hours,
            zar_per_hour, severity, and message.
        """
        thresholds = await self._load_thresholds()
        alerts: list[dict] = []

        try:
            # Load active clients
            clients_map: dict[str, str] = {}
            for doc in self.db.collection(CLIENTS_COLLECTION).where("is_active", "==", True).stream():
                data = doc.to_dict()
                clients_map[doc.id] = data.get("name", doc.id)

            if not clients_map:
                return alerts

            # Aggregate billable hours per client from time logs (last 30 days)
            cutoff = datetime.utcnow() - timedelta(days=30)
            hours_by_client: dict[str, float] = {}
            for doc in self.db.collection(TIME_LOGS_COLLECTION).where("is_billable", "==", True).stream():
                data = doc.to_dict()
                client_id = data.get("client_id", "")
                if client_id not in clients_map:
                    continue
                log_date = data.get("created_at") or data.get("date")
                if log_date and hasattr(log_date, "timestamp"):
                    if log_date < cutoff:
                        continue
                duration = data.get("duration_minutes", 0)
                hours_by_client[client_id] = hours_by_client.get(client_id, 0) + (duration / 60.0)

            # Aggregate revenue per client from invoices (last 30 days)
            revenue_by_client: dict[str, float] = {}
            for doc in self.db.collection(INVOICES_COLLECTION).stream():
                data = doc.to_dict()
                client_id = data.get("client_id", "")
                if client_id not in clients_map:
                    continue
                amount = data.get("amount", 0)
                revenue_by_client[client_id] = revenue_by_client.get(client_id, 0) + amount

            # Flag over-servicing
            min_hours = thresholds.get("over_servicing_hours_min", 20.0)
            min_zar_hr = thresholds.get("over_servicing_zar_hr_min", 350.0)

            for client_id, hours in hours_by_client.items():
                if hours < min_hours:
                    continue
                revenue = revenue_by_client.get(client_id, 0)
                zar_hr = revenue / hours if hours > 0 else 0

                if zar_hr < min_zar_hr:
                    severity = "high" if zar_hr < (min_zar_hr * 0.5) else "medium"
                    alerts.append({
                        "type": "over_servicing",
                        "severity": severity,
                        "client_id": client_id,
                        "client_name": clients_map.get(client_id, client_id),
                        "hours": round(hours, 1),
                        "revenue_zar": round(revenue, 2),
                        "zar_per_hour": round(zar_hr, 2),
                        "threshold_zar_hr": min_zar_hr,
                        "message": (
                            f"{clients_map.get(client_id, client_id)}: "
                            f"{round(hours, 1)}h billed at R{round(zar_hr, 2)}/hr "
                            f"(threshold R{min_zar_hr}/hr)"
                        ),
                    })
        except Exception:
            logger.exception("Error detecting over-servicing")

        return alerts

    # ------------------------------------------------------------------
    # Detection: Utilization drops
    # ------------------------------------------------------------------

    async def detect_utilization_drops(self) -> list[dict]:
        """Compare current week utilization to 4-week rolling average.

        Flags drops greater than the configured threshold percentage.

        Returns:
            List of alert dicts with current_hours, avg_hours, drop_pct, severity.
        """
        thresholds = await self._load_thresholds()
        alerts: list[dict] = []

        try:
            now = datetime.utcnow()
            current_week_start = now - timedelta(days=now.weekday())
            current_week_start = current_week_start.replace(hour=0, minute=0, second=0, microsecond=0)

            # Collect hours per week for last 5 weeks (current + 4 prior)
            five_weeks_ago = current_week_start - timedelta(weeks=4)
            weekly_hours: dict[int, float] = {}  # week_offset -> hours

            for doc in self.db.collection(TIME_LOGS_COLLECTION).stream():
                data = doc.to_dict()
                log_date = data.get("date") or data.get("created_at")
                if log_date is None:
                    continue

                # Normalise to datetime
                if hasattr(log_date, "date"):
                    log_dt = log_date if isinstance(log_date, datetime) else datetime.combine(log_date, datetime.min.time())
                else:
                    continue

                if log_dt < five_weeks_ago:
                    continue

                duration = data.get("duration_minutes", 0)
                # Determine week offset (0 = current, 1..4 = prior)
                delta_days = (current_week_start - log_dt).days
                if delta_days < 0:
                    week_offset = 0  # current week
                else:
                    week_offset = (delta_days // 7) + 1

                if week_offset > 4:
                    continue

                weekly_hours[week_offset] = weekly_hours.get(week_offset, 0) + (duration / 60.0)

            current_hours = weekly_hours.get(0, 0)
            prior_weeks = [weekly_hours.get(w, 0) for w in range(1, 5)]
            prior_total = sum(prior_weeks)
            prior_count = sum(1 for h in prior_weeks if h > 0) or 1
            avg_hours = prior_total / prior_count

            if avg_hours > 0:
                drop_pct = ((avg_hours - current_hours) / avg_hours) * 100
                threshold_pct = thresholds.get("utilization_drop_pct", 15.0)

                if drop_pct >= threshold_pct:
                    severity = "high" if drop_pct >= (threshold_pct * 2) else "medium"
                    alerts.append({
                        "type": "utilization_drop",
                        "severity": severity,
                        "current_hours": round(current_hours, 1),
                        "avg_hours_4wk": round(avg_hours, 1),
                        "drop_pct": round(drop_pct, 1),
                        "threshold_pct": threshold_pct,
                        "message": (
                            f"Team utilization dropped {round(drop_pct, 1)}% this week "
                            f"({round(current_hours, 1)}h vs {round(avg_hours, 1)}h avg)"
                        ),
                    })
        except Exception:
            logger.exception("Error detecting utilization drops")

        return alerts

    # ------------------------------------------------------------------
    # Detection: Cash position alerts
    # ------------------------------------------------------------------

    async def detect_cash_alerts(self) -> list[dict]:
        """Check latest financial snapshot for cash position red flags.

        Flags: low cash on hand, high accounts receivable, accounts payable due soon.

        Returns:
            List of alert dicts with type, value, threshold, severity.
        """
        thresholds = await self._load_thresholds()
        alerts: list[dict] = []

        try:
            # Get the most recent financial snapshot
            query = (
                self.db.collection(FINANCIAL_SNAPSHOTS_COLLECTION)
                .order_by("created_at", direction="DESCENDING")
                .limit(1)
            )
            docs = list(query.stream())
            if not docs:
                return alerts

            snapshot = docs[0].to_dict()

            # Low cash warning
            cash = snapshot.get("cash_on_hand")
            cash_threshold = thresholds.get("cash_warning_level", 50000.0)
            if cash is not None and cash < cash_threshold:
                severity = "high" if cash < (cash_threshold * 0.5) else "medium"
                alerts.append({
                    "type": "low_cash",
                    "severity": severity,
                    "value": cash,
                    "threshold": cash_threshold,
                    "message": f"Cash on hand R{cash:,.2f} below warning level R{cash_threshold:,.2f}",
                })

            # High AR warning
            ar = snapshot.get("accounts_receivable")
            ar_threshold = thresholds.get("ar_warning_level", 100000.0)
            if ar is not None and ar > ar_threshold:
                severity = "high" if ar > (ar_threshold * 1.5) else "medium"
                alerts.append({
                    "type": "high_ar",
                    "severity": severity,
                    "value": ar,
                    "threshold": ar_threshold,
                    "message": f"Accounts receivable R{ar:,.2f} exceeds warning level R{ar_threshold:,.2f}",
                })

            # AP due soon
            ap = snapshot.get("accounts_payable")
            if ap is not None and ap > 0:
                alerts.append({
                    "type": "ap_due",
                    "severity": "medium",
                    "value": ap,
                    "message": f"Accounts payable R{ap:,.2f} outstanding",
                })

        except Exception:
            logger.exception("Error detecting cash alerts")

        return alerts

    # ------------------------------------------------------------------
    # Detection: Scope creep
    # ------------------------------------------------------------------

    async def detect_scope_creep(self) -> list[dict]:
        """Find tasks with excessive time logs indicating scope creep.

        Returns:
            List of alert dicts with task_id, title, log_count, total_hours, severity.
        """
        thresholds = await self._load_thresholds()
        alerts: list[dict] = []

        try:
            # Build map of time log totals per task
            task_hours: dict[str, float] = {}
            task_log_count: dict[str, int] = {}

            for doc in self.db.collection(TIME_LOGS_COLLECTION).stream():
                data = doc.to_dict()
                task_id = data.get("task_id")
                if not task_id:
                    continue
                duration = data.get("duration_minutes", 0)
                task_hours[task_id] = task_hours.get(task_id, 0) + (duration / 60.0)
                task_log_count[task_id] = task_log_count.get(task_id, 0) + 1

            if not task_hours:
                return alerts

            # Calculate average hours per task
            all_hours = list(task_hours.values())
            avg_hours = sum(all_hours) / len(all_hours) if all_hours else 0
            multiplier = thresholds.get("scope_creep_hours_multiplier", 1.5)
            min_logs = thresholds.get("scope_creep_min_logs", 10)

            # Load tasks that are flagged
            flagged_task_ids = [
                tid for tid, hours in task_hours.items()
                if hours > (avg_hours * multiplier) and task_log_count.get(tid, 0) >= min_logs
            ]

            for task_id in flagged_task_ids:
                try:
                    task_doc = self.db.collection(TASKS_COLLECTION).document(task_id).get()
                    if not task_doc.exists:
                        continue
                    task_data = task_doc.to_dict()
                    title = task_data.get("title", task_id)
                    status = task_data.get("status", "unknown")
                except Exception:
                    title = task_id
                    status = "unknown"

                hours = task_hours[task_id]
                logs = task_log_count[task_id]
                severity = "high" if hours > (avg_hours * multiplier * 2) else "medium"

                alerts.append({
                    "type": "scope_creep",
                    "severity": severity,
                    "task_id": task_id,
                    "title": title,
                    "status": status,
                    "total_hours": round(hours, 1),
                    "log_count": logs,
                    "avg_task_hours": round(avg_hours, 1),
                    "message": (
                        f"Task \"{title}\" has {round(hours, 1)}h across {logs} logs "
                        f"(avg {round(avg_hours, 1)}h per task)"
                    ),
                })
        except Exception:
            logger.exception("Error detecting scope creep")

        return alerts

    # ------------------------------------------------------------------
    # Detection: Deadline risks
    # ------------------------------------------------------------------

    async def detect_deadline_risks(self) -> list[dict]:
        """Find tasks approaching their deadline that are not yet done.

        Returns:
            List of alert dicts with task_id, title, due_date, days_remaining, severity.
        """
        thresholds = await self._load_thresholds()
        alerts: list[dict] = []

        try:
            now = datetime.utcnow()
            risk_days = thresholds.get("deadline_risk_days", 3)
            horizon = now + timedelta(days=risk_days)

            # Query tasks that are not done
            done_statuses = {"done"}
            for doc in self.db.collection(TASKS_COLLECTION).stream():
                data = doc.to_dict()
                status = data.get("status", "")
                if status in done_statuses:
                    continue

                due_date = data.get("due_date")
                if due_date is None:
                    continue

                # Normalise due_date to datetime
                if hasattr(due_date, "timestamp"):
                    due_dt = due_date
                elif isinstance(due_date, str):
                    try:
                        due_dt = datetime.fromisoformat(due_date.replace("Z", "+00:00")).replace(tzinfo=None)
                    except (ValueError, TypeError):
                        continue
                else:
                    continue

                if due_dt > horizon:
                    continue

                days_remaining = (due_dt - now).days
                title = data.get("title", doc.id)
                priority = data.get("priority", "medium")

                if days_remaining < 0:
                    severity = "high"
                    message = f"Task \"{title}\" is {abs(days_remaining)} day(s) overdue"
                elif days_remaining == 0:
                    severity = "high"
                    message = f"Task \"{title}\" is due today"
                else:
                    severity = "high" if priority in ("high", "urgent") else "medium"
                    message = f"Task \"{title}\" due in {days_remaining} day(s) (status: {status})"

                alerts.append({
                    "type": "deadline_risk",
                    "severity": severity,
                    "task_id": doc.id,
                    "title": title,
                    "status": status,
                    "priority": priority,
                    "due_date": due_dt.isoformat(),
                    "days_remaining": days_remaining,
                    "message": message,
                })

        except Exception:
            logger.exception("Error detecting deadline risks")

        return alerts

    # ------------------------------------------------------------------
    # Run all checks
    # ------------------------------------------------------------------

    async def run_all_checks(self) -> dict:
        """Execute all detection methods and return combined results.

        Returns:
            Dict with alerts list, summary counts, and checked_at timestamp.
        """
        over_servicing = await self.detect_over_servicing()
        utilization = await self.detect_utilization_drops()
        cash = await self.detect_cash_alerts()
        scope_creep = await self.detect_scope_creep()
        deadline = await self.detect_deadline_risks()

        all_alerts = over_servicing + utilization + cash + scope_creep + deadline

        # Sort by severity (high first)
        severity_order = {"high": 0, "medium": 1, "low": 2}
        all_alerts.sort(key=lambda a: severity_order.get(a.get("severity", "low"), 2))

        summary = {
            "total": len(all_alerts),
            "high": sum(1 for a in all_alerts if a.get("severity") == "high"),
            "medium": sum(1 for a in all_alerts if a.get("severity") == "medium"),
            "by_type": {
                "over_servicing": len(over_servicing),
                "utilization_drop": len(utilization),
                "cash": len(cash),
                "scope_creep": len(scope_creep),
                "deadline_risk": len(deadline),
            },
        }

        return {
            "alerts": all_alerts,
            "summary": summary,
            "checked_at": datetime.utcnow().isoformat(),
        }

    # ------------------------------------------------------------------
    # AI insight summary
    # ------------------------------------------------------------------

    async def generate_insight_summary(self, alerts: list[dict]) -> str:
        """Use Gemini to generate a human-readable CEO briefing from alerts.

        Args:
            alerts: List of alert dicts from run_all_checks.

        Returns:
            Natural-language summary string, or fallback text if Gemini unavailable.
        """
        if not alerts:
            return "No operational alerts detected. All systems nominal."

        if self.gemini_model is None:
            return self._fallback_summary(alerts)

        try:
            alert_text = "\n".join(
                f"- [{a.get('severity', 'info').upper()}] {a.get('message', 'Unknown alert')}"
                for a in alerts
            )

            system_instruction = (
                "You are a concise operations intelligence assistant for a CEO. "
                "Summarise the following operational alerts into a brief executive "
                "briefing (3-5 sentences). Prioritise high-severity items. "
                "Use South African Rand (ZAR / R) for currency. Be direct and actionable."
            )

            model = genai.GenerativeModel(
                "gemini-2.5-flash",
                system_instruction=system_instruction,
            )

            response = await model.generate_content_async(
                f"Current operational alerts:\n{alert_text}",
                generation_config=genai.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=300,
                ),
            )

            return response.text or self._fallback_summary(alerts)

        except Exception:
            logger.exception("Gemini summary generation failed, using fallback")
            return self._fallback_summary(alerts)

    @staticmethod
    def _fallback_summary(alerts: list[dict]) -> str:
        """Generate a basic summary without AI when Gemini is unavailable."""
        high = [a for a in alerts if a.get("severity") == "high"]
        medium = [a for a in alerts if a.get("severity") == "medium"]

        parts = [f"{len(alerts)} alert(s) detected."]
        if high:
            parts.append(f"{len(high)} high-severity: {'; '.join(a.get('message', '') for a in high[:3])}")
        if medium:
            parts.append(f"{len(medium)} medium-severity issue(s).")

        return " ".join(parts)
