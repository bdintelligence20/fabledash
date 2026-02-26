"""Tests for OpsAI intelligence API endpoints."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock


class TestAskOpsAI:
    def test_ask_empty_question(self, client):
        response = client.post("/opsai/ask", json={"question": "   "})
        assert response.status_code == 422

    def test_ask_success(self, client):
        with patch("app.api.opsai.get_opsai_engine") as mock_engine:
            engine = MagicMock()
            engine.openai_configured = True
            engine.ask = AsyncMock(return_value={
                "answer": "Utilization is 85%.",
                "data_sources": ["time_logs"],
                "query_tools_used": ["get_utilization"],
            })
            mock_engine.return_value = engine

            response = client.post("/opsai/ask", json={"question": "What's our utilization?"})
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["data"]["answer"] == "Utilization is 85%."

    def test_ask_openai_not_configured(self, client):
        with patch("app.api.opsai.get_opsai_engine") as mock_engine:
            engine = MagicMock()
            engine.openai_configured = False
            mock_engine.return_value = engine

            response = client.post("/opsai/ask", json={"question": "Hello"})
            assert response.status_code == 503

    def test_ask_missing_question(self, client):
        response = client.post("/opsai/ask", json={})
        assert response.status_code == 422


class TestSuggestedQuestions:
    def test_suggested_questions(self, client):
        response = client.get("/opsai/suggested-questions")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert isinstance(data["data"], list)
        assert len(data["data"]) > 0


class TestOpsAIStatus:
    def test_status(self, client):
        with patch("app.api.opsai.get_opsai_engine") as mock_engine:
            engine = MagicMock()
            engine.openai_configured = True
            mock_engine.return_value = engine

            response = client.get("/opsai/status")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "data_sources" in data["data"]


class TestProactiveAlerts:
    def test_get_alerts(self, client):
        with patch("app.api.opsai._get_proactive_engine") as mock_pe:
            engine = MagicMock()
            engine.run_all_checks = AsyncMock(return_value={
                "alerts": [],
                "summary": {"total": 0, "high": 0, "medium": 0, "by_type": {}},
                "checked_at": "2026-01-15T00:00:00",
            })
            mock_pe.return_value = engine

            response = client.get("/opsai/alerts")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    def test_get_alerts_summary(self, client):
        with patch("app.api.opsai._get_proactive_engine") as mock_pe:
            engine = MagicMock()
            engine.run_all_checks = AsyncMock(return_value={
                "alerts": [],
                "summary": {"total": 0, "high": 0, "medium": 0, "by_type": {}},
                "checked_at": "2026-01-15T00:00:00",
            })
            engine.generate_insight_summary = AsyncMock(return_value="All systems nominal.")
            mock_pe.return_value = engine

            response = client.get("/opsai/alerts/summary")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "insight" in data["data"]


class TestConfigureAlerts:
    def test_configure_alerts_success(self, client):
        response = client.post("/opsai/alerts/configure", json={
            "over_servicing_zar_hr_min": 500.0,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_configure_alerts_empty_body(self, client):
        response = client.post("/opsai/alerts/configure", json={})
        assert response.status_code == 422
