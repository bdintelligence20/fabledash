"""Tests for Sage integration API endpoints."""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock


class TestSageStatus:
    def test_sage_status(self, client):
        with patch("app.api.sage.get_sage_client") as mock_sage:
            mock_client = MagicMock()
            mock_client.is_connected = AsyncMock(return_value=False)
            mock_sage.return_value = mock_client

            response = client.get("/sage/status")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["data"]["connected"] is False

    def test_sage_status_connected(self, client):
        with patch("app.api.sage.get_sage_client") as mock_sage:
            mock_creds = MagicMock()
            mock_creds.updated_at = "2026-01-15T00:00:00"
            mock_client = MagicMock()
            mock_client.is_connected = AsyncMock(return_value=True)
            mock_client.get_credentials = AsyncMock(return_value=mock_creds)
            mock_sage.return_value = mock_client

            response = client.get("/sage/status")
            assert response.status_code == 200
            data = response.json()
            assert data["data"]["connected"] is True
            assert data["data"]["last_sync"] is not None


class TestSageConnect:
    def test_sage_connect(self, client):
        with patch("app.api.sage.get_sage_client") as mock_sage:
            mock_client = MagicMock()
            mock_client.build_authorization_url.return_value = "https://sage.com/auth"
            mock_sage.return_value = mock_client

            response = client.get("/sage/connect")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "authorization_url" in data["data"]


class TestSageCallback:
    def test_sage_callback_success(self, client):
        with patch("app.api.sage.get_sage_client") as mock_sage:
            mock_client = MagicMock()
            mock_client.exchange_code = AsyncMock()
            mock_sage.return_value = mock_client

            response = client.get("/sage/callback?code=test_code")
            assert response.status_code == 200

    def test_sage_callback_failure(self, client):
        with patch("app.api.sage.get_sage_client") as mock_sage:
            mock_client = MagicMock()
            mock_client.exchange_code = AsyncMock(side_effect=RuntimeError("fail"))
            mock_sage.return_value = mock_client

            response = client.get("/sage/callback?code=bad_code")
            assert response.status_code == 400


class TestSageDisconnect:
    def test_sage_disconnect(self, client):
        response = client.post("/sage/disconnect")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestSageSync:
    def test_sage_sync_not_connected(self, client):
        with patch("app.api.sage.get_sage_client") as mock_sage:
            mock_client = MagicMock()
            mock_client.is_connected = AsyncMock(return_value=False)
            mock_sage.return_value = mock_client

            response = client.post("/sage/sync")
            assert response.status_code == 400

    def test_sage_sync_incremental(self, client):
        with patch("app.api.sage.get_sage_client") as mock_sage, \
             patch("app.api.sage.SageSyncService") as mock_sync:
            mock_client = MagicMock()
            mock_client.is_connected = AsyncMock(return_value=True)
            mock_sage.return_value = mock_client

            mock_service = MagicMock()
            mock_service.sync_invoices = AsyncMock(return_value={"synced": 5})
            mock_service.sync_payments = AsyncMock(return_value={"synced": 3})
            mock_sync.return_value = mock_service

            response = client.post("/sage/sync")
            assert response.status_code == 200


class TestSageInvoices:
    def test_list_invoices(self, client):
        response = client.get("/sage/invoices")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_list_invoices_with_filters(self, client):
        response = client.get("/sage/invoices?status=paid&limit=10")
        assert response.status_code == 200


class TestSagePayments:
    def test_list_payments(self, client):
        response = client.get("/sage/payments")
        assert response.status_code == 200

    def test_list_payments_with_date_range(self, client):
        response = client.get("/sage/payments?date_from=2026-01-01&date_to=2026-01-31")
        assert response.status_code == 200


class TestSageSnapshots:
    def test_list_snapshots(self, client):
        response = client.get("/sage/snapshots")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
