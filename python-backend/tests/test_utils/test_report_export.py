"""Tests for ReportExporter text formatting and AI summary generation."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from app.utils.report_export import ReportExporter


@pytest.fixture
def exporter():
    return ReportExporter()


@pytest.fixture
def sample_report_data():
    return {
        "health_score": {
            "overall_score": 75.0,
            "components": [
                {"name": "Operational", "score": 80.0, "weight": 0.4},
                {"name": "Financial", "score": 70.0, "weight": 0.35},
                {"name": "Process", "score": 72.0, "weight": 0.25},
            ],
        },
        "operational_efficiency": {
            "utilization_rate": 80.0,
            "productivity_score": 75.0,
            "time_allocation_by_group": {"collab": 50, "edcp": 30},
            "saturation_top5_clients": [
                {"name": "Client A", "hours": 40},
                {"name": "Client B", "hours": 30},
            ],
        },
        "financial_performance": {
            "total_revenue": 500000,
            "total_expenses": 300000,
            "net_profit": 200000,
            "cost_benefit_rankings": [
                {"name": "Client A", "effective_rate": 1500},
            ],
        },
        "process_quality": {
            "task_completion_rate": 70.0,
            "overdue_rate": 10.0,
            "time_entry_consistency": 85.0,
        },
    }


class TestGenerateTextReport:
    @pytest.mark.asyncio
    async def test_contains_header(self, exporter, sample_report_data):
        report = await exporter.generate_text_report(sample_report_data)
        assert "HEALTH & VITALITY REPORT" in report

    @pytest.mark.asyncio
    async def test_contains_sections(self, exporter, sample_report_data):
        report = await exporter.generate_text_report(sample_report_data)
        assert "OPERATIONAL EFFICIENCY" in report
        assert "FINANCIAL PERFORMANCE" in report
        assert "PROCESS QUALITY" in report

    @pytest.mark.asyncio
    async def test_contains_health_score(self, exporter, sample_report_data):
        report = await exporter.generate_text_report(sample_report_data)
        assert "Overall Health Score: 75.0" in report

    @pytest.mark.asyncio
    async def test_contains_financial_values(self, exporter, sample_report_data):
        report = await exporter.generate_text_report(sample_report_data)
        assert "R500000" in report
        assert "R300000" in report
        assert "R200000" in report

    @pytest.mark.asyncio
    async def test_contains_utilization_rate(self, exporter, sample_report_data):
        report = await exporter.generate_text_report(sample_report_data)
        assert "Utilization Rate: 80.0" in report

    @pytest.mark.asyncio
    async def test_empty_report_data(self, exporter):
        report = await exporter.generate_text_report({})
        assert "HEALTH & VITALITY REPORT" in report
        # Should handle missing data gracefully with N/A
        assert "N/A" in report

    @pytest.mark.asyncio
    async def test_contains_top_clients(self, exporter, sample_report_data):
        report = await exporter.generate_text_report(sample_report_data)
        assert "Client A" in report

    @pytest.mark.asyncio
    async def test_contains_time_allocation(self, exporter, sample_report_data):
        report = await exporter.generate_text_report(sample_report_data)
        assert "Time Allocation by Group:" in report

    @pytest.mark.asyncio
    async def test_report_is_string(self, exporter, sample_report_data):
        report = await exporter.generate_text_report(sample_report_data)
        assert isinstance(report, str)
        assert len(report) > 100


class TestGenerateAISummary:
    @pytest.mark.asyncio
    async def test_ai_summary_success(self, exporter, sample_report_data):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Executive summary text here."

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        with patch("app.utils.report_export.get_openai_client", return_value=mock_client):
            summary = await exporter.generate_ai_summary(sample_report_data)
        assert summary == "Executive summary text here."

    @pytest.mark.asyncio
    async def test_ai_summary_failure_returns_fallback(self, exporter, sample_report_data):
        with patch("app.utils.report_export.get_openai_client", side_effect=Exception("API error")):
            summary = await exporter.generate_ai_summary(sample_report_data)
        assert "failed" in summary.lower() or "AI summary" in summary

    @pytest.mark.asyncio
    async def test_ai_summary_empty_content_returns_fallback(self, exporter, sample_report_data):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = None

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        with patch("app.utils.report_export.get_openai_client", return_value=mock_client):
            summary = await exporter.generate_ai_summary(sample_report_data)
        assert summary == "Unable to generate summary."

    @pytest.mark.asyncio
    async def test_ai_summary_uses_gpt4o_mini(self, exporter, sample_report_data):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Summary"

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        with patch("app.utils.report_export.get_openai_client", return_value=mock_client):
            await exporter.generate_ai_summary(sample_report_data)

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs["model"] == "gpt-4o-mini"
        assert call_kwargs["temperature"] == 0.4
