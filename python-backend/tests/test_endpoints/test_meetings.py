"""Tests for meeting API endpoints."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock


class TestListMeetings:
    def test_list_meetings(self, client):
        response = client.get("/meetings/")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_list_meetings_with_filters(self, client):
        response = client.get("/meetings/?client_id=client_1&source=manual")
        assert response.status_code == 200


class TestCreateMeeting:
    def test_create_meeting_success(self, client):
        response = client.post("/meetings/", json={
            "title": "New Meeting",
            "date": "2026-02-01",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_meeting_all_fields(self, client):
        response = client.post("/meetings/", json={
            "title": "Full Meeting",
            "date": "2026-02-01",
            "duration_minutes": 60,
            "participants": ["Alice", "Bob"],
            "source": "manual",
            "client_id": "client_1",
            "notes": "Some notes",
        })
        assert response.status_code == 200

    def test_create_meeting_missing_title(self, client):
        response = client.post("/meetings/", json={
            "date": "2026-02-01",
        })
        assert response.status_code == 422


class TestGetMeeting:
    def test_get_meeting_success(self, client):
        response = client.get("/meetings/meeting_1")
        assert response.status_code == 200

    def test_get_meeting_not_found(self, client):
        response = client.get("/meetings/nonexistent")
        assert response.status_code == 404


class TestUpdateMeeting:
    def test_update_meeting_success(self, client):
        response = client.put("/meetings/meeting_1", json={
            "title": "Updated Meeting",
            "date": "2026-02-15",
        })
        assert response.status_code == 200

    def test_update_meeting_not_found(self, client):
        response = client.put("/meetings/nonexistent", json={
            "title": "Updated",
            "date": "2026-02-15",
        })
        assert response.status_code == 404


class TestDeleteMeeting:
    def test_delete_meeting_success(self, client):
        response = client.delete("/meetings/meeting_1")
        assert response.status_code == 200

    def test_delete_meeting_not_found(self, client):
        response = client.delete("/meetings/nonexistent")
        assert response.status_code == 404


class TestMeetingStatus:
    def test_integration_status(self, client):
        with patch("app.utils.readai_client.get_readai_client") as mock_readai, \
             patch("app.utils.fireflies_client.get_fireflies_client") as mock_ff:
            mock_readai.return_value = MagicMock(is_configured=lambda: False)
            mock_ff.return_value = MagicMock(is_configured=lambda: False)

            response = client.get("/meetings/status")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True


class TestMeetingSync:
    def test_sync_trigger(self, client):
        with patch("app.api.meetings.get_meeting_sync_service") as mock_sync:
            mock_service = MagicMock()
            mock_service.sync_all = AsyncMock(return_value={
                "total_synced": 5, "total_errors": 0
            })
            mock_sync.return_value = mock_service

            response = client.post("/meetings/sync")
            assert response.status_code == 200


class TestMeetingTranscript:
    def test_get_transcript_meeting_not_found(self, client):
        response = client.get("/meetings/nonexistent/transcript")
        assert response.status_code == 404
