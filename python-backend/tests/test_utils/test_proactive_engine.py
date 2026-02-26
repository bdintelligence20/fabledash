"""Tests for the ProactiveEngine alert detection."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock

from app.utils.proactive_engine import ProactiveEngine, DEFAULT_THRESHOLDS
from tests.conftest import (
    MockFirestoreClient,
    MockDocumentSnapshot,
    make_client_doc,
    make_task_doc,
    make_time_log_doc,
    make_snapshot_doc,
    make_invoice_doc,
)


@pytest.fixture
def engine_with_data():
    """Create a ProactiveEngine with mocked Firestore data."""
    db = MockFirestoreClient()
    db.set_collection("clients", [
        make_client_doc("c1", "Client A", "collab"),
        make_client_doc("c2", "Client B", "edcp"),
    ])
    db.set_collection("tasks", [
        make_task_doc("t1", "Task 1", "c1", "in_progress", "high"),
    ])
    db.set_collection("time_logs", [
        make_time_log_doc("tl1", "c1", 120),
        make_time_log_doc("tl2", "c1", 180),
    ])
    db.set_collection("invoices", [make_invoice_doc("inv1", 5000, "paid")])
    db.set_collection("financial_snapshots", [make_snapshot_doc()])
    db.set_collection("opsai_config", [])

    return ProactiveEngine(db=db, openai_client=None)


@pytest.fixture
def engine_empty():
    """Create a ProactiveEngine with empty Firestore."""
    db = MockFirestoreClient()
    return ProactiveEngine(db=db, openai_client=None)


class TestLoadThresholds:
    @pytest.mark.asyncio
    async def test_default_thresholds(self, engine_empty):
        thresholds = await engine_empty._load_thresholds()
        assert thresholds == DEFAULT_THRESHOLDS

    @pytest.mark.asyncio
    async def test_thresholds_cached(self, engine_empty):
        t1 = await engine_empty._load_thresholds()
        t2 = await engine_empty._load_thresholds()
        assert t1 is t2


class TestDetectOverServicing:
    @pytest.mark.asyncio
    async def test_no_clients_no_alerts(self, engine_empty):
        alerts = await engine_empty.detect_over_servicing()
        assert alerts == []

    @pytest.mark.asyncio
    async def test_with_data_returns_list(self, engine_with_data):
        alerts = await engine_with_data.detect_over_servicing()
        assert isinstance(alerts, list)


class TestDetectUtilizationDrops:
    @pytest.mark.asyncio
    async def test_empty_data_no_alerts(self, engine_empty):
        alerts = await engine_empty.detect_utilization_drops()
        assert alerts == []

    @pytest.mark.asyncio
    async def test_with_data_returns_list(self, engine_with_data):
        alerts = await engine_with_data.detect_utilization_drops()
        assert isinstance(alerts, list)


class TestDetectCashAlerts:
    @pytest.mark.asyncio
    async def test_no_snapshots_no_alerts(self, engine_empty):
        alerts = await engine_empty.detect_cash_alerts()
        assert alerts == []

    @pytest.mark.asyncio
    async def test_with_good_cash_position(self, engine_with_data):
        alerts = await engine_with_data.detect_cash_alerts()
        # cash_on_hand=200000 is well above 50000 default threshold
        cash_alerts = [a for a in alerts if a["type"] == "low_cash"]
        assert len(cash_alerts) == 0

    @pytest.mark.asyncio
    async def test_low_cash_alert(self):
        db = MockFirestoreClient()
        db.set_collection("financial_snapshots", [
            MockDocumentSnapshot("snap1", {
                "cash_on_hand": 10000,
                "accounts_receivable": 200000,
                "accounts_payable": 5000,
                "created_at": "2026-01-31T00:00:00",
            }),
        ])
        db.set_collection("opsai_config", [])

        engine = ProactiveEngine(db=db, openai_client=None)
        alerts = await engine.detect_cash_alerts()
        low_cash = [a for a in alerts if a["type"] == "low_cash"]
        assert len(low_cash) == 1
        assert low_cash[0]["severity"] == "high"  # 10000 < 25000 (50% of 50000)


class TestDetectScopeCreep:
    @pytest.mark.asyncio
    async def test_no_time_logs_no_alerts(self, engine_empty):
        alerts = await engine_empty.detect_scope_creep()
        assert alerts == []

    @pytest.mark.asyncio
    async def test_with_data_returns_list(self, engine_with_data):
        alerts = await engine_with_data.detect_scope_creep()
        assert isinstance(alerts, list)


class TestDetectDeadlineRisks:
    @pytest.mark.asyncio
    async def test_no_tasks_no_alerts(self, engine_empty):
        alerts = await engine_empty.detect_deadline_risks()
        assert alerts == []

    @pytest.mark.asyncio
    async def test_with_data_returns_list(self, engine_with_data):
        alerts = await engine_with_data.detect_deadline_risks()
        assert isinstance(alerts, list)


class TestRunAllChecks:
    @pytest.mark.asyncio
    async def test_run_all_empty(self, engine_empty):
        result = await engine_empty.run_all_checks()
        assert "alerts" in result
        assert "summary" in result
        assert "checked_at" in result
        assert result["summary"]["total"] >= 0

    @pytest.mark.asyncio
    async def test_run_all_with_data(self, engine_with_data):
        result = await engine_with_data.run_all_checks()
        assert isinstance(result["alerts"], list)
        assert result["summary"]["total"] == len(result["alerts"])


class TestGenerateInsightSummary:
    @pytest.mark.asyncio
    async def test_no_alerts_returns_nominal(self, engine_empty):
        summary = await engine_empty.generate_insight_summary([])
        assert "nominal" in summary.lower()

    @pytest.mark.asyncio
    async def test_fallback_summary_without_openai(self, engine_empty):
        alerts = [
            {"severity": "high", "message": "High alert"},
            {"severity": "medium", "message": "Medium alert"},
        ]
        summary = await engine_empty.generate_insight_summary(alerts)
        assert "2 alert(s)" in summary
        assert "1 high-severity" in summary

    @pytest.mark.asyncio
    async def test_fallback_summary_static(self):
        summary = ProactiveEngine._fallback_summary([
            {"severity": "high", "message": "Alert 1"},
            {"severity": "high", "message": "Alert 2"},
            {"severity": "medium", "message": "Alert 3"},
        ])
        assert "3 alert(s)" in summary
        assert "2 high-severity" in summary
