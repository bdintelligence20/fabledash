"""Tests for financial upload and data API endpoints."""

import pytest
from unittest.mock import patch, MagicMock
from io import BytesIO


class TestPnlListEndpoint:
    def test_list_pnl_uploads(self, client):
        response = client.get("/financial/pnl")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_list_pnl_with_period_filter(self, client):
        response = client.get("/financial/pnl?period=2026-01")
        assert response.status_code == 200


class TestPnlGetEndpoint:
    def test_get_pnl_not_found(self, client):
        response = client.get("/financial/pnl/nonexistent")
        assert response.status_code == 404


class TestPnlDeleteEndpoint:
    def test_delete_pnl_not_found(self, client):
        response = client.delete("/financial/pnl/nonexistent")
        assert response.status_code == 404


class TestForecastListEndpoint:
    def test_list_forecasts(self, client):
        response = client.get("/financial/forecast")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestForecastGetEndpoint:
    def test_get_forecast_not_found(self, client):
        response = client.get("/financial/forecast/nonexistent")
        assert response.status_code == 404


class TestForecastDeleteEndpoint:
    def test_delete_forecast_not_found(self, client):
        response = client.delete("/financial/forecast/nonexistent")
        assert response.status_code == 404


class TestFinancialSummary:
    def test_financial_summary(self, client):
        with patch("app.api.financial_data.firebase_admin") as mock_fb:
            mock_fb._apps = {"[DEFAULT]": MagicMock()}
            response = client.get("/financial-data/summary")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "data" in data

    def test_financial_summary_with_period(self, client):
        with patch("app.api.financial_data.firebase_admin") as mock_fb:
            mock_fb._apps = {"[DEFAULT]": MagicMock()}
            response = client.get("/financial-data/summary?period=2026-01")
            assert response.status_code == 200


class TestRevenueTrend:
    def test_revenue_trend(self, client):
        response = client.get("/financial-data/revenue-trend")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_revenue_trend_with_months(self, client):
        response = client.get("/financial-data/revenue-trend?months=12")
        assert response.status_code == 200


class TestCostBenefit:
    def test_cost_benefit(self, client):
        response = client.get("/financial-data/cost-benefit")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_cost_benefit_with_dates(self, client):
        response = client.get("/financial-data/cost-benefit?date_from=2026-01-01&date_to=2026-01-31")
        assert response.status_code == 200


class TestVolumeRate:
    def test_volume_rate(self, client):
        response = client.get("/financial-data/volume-rate")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_volume_rate_with_dates(self, client):
        response = client.get("/financial-data/volume-rate?date_from=2026-01-01&date_to=2026-01-31")
        assert response.status_code == 200
