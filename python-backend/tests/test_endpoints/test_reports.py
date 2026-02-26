"""Tests for reports API endpoints."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock


def _mock_report_engine():
    """Create a mocked ReportEngine that returns sensible defaults."""
    engine = MagicMock()
    engine.operational_efficiency = AsyncMock(return_value={
        "total_hours": 100.0,
        "billable_hours": 80.0,
        "utilization_rate": 80.0,
        "time_allocation_by_group": {},
        "saturation_top5_clients": [],
        "saturation_top5_tasks": [],
        "avg_task_completion_days": 5.0,
        "productivity_score": 75.0,
        "completion_rate": 70.0,
    })
    engine.financial_performance = AsyncMock(return_value={
        "total_revenue": 500000.0,
        "total_expenses": 300000.0,
        "net_profit": 200000.0,
        "profit_margin": 40.0,
        "cash_position": 200000.0,
        "invoice_count": 10,
        "collection_rate": 80.0,
        "cost_benefit_rankings": [],
    })
    engine.process_quality = AsyncMock(return_value={
        "total_tasks_created": 50,
        "tasks_completed": 35,
        "completion_rate": 70.0,
        "overdue_tasks": 5,
        "overdue_rate": 10.0,
        "time_entry_consistency": 85.0,
        "weekdays_in_period": 22,
        "days_with_entries": 18,
        "meeting_count": 8,
        "meeting_to_action_ratio": 6.3,
        "total_time_entries": 100,
    })
    engine.full_health_report = AsyncMock(return_value={
        "period": {"start": "2026-01-01", "end": "2026-01-31"},
        "operational_efficiency": {
            "total_hours": 100.0, "billable_hours": 80.0, "utilization_rate": 80.0,
            "productivity_score": 75.0, "completion_rate": 70.0, "avg_task_completion_days": 5.0,
        },
        "financial_performance": {
            "total_revenue": 500000.0, "total_expenses": 300000.0, "net_profit": 200000.0,
            "profit_margin": 40.0, "cash_position": 200000.0, "collection_rate": 80.0, "invoice_count": 10,
        },
        "process_quality": {
            "total_tasks_created": 50, "tasks_completed": 35, "completion_rate": 70.0,
            "overdue_tasks": 5, "overdue_rate": 10.0, "time_entry_consistency": 85.0,
            "total_time_entries": 100,
        },
    })
    return engine


class TestOperationalEfficiency:
    def test_operational_efficiency(self, client):
        with patch("app.api.reports._get_engines") as mock_get:
            engine = _mock_report_engine()
            mock_get.return_value = (engine, MagicMock())

            response = client.get("/reports/operational-efficiency?period_start=2026-01-01&period_end=2026-01-31")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    def test_operational_efficiency_missing_dates(self, client):
        response = client.get("/reports/operational-efficiency")
        assert response.status_code == 422


class TestFinancialPerformance:
    def test_financial_performance(self, client):
        with patch("app.api.reports._get_engines") as mock_get:
            engine = _mock_report_engine()
            mock_get.return_value = (engine, MagicMock())

            response = client.get("/reports/financial-performance?period_start=2026-01-01&period_end=2026-01-31")
            assert response.status_code == 200


class TestProcessQuality:
    def test_process_quality(self, client):
        with patch("app.api.reports._get_engines") as mock_get:
            engine = _mock_report_engine()
            mock_get.return_value = (engine, MagicMock())

            response = client.get("/reports/process-quality?period_start=2026-01-01&period_end=2026-01-31")
            assert response.status_code == 200


class TestFullHealthReport:
    def test_full_health_report(self, client):
        with patch("app.api.reports._get_engines") as mock_get:
            engine = _mock_report_engine()
            mock_get.return_value = (engine, MagicMock())

            response = client.get("/reports/health?period_start=2026-01-01&period_end=2026-01-31")
            assert response.status_code == 200


class TestComparePeriods:
    def test_compare_periods(self, client):
        with patch("app.api.reports._get_engines") as mock_get:
            engine = _mock_report_engine()
            comparison = MagicMock()
            comparison.compare_periods = AsyncMock(return_value={
                "period_a": {}, "period_b": {}, "deltas": {}, "trends": {},
            })
            mock_get.return_value = (engine, comparison)

            response = client.get(
                "/reports/compare"
                "?period_a_start=2026-01-01&period_a_end=2026-01-31"
                "&period_b_start=2025-01-01&period_b_end=2025-01-31"
            )
            assert response.status_code == 200

    def test_compare_periods_invalid_dates(self, client):
        response = client.get(
            "/reports/compare"
            "?period_a_start=2026-01-31&period_a_end=2026-01-01"
            "&period_b_start=2025-01-01&period_b_end=2025-01-31"
        )
        assert response.status_code == 400


class TestQuarterlyComparison:
    def test_quarterly_comparison(self, client):
        with patch("app.api.reports._get_engines") as mock_get:
            engine = _mock_report_engine()
            comparison = MagicMock()
            comparison.quarterly_comparison = AsyncMock(return_value={
                "period_a": {}, "period_b": {}, "deltas": {}, "trends": {},
                "labels": {"period_a": "Q1 2026", "period_b": "Q2 2026"},
            })
            mock_get.return_value = (engine, comparison)

            response = client.get("/reports/quarterly?year=2026&quarter_a=1&quarter_b=2")
            assert response.status_code == 200

    def test_quarterly_same_quarter(self, client):
        response = client.get("/reports/quarterly?year=2026&quarter_a=1&quarter_b=1")
        assert response.status_code == 400


class TestYTDReport:
    def test_ytd_report(self, client):
        with patch("app.api.reports._get_engines") as mock_get:
            engine = _mock_report_engine()
            comparison = MagicMock()
            comparison.ytd_report = AsyncMock(return_value={
                "period_a": {}, "period_b": {}, "deltas": {}, "trends": {},
                "labels": {"period_a": "YTD 2025", "period_b": "YTD 2026"},
            })
            mock_get.return_value = (engine, comparison)

            response = client.get("/reports/ytd?year=2026")
            assert response.status_code == 200


class TestExportReport:
    def test_export_text(self, client):
        with patch("app.api.reports._get_engines") as mock_get, \
             patch("app.api.reports._get_exporter") as mock_exporter:
            engine = _mock_report_engine()
            mock_get.return_value = (engine, MagicMock())
            exporter = MagicMock()
            exporter.generate_text_report = AsyncMock(return_value="Report text")
            mock_exporter.return_value = exporter

            response = client.get(
                "/reports/export?period_start=2026-01-01&period_end=2026-01-31&format=text"
            )
            assert response.status_code == 200

    def test_export_summary(self, client):
        with patch("app.api.reports._get_engines") as mock_get, \
             patch("app.api.reports._get_exporter") as mock_exporter:
            engine = _mock_report_engine()
            mock_get.return_value = (engine, MagicMock())
            exporter = MagicMock()
            exporter.generate_ai_summary = AsyncMock(return_value="AI Summary")
            mock_exporter.return_value = exporter

            response = client.get(
                "/reports/export?period_start=2026-01-01&period_end=2026-01-31&format=summary"
            )
            assert response.status_code == 200

    def test_export_invalid_format(self, client):
        response = client.get(
            "/reports/export?period_start=2026-01-01&period_end=2026-01-31&format=pdf"
        )
        assert response.status_code == 400
