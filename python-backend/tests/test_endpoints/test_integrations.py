"""Tests for integration API endpoints (Gmail, Calendar, Drive)."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock


class TestGmailStatus:
    def test_gmail_status(self, client):
        with patch("app.api.integrations.get_gmail_client") as mock_gmail:
            mock_gmail.return_value = MagicMock(is_configured=lambda: False)
            response = client.get("/integrations/gmail/status")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["data"]["configured"] is False


class TestGmailStats:
    def test_gmail_stats_not_configured(self, client):
        with patch("app.api.integrations.get_gmail_client") as mock_gmail:
            mock_gmail.return_value = MagicMock(is_configured=lambda: False)
            response = client.get("/integrations/gmail/stats")
            assert response.status_code == 200
            data = response.json()
            assert data["data"]["configured"] is False

    def test_gmail_stats_configured(self, client):
        with patch("app.api.integrations.get_gmail_client") as mock_gmail:
            mock_client = MagicMock()
            mock_client.is_configured.return_value = True
            mock_client.get_email_stats = AsyncMock(return_value={"sent": 50, "received": 100})
            mock_gmail.return_value = mock_client

            response = client.get("/integrations/gmail/stats")
            assert response.status_code == 200


class TestGmailVolume:
    def test_gmail_volume_not_configured(self, client):
        with patch("app.api.integrations.get_gmail_client") as mock_gmail:
            mock_gmail.return_value = MagicMock(is_configured=lambda: False)
            response = client.get("/integrations/gmail/volume")
            assert response.status_code == 200


class TestCalendarStatus:
    def test_calendar_status(self, client):
        with patch("app.api.integrations.get_calendar_client") as mock_cal:
            mock_cal.return_value = MagicMock(is_configured=lambda: False)
            response = client.get("/integrations/calendar/status")
            assert response.status_code == 200
            data = response.json()
            assert data["data"]["configured"] is False


class TestCalendarMeetings:
    def test_calendar_meetings_not_configured(self, client):
        with patch("app.api.integrations.get_calendar_client") as mock_cal:
            mock_cal.return_value = MagicMock(is_configured=lambda: False)
            response = client.get("/integrations/calendar/meetings")
            assert response.status_code == 200

    def test_calendar_meetings_configured(self, client):
        with patch("app.api.integrations.get_calendar_client") as mock_cal:
            mock_client = MagicMock()
            mock_client.is_configured.return_value = True
            mock_client.get_meetings = AsyncMock(return_value=[])
            mock_cal.return_value = mock_client

            response = client.get("/integrations/calendar/meetings")
            assert response.status_code == 200


class TestCalendarDensity:
    def test_calendar_density_not_configured(self, client):
        with patch("app.api.integrations.get_calendar_client") as mock_cal:
            mock_cal.return_value = MagicMock(is_configured=lambda: False)
            response = client.get("/integrations/calendar/density")
            assert response.status_code == 200


class TestDriveStatus:
    def test_drive_status(self, client):
        with patch("app.api.integrations.get_gdrive_client") as mock_drive:
            mock_drive.return_value = MagicMock(is_configured=lambda: False)
            response = client.get("/integrations/drive/status")
            assert response.status_code == 200
            data = response.json()
            assert data["data"]["configured"] is False


class TestDriveFiles:
    def test_drive_files_not_configured(self, client):
        with patch("app.api.integrations.get_gdrive_client") as mock_drive:
            mock_drive.return_value = MagicMock(is_configured=lambda: False)
            response = client.get("/integrations/drive/files")
            assert response.status_code == 503

    def test_drive_files_configured(self, client):
        with patch("app.api.integrations.get_gdrive_client") as mock_drive:
            mock_client = MagicMock()
            mock_client.is_configured.return_value = True
            mock_client.list_files = AsyncMock(return_value=[])
            mock_drive.return_value = mock_client

            response = client.get("/integrations/drive/files")
            assert response.status_code == 200


class TestDriveGetFile:
    def test_drive_get_file_not_configured(self, client):
        with patch("app.api.integrations.get_gdrive_client") as mock_drive:
            mock_drive.return_value = MagicMock(is_configured=lambda: False)
            response = client.get("/integrations/drive/files/some_id")
            assert response.status_code == 503
