"""Report comparison engine — Q1 vs Q2 vs YTD period comparison with trend analysis."""

import logging
from datetime import date

from app.utils.report_engine import ReportEngine

logger = logging.getLogger(__name__)

# Quarter date ranges: (start_month, start_day, end_month, end_day)
QUARTER_RANGES = {
    1: (1, 1, 3, 31),
    2: (4, 1, 6, 30),
    3: (7, 1, 9, 30),
    4: (10, 1, 12, 31),
}


def _calculate_delta(value_a: float | int | None, value_b: float | int | None) -> dict:
    """Calculate the absolute and percentage change between two values.

    Returns dict with absolute_change, percentage_change, and direction (improved/declined/unchanged).
    """
    if value_a is None or value_b is None:
        return {"absolute_change": None, "percentage_change": None, "direction": "unchanged"}

    absolute_change = round(value_b - value_a, 2)
    if value_a != 0:
        percentage_change = round(((value_b - value_a) / abs(value_a)) * 100, 1)
    else:
        percentage_change = 100.0 if value_b > 0 else (0.0 if value_b == 0 else -100.0)

    if absolute_change > 0:
        direction = "improved"
    elif absolute_change < 0:
        direction = "declined"
    else:
        direction = "unchanged"

    return {
        "absolute_change": absolute_change,
        "percentage_change": percentage_change,
        "direction": direction,
    }


def _compute_deltas(report_a: dict, report_b: dict) -> dict:
    """Compute deltas across all sections of two full health reports.

    Walks through operational_efficiency, financial_performance, and process_quality
    sections, calculating changes for each numeric metric.
    """
    deltas = {}

    # Define which metrics to compare per section and whether higher is better
    sections = {
        "operational_efficiency": {
            "total_hours": True,
            "billable_hours": True,
            "utilization_rate": True,
            "productivity_score": True,
            "completion_rate": True,
            "avg_task_completion_days": False,  # lower is better
        },
        "financial_performance": {
            "total_revenue": True,
            "total_expenses": False,  # lower is better
            "net_profit": True,
            "profit_margin": True,
            "cash_position": True,
            "collection_rate": True,
            "invoice_count": True,
        },
        "process_quality": {
            "total_tasks_created": True,
            "tasks_completed": True,
            "completion_rate": True,
            "overdue_tasks": False,  # lower is better
            "overdue_rate": False,  # lower is better
            "time_entry_consistency": True,
            "total_time_entries": True,
        },
    }

    for section_key, metrics in sections.items():
        section_a = report_a.get(section_key, {})
        section_b = report_b.get(section_key, {})
        section_deltas = {}

        for metric, higher_is_better in metrics.items():
            val_a = section_a.get(metric)
            val_b = section_b.get(metric)
            delta = _calculate_delta(val_a, val_b)

            # Adjust direction semantics: for metrics where lower is better,
            # a negative change is actually an improvement
            if not higher_is_better and delta["direction"] != "unchanged":
                if delta["absolute_change"] is not None and delta["absolute_change"] < 0:
                    delta["direction"] = "improved"
                elif delta["absolute_change"] is not None and delta["absolute_change"] > 0:
                    delta["direction"] = "declined"

            section_deltas[metric] = delta

        deltas[section_key] = section_deltas

    return deltas


def _compute_trends(deltas: dict) -> dict:
    """Summarize trends from deltas — count improvements, declines, unchanged."""
    trends = {
        "improvements": [],
        "declines": [],
        "unchanged": [],
        "summary": {"improved": 0, "declined": 0, "unchanged": 0},
    }

    for section_key, section_deltas in deltas.items():
        for metric, delta in section_deltas.items():
            entry = {
                "section": section_key,
                "metric": metric,
                "absolute_change": delta["absolute_change"],
                "percentage_change": delta["percentage_change"],
            }
            direction = delta.get("direction", "unchanged")
            if direction == "improved":
                trends["improvements"].append(entry)
                trends["summary"]["improved"] += 1
            elif direction == "declined":
                trends["declines"].append(entry)
                trends["summary"]["declined"] += 1
            else:
                trends["unchanged"].append(entry)
                trends["summary"]["unchanged"] += 1

    return trends


class ReportComparison:
    """Period comparison engine for Q1 vs Q2 vs YTD comparisons."""

    def __init__(self, report_engine: ReportEngine):
        self.report_engine = report_engine

    @staticmethod
    def get_quarter_dates(year: int, quarter: int) -> tuple[date, date]:
        """Return start and end dates for a given year and quarter.

        Args:
            year: Calendar year (e.g. 2026).
            quarter: Quarter number (1-4).

        Returns:
            Tuple of (start_date, end_date).

        Raises:
            ValueError: If quarter is not 1-4.
        """
        if quarter not in QUARTER_RANGES:
            raise ValueError(f"Quarter must be 1-4, got {quarter}")

        start_month, start_day, end_month, end_day = QUARTER_RANGES[quarter]
        return (
            date(year, start_month, start_day),
            date(year, end_month, end_day),
        )

    async def compare_periods(
        self,
        period_a_start: date,
        period_a_end: date,
        period_b_start: date,
        period_b_end: date,
    ) -> dict:
        """Compare two arbitrary periods using full health reports.

        Runs full_health_report for both periods, calculates deltas for each
        metric (absolute change and percentage change), and flags improvements
        (green) and declines (red).

        Args:
            period_a_start: Start of first period.
            period_a_end: End of first period.
            period_b_start: Start of second period.
            period_b_end: End of second period.

        Returns:
            Dict with period_a, period_b, deltas, and trends.
        """
        report_a = await self.report_engine.full_health_report(period_a_start, period_a_end)
        report_b = await self.report_engine.full_health_report(period_b_start, period_b_end)

        deltas = _compute_deltas(report_a, report_b)
        trends = _compute_trends(deltas)

        return {
            "period_a": report_a,
            "period_b": report_b,
            "deltas": deltas,
            "trends": trends,
        }

    async def quarterly_comparison(self, year: int, q1: int, q2: int) -> dict:
        """Compare two quarters within a year.

        Args:
            year: Calendar year.
            q1: First quarter number (1-4).
            q2: Second quarter number (1-4).

        Returns:
            Comparison result with quarter labels.
        """
        q1_start, q1_end = self.get_quarter_dates(year, q1)
        q2_start, q2_end = self.get_quarter_dates(year, q2)

        result = await self.compare_periods(q1_start, q1_end, q2_start, q2_end)
        result["labels"] = {
            "period_a": f"Q{q1} {year}",
            "period_b": f"Q{q2} {year}",
        }
        return result

    async def ytd_report(self, year: int) -> dict:
        """Year-to-date report compared with same period last year.

        Compares Jan 1 to today of the given year against the same date range
        of the previous year.

        Args:
            year: The year to report on (defaults to current year when called).

        Returns:
            Comparison result with YTD labels.
        """
        today = date.today()
        # YTD for the requested year: Jan 1 to today (or Dec 31 if past year)
        ytd_start = date(year, 1, 1)
        if year == today.year:
            ytd_end = today
        else:
            ytd_end = date(year, 12, 31)

        # Same period last year
        prev_start = date(year - 1, 1, 1)
        if year == today.year:
            prev_end = date(year - 1, today.month, today.day)
        else:
            prev_end = date(year - 1, 12, 31)

        result = await self.compare_periods(prev_start, prev_end, ytd_start, ytd_end)
        result["labels"] = {
            "period_a": f"YTD {year - 1} (Jan 1 - {prev_end.strftime('%b %d')})",
            "period_b": f"YTD {year} (Jan 1 - {ytd_end.strftime('%b %d')})",
        }
        return result
