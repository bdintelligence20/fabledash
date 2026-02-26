"""Tests for ReportComparison period comparison engine."""

import pytest
from datetime import date
from unittest.mock import patch, MagicMock, AsyncMock

from app.utils.report_comparison import (
    _calculate_delta,
    _compute_deltas,
    _compute_trends,
    ReportComparison,
    QUARTER_RANGES,
)


class TestCalculateDelta:
    def test_positive_change(self):
        delta = _calculate_delta(100, 150)
        assert delta["absolute_change"] == 50
        assert delta["percentage_change"] == 50.0
        assert delta["direction"] == "improved"

    def test_negative_change(self):
        delta = _calculate_delta(150, 100)
        assert delta["absolute_change"] == -50
        assert delta["percentage_change"] == pytest.approx(-33.3, abs=0.1)
        assert delta["direction"] == "declined"

    def test_no_change(self):
        delta = _calculate_delta(100, 100)
        assert delta["absolute_change"] == 0
        assert delta["percentage_change"] == 0.0
        assert delta["direction"] == "unchanged"

    def test_none_value_a(self):
        delta = _calculate_delta(None, 100)
        assert delta["absolute_change"] is None
        assert delta["percentage_change"] is None
        assert delta["direction"] == "unchanged"

    def test_none_value_b(self):
        delta = _calculate_delta(100, None)
        assert delta["absolute_change"] is None
        assert delta["percentage_change"] is None
        assert delta["direction"] == "unchanged"

    def test_both_none(self):
        delta = _calculate_delta(None, None)
        assert delta["direction"] == "unchanged"

    def test_zero_base_positive(self):
        delta = _calculate_delta(0, 100)
        assert delta["percentage_change"] == 100.0

    def test_zero_base_negative(self):
        delta = _calculate_delta(0, -50)
        assert delta["percentage_change"] == -100.0

    def test_zero_to_zero(self):
        delta = _calculate_delta(0, 0)
        assert delta["percentage_change"] == 0.0
        assert delta["direction"] == "unchanged"

    def test_float_values(self):
        delta = _calculate_delta(80.5, 90.5)
        assert delta["absolute_change"] == 10.0
        assert delta["direction"] == "improved"


class TestComputeDeltas:
    def test_compute_deltas_basic(self):
        report_a = {
            "operational_efficiency": {
                "total_hours": 100,
                "billable_hours": 80,
                "utilization_rate": 80.0,
                "productivity_score": 70.0,
                "completion_rate": 60.0,
                "avg_task_completion_days": 5.0,
            },
            "financial_performance": {
                "total_revenue": 100000,
                "total_expenses": 60000,
                "net_profit": 40000,
                "profit_margin": 40.0,
                "cash_position": 200000,
                "collection_rate": 80.0,
                "invoice_count": 10,
            },
            "process_quality": {
                "total_tasks_created": 50,
                "tasks_completed": 30,
                "completion_rate": 60.0,
                "overdue_tasks": 5,
                "overdue_rate": 10.0,
                "time_entry_consistency": 80.0,
                "total_time_entries": 100,
            },
        }
        report_b = {
            "operational_efficiency": {
                "total_hours": 120,
                "billable_hours": 100,
                "utilization_rate": 83.3,
                "productivity_score": 75.0,
                "completion_rate": 70.0,
                "avg_task_completion_days": 4.0,
            },
            "financial_performance": {
                "total_revenue": 120000,
                "total_expenses": 70000,
                "net_profit": 50000,
                "profit_margin": 41.7,
                "cash_position": 250000,
                "collection_rate": 85.0,
                "invoice_count": 12,
            },
            "process_quality": {
                "total_tasks_created": 60,
                "tasks_completed": 42,
                "completion_rate": 70.0,
                "overdue_tasks": 3,
                "overdue_rate": 5.0,
                "time_entry_consistency": 90.0,
                "total_time_entries": 120,
            },
        }
        deltas = _compute_deltas(report_a, report_b)
        assert "operational_efficiency" in deltas
        assert "financial_performance" in deltas
        assert "process_quality" in deltas

        # total_hours improved (higher is better)
        assert deltas["operational_efficiency"]["total_hours"]["direction"] == "improved"
        # avg_task_completion_days decreased (lower is better => improved)
        assert deltas["operational_efficiency"]["avg_task_completion_days"]["direction"] == "improved"
        # overdue_tasks decreased (lower is better => improved)
        assert deltas["process_quality"]["overdue_tasks"]["direction"] == "improved"

    def test_compute_deltas_missing_sections(self):
        deltas = _compute_deltas({}, {})
        assert "operational_efficiency" in deltas
        # All values should be None since the keys are missing
        for metric, delta in deltas["operational_efficiency"].items():
            assert delta["absolute_change"] is None

    def test_lower_is_better_direction_swap(self):
        report_a = {
            "operational_efficiency": {
                "avg_task_completion_days": 3.0,
                "total_hours": 100,
                "billable_hours": 80,
                "utilization_rate": 80.0,
                "productivity_score": 70.0,
                "completion_rate": 60.0,
            },
        }
        report_b = {
            "operational_efficiency": {
                "avg_task_completion_days": 5.0,  # went up, but lower is better => declined
                "total_hours": 100,
                "billable_hours": 80,
                "utilization_rate": 80.0,
                "productivity_score": 70.0,
                "completion_rate": 60.0,
            },
        }
        deltas = _compute_deltas(report_a, report_b)
        assert deltas["operational_efficiency"]["avg_task_completion_days"]["direction"] == "declined"


class TestComputeTrends:
    def test_compute_trends_basic(self):
        deltas = {
            "operational_efficiency": {
                "total_hours": {"absolute_change": 20, "percentage_change": 20.0, "direction": "improved"},
                "utilization_rate": {"absolute_change": -5, "percentage_change": -6.3, "direction": "declined"},
            },
            "financial_performance": {
                "total_revenue": {"absolute_change": 0, "percentage_change": 0.0, "direction": "unchanged"},
            },
        }
        trends = _compute_trends(deltas)
        assert len(trends["improvements"]) == 1
        assert len(trends["declines"]) == 1
        assert len(trends["unchanged"]) == 1
        assert trends["summary"]["improved"] == 1
        assert trends["summary"]["declined"] == 1
        assert trends["summary"]["unchanged"] == 1

    def test_compute_trends_all_improved(self):
        deltas = {
            "operational_efficiency": {
                "total_hours": {"absolute_change": 10, "percentage_change": 10.0, "direction": "improved"},
                "utilization_rate": {"absolute_change": 5, "percentage_change": 5.0, "direction": "improved"},
            },
        }
        trends = _compute_trends(deltas)
        assert trends["summary"]["improved"] == 2
        assert trends["summary"]["declined"] == 0

    def test_compute_trends_empty_deltas(self):
        trends = _compute_trends({})
        assert trends["improvements"] == []
        assert trends["declines"] == []
        assert trends["unchanged"] == []


class TestQuarterRanges:
    def test_quarter_1(self):
        assert QUARTER_RANGES[1] == (1, 1, 3, 31)

    def test_quarter_2(self):
        assert QUARTER_RANGES[2] == (4, 1, 6, 30)

    def test_quarter_3(self):
        assert QUARTER_RANGES[3] == (7, 1, 9, 30)

    def test_quarter_4(self):
        assert QUARTER_RANGES[4] == (10, 1, 12, 31)


class TestReportComparisonGetQuarterDates:
    def test_q1_dates(self):
        start, end = ReportComparison.get_quarter_dates(2026, 1)
        assert start == date(2026, 1, 1)
        assert end == date(2026, 3, 31)

    def test_q2_dates(self):
        start, end = ReportComparison.get_quarter_dates(2026, 2)
        assert start == date(2026, 4, 1)
        assert end == date(2026, 6, 30)

    def test_q3_dates(self):
        start, end = ReportComparison.get_quarter_dates(2026, 3)
        assert start == date(2026, 7, 1)
        assert end == date(2026, 9, 30)

    def test_q4_dates(self):
        start, end = ReportComparison.get_quarter_dates(2026, 4)
        assert start == date(2026, 10, 1)
        assert end == date(2026, 12, 31)

    def test_invalid_quarter_raises(self):
        with pytest.raises(ValueError, match="Quarter must be 1-4"):
            ReportComparison.get_quarter_dates(2026, 5)

    def test_invalid_quarter_zero(self):
        with pytest.raises(ValueError):
            ReportComparison.get_quarter_dates(2026, 0)


class TestReportComparisonComparePeriods:
    @pytest.mark.asyncio
    async def test_compare_periods(self):
        mock_engine = MagicMock()
        mock_engine.full_health_report = AsyncMock(return_value={
            "operational_efficiency": {"total_hours": 100, "utilization_rate": 80.0},
            "financial_performance": {"total_revenue": 100000},
            "process_quality": {"completion_rate": 60.0},
        })
        comparison = ReportComparison(mock_engine)
        result = await comparison.compare_periods(
            date(2026, 1, 1), date(2026, 1, 31),
            date(2026, 2, 1), date(2026, 2, 28),
        )
        assert "period_a" in result
        assert "period_b" in result
        assert "deltas" in result
        assert "trends" in result
        assert mock_engine.full_health_report.call_count == 2

    @pytest.mark.asyncio
    async def test_quarterly_comparison(self):
        mock_engine = MagicMock()
        mock_engine.full_health_report = AsyncMock(return_value={
            "operational_efficiency": {},
            "financial_performance": {},
            "process_quality": {},
        })
        comparison = ReportComparison(mock_engine)
        result = await comparison.quarterly_comparison(2026, 1, 2)
        assert "labels" in result
        assert result["labels"]["period_a"] == "Q1 2026"
        assert result["labels"]["period_b"] == "Q2 2026"

    @pytest.mark.asyncio
    async def test_ytd_report(self):
        mock_engine = MagicMock()
        mock_engine.full_health_report = AsyncMock(return_value={
            "operational_efficiency": {},
            "financial_performance": {},
            "process_quality": {},
        })
        comparison = ReportComparison(mock_engine)
        result = await comparison.ytd_report(2026)
        assert "labels" in result
        assert "YTD 2025" in result["labels"]["period_a"]
        assert "YTD 2026" in result["labels"]["period_b"]
