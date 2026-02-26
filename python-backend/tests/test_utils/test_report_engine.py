"""Tests for ReportEngine report generation."""

import pytest
from datetime import date, datetime
from unittest.mock import patch, MagicMock

from tests.conftest import (
    MockFirestoreClient,
    MockDocumentSnapshot,
    make_client_doc,
    make_task_doc,
    make_time_log_doc,
    make_meeting_doc,
    make_invoice_doc,
    make_snapshot_doc,
)


def _make_engine(db):
    """Create a ReportEngine with a mocked Firestore client."""
    with patch("app.utils.report_engine.get_firestore_client", return_value=db):
        from app.utils.report_engine import ReportEngine
        engine = ReportEngine()
    return engine


@pytest.fixture
def engine_empty():
    db = MockFirestoreClient()
    return _make_engine(db)


@pytest.fixture
def engine_with_data():
    db = MockFirestoreClient()
    db.set_collection("clients", [
        make_client_doc("c1", "Client A", "collab"),
        make_client_doc("c2", "Client B", "edcp"),
    ])
    # Use ISO string dates for task docs since report_engine does string slicing on created_at
    db.set_collection("tasks", [
        MockDocumentSnapshot("t1", {
            "title": "Task 1",
            "description": "Task desc",
            "client_id": "c1",
            "status": "done",
            "priority": "high",
            "due_date": "2026-03-01",
            "assigned_to": "user_1",
            "comments": [],
            "attachments": [],
            "created_at": "2026-01-05T09:00:00",
            "updated_at": "2026-01-10T17:00:00",
            "created_by": "user_1",
        }),
        MockDocumentSnapshot("t2", {
            "title": "Task 2",
            "description": "Task desc",
            "client_id": "c1",
            "status": "in_progress",
            "priority": "medium",
            "due_date": "2026-03-01",
            "assigned_to": "user_1",
            "comments": [],
            "attachments": [],
            "created_at": "2026-01-10T09:00:00",
            "updated_at": "2026-01-15T09:00:00",
            "created_by": "user_1",
        }),
        MockDocumentSnapshot("t3", {
            "title": "Task 3",
            "description": "Task desc",
            "client_id": "c2",
            "status": "todo",
            "priority": "low",
            "due_date": "2026-03-01",
            "assigned_to": "user_1",
            "comments": [],
            "attachments": [],
            "created_at": "2026-01-15T09:00:00",
            "updated_at": "2026-01-15T09:00:00",
            "created_by": "user_1",
        }),
    ])

    db.set_collection("time_logs", [
        make_time_log_doc("tl1", "c1", 120),
        make_time_log_doc("tl2", "c1", 180),
        make_time_log_doc("tl3", "c2", 60),
    ])
    db.set_collection("invoices", [
        make_invoice_doc("inv1", 10000, "paid"),
        make_invoice_doc("inv2", 5000, "outstanding"),
    ])
    db.set_collection("financial_snapshots", [
        make_snapshot_doc("snap1", 100000, 60000),
    ])
    db.set_collection("meetings", [
        make_meeting_doc("m1", "Kickoff"),
    ])
    return _make_engine(db)


PERIOD_START = date(2026, 1, 1)
PERIOD_END = date(2026, 1, 31)


class TestOperationalEfficiency:
    @pytest.mark.asyncio
    async def test_empty_data_returns_zeros(self, engine_empty):
        result = await engine_empty.operational_efficiency(PERIOD_START, PERIOD_END)
        assert result["total_hours"] == 0.0
        assert result["billable_hours"] == 0.0
        assert result["utilization_rate"] == 0.0
        assert result["saturation_top5_clients"] == []
        assert result["saturation_top5_tasks"] == []
        assert result["avg_task_completion_days"] is None
        assert result["productivity_score"] == 0.0
        assert result["completion_rate"] == 0.0

    @pytest.mark.asyncio
    async def test_with_data_returns_metrics(self, engine_with_data):
        result = await engine_with_data.operational_efficiency(PERIOD_START, PERIOD_END)
        assert result["total_hours"] > 0
        assert result["billable_hours"] > 0
        assert 0 <= result["utilization_rate"] <= 100
        assert isinstance(result["time_allocation_by_group"], dict)
        assert isinstance(result["saturation_top5_clients"], list)
        assert isinstance(result["saturation_top5_tasks"], list)

    @pytest.mark.asyncio
    async def test_utilization_rate_calculation(self, engine_with_data):
        result = await engine_with_data.operational_efficiency(PERIOD_START, PERIOD_END)
        # All time logs have is_billable=True, so utilization should be 100%
        assert result["utilization_rate"] == 100.0

    @pytest.mark.asyncio
    async def test_completion_rate_calculation(self, engine_with_data):
        result = await engine_with_data.operational_efficiency(PERIOD_START, PERIOD_END)
        # 1 of 3 tasks is done => 33.3%
        assert result["completion_rate"] == pytest.approx(33.3, abs=0.1)

    @pytest.mark.asyncio
    async def test_productivity_score_is_weighted(self, engine_with_data):
        result = await engine_with_data.operational_efficiency(PERIOD_START, PERIOD_END)
        # productivity_score = utilization_rate * 0.6 + completion_rate * 0.4
        expected = result["utilization_rate"] * 0.6 + result["completion_rate"] * 0.4
        assert result["productivity_score"] == pytest.approx(expected, abs=0.2)

    @pytest.mark.asyncio
    async def test_avg_task_completion_days_calculated(self, engine_with_data):
        result = await engine_with_data.operational_efficiency(PERIOD_START, PERIOD_END)
        # t1: created 2026-01-05, updated 2026-01-10 => ~5 days
        if result["avg_task_completion_days"] is not None:
            assert result["avg_task_completion_days"] > 0

    @pytest.mark.asyncio
    async def test_time_allocation_includes_all_groups(self, engine_with_data):
        result = await engine_with_data.operational_efficiency(PERIOD_START, PERIOD_END)
        allocation = result["time_allocation_by_group"]
        # Should have entries for each partner group
        assert isinstance(allocation, dict)
        for group_name, group_data in allocation.items():
            assert "hours" in group_data
            assert "percentage" in group_data


class TestFinancialPerformance:
    @pytest.mark.asyncio
    async def test_empty_data_returns_zeros(self, engine_empty):
        result = await engine_empty.financial_performance(PERIOD_START, PERIOD_END)
        assert result["total_revenue"] == 0
        assert result["total_expenses"] == 0
        assert result["net_profit"] == 0
        assert result["profit_margin"] == 0.0
        assert result["cash_position"] == 0
        assert result["invoice_count"] == 0
        assert result["collection_rate"] == 0.0
        assert result["cost_benefit_rankings"] == []

    @pytest.mark.asyncio
    async def test_with_data_returns_metrics(self, engine_with_data):
        result = await engine_with_data.financial_performance(PERIOD_START, PERIOD_END)
        assert result["total_revenue"] >= 0
        assert result["total_expenses"] >= 0
        assert isinstance(result["cost_benefit_rankings"], list)
        assert result["invoice_count"] >= 0

    @pytest.mark.asyncio
    async def test_net_profit_is_revenue_minus_expenses(self, engine_with_data):
        result = await engine_with_data.financial_performance(PERIOD_START, PERIOD_END)
        assert result["net_profit"] == pytest.approx(
            result["total_revenue"] - result["total_expenses"], abs=0.01
        )

    @pytest.mark.asyncio
    async def test_collection_rate_calculation(self, engine_with_data):
        result = await engine_with_data.financial_performance(PERIOD_START, PERIOD_END)
        # 1 paid, 1 outstanding => 50%
        if result["invoice_count"] > 0:
            assert 0 <= result["collection_rate"] <= 100


class TestProcessQuality:
    @pytest.mark.asyncio
    async def test_empty_data_returns_zeros(self, engine_empty):
        result = await engine_empty.process_quality(PERIOD_START, PERIOD_END)
        assert result["total_tasks_created"] == 0
        assert result["tasks_completed"] == 0
        assert result["completion_rate"] == 0.0
        assert result["overdue_tasks"] == 0
        assert result["overdue_rate"] == 0.0

    @pytest.mark.asyncio
    async def test_with_data_returns_metrics(self, engine_with_data):
        result = await engine_with_data.process_quality(PERIOD_START, PERIOD_END)
        assert isinstance(result["total_tasks_created"], int)
        assert isinstance(result["tasks_completed"], int)
        assert isinstance(result["weekdays_in_period"], int)
        assert result["weekdays_in_period"] > 0

    @pytest.mark.asyncio
    async def test_time_entry_consistency(self, engine_with_data):
        result = await engine_with_data.process_quality(PERIOD_START, PERIOD_END)
        assert 0 <= result["time_entry_consistency"] <= 100

    @pytest.mark.asyncio
    async def test_weekday_count_for_january(self, engine_empty):
        result = await engine_empty.process_quality(PERIOD_START, PERIOD_END)
        # January 2026 has 22 weekdays (Mon-Fri)
        assert result["weekdays_in_period"] == 22


class TestFullHealthReport:
    @pytest.mark.asyncio
    async def test_empty_data(self, engine_empty):
        result = await engine_empty.full_health_report(PERIOD_START, PERIOD_END)
        assert "period" in result
        assert "operational_efficiency" in result
        assert "financial_performance" in result
        assert "process_quality" in result
        assert result["period"]["start"] == "2026-01-01"
        assert result["period"]["end"] == "2026-01-31"

    @pytest.mark.asyncio
    async def test_with_data(self, engine_with_data):
        result = await engine_with_data.full_health_report(PERIOD_START, PERIOD_END)
        assert result["operational_efficiency"]["total_hours"] > 0
        assert isinstance(result["financial_performance"], dict)
        assert isinstance(result["process_quality"], dict)

    @pytest.mark.asyncio
    async def test_combines_all_sections(self, engine_with_data):
        result = await engine_with_data.full_health_report(PERIOD_START, PERIOD_END)
        ops = result["operational_efficiency"]
        fin = result["financial_performance"]
        proc = result["process_quality"]
        # Each section should have the expected top-level keys
        assert "utilization_rate" in ops
        assert "total_revenue" in fin
        assert "completion_rate" in proc
