"""Tests for time log CRUD API endpoints."""

import pytest


class TestListTimeLogs:
    def test_list_time_logs_success(self, client):
        response = client.get("/time-logs/")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_list_time_logs_filter_client(self, client):
        response = client.get("/time-logs/?client_id=client_1")
        assert response.status_code == 200

    def test_list_time_logs_filter_date_range(self, client):
        response = client.get("/time-logs/?date_from=2026-01-01&date_to=2026-01-31")
        assert response.status_code == 200


class TestCreateTimeLog:
    def test_create_time_log_success(self, client):
        response = client.post("/time-logs/", json={
            "date": "2026-01-15",
            "client_id": "client_1",
            "description": "Work done",
            "start_time": "09:00:00",
            "end_time": "11:00:00",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_time_log_end_before_start(self, client):
        response = client.post("/time-logs/", json={
            "date": "2026-01-15",
            "client_id": "client_1",
            "description": "Work",
            "start_time": "11:00:00",
            "end_time": "09:00:00",
        })
        assert response.status_code == 400

    def test_create_time_log_equal_times(self, client):
        response = client.post("/time-logs/", json={
            "date": "2026-01-15",
            "client_id": "client_1",
            "description": "Work",
            "start_time": "09:00:00",
            "end_time": "09:00:00",
        })
        assert response.status_code == 400

    def test_create_time_log_missing_fields(self, client):
        response = client.post("/time-logs/", json={
            "date": "2026-01-15",
        })
        assert response.status_code == 422

    def test_create_time_log_all_fields(self, client):
        response = client.post("/time-logs/", json={
            "date": "2026-01-15",
            "client_id": "client_1",
            "task_id": "task_1",
            "description": "Detailed work",
            "start_time": "09:00:00",
            "end_time": "17:00:00",
            "is_billable": False,
        })
        assert response.status_code == 200


class TestGetTimeLog:
    def test_get_time_log_success(self, client):
        response = client.get("/time-logs/tl_1")
        assert response.status_code == 200

    def test_get_time_log_not_found(self, client):
        response = client.get("/time-logs/nonexistent")
        assert response.status_code == 404


class TestUpdateTimeLog:
    def test_update_time_log_not_found(self, client):
        response = client.put("/time-logs/nonexistent", json={
            "description": "Updated",
        })
        assert response.status_code == 404


class TestDeleteTimeLog:
    def test_delete_time_log_success(self, client):
        response = client.delete("/time-logs/tl_1")
        assert response.status_code == 200

    def test_delete_time_log_not_found(self, client):
        response = client.delete("/time-logs/nonexistent")
        assert response.status_code == 404


class TestTimeAllocation:
    def test_allocation_success(self, client):
        response = client.get("/time-logs/allocation")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_allocation_with_date_range(self, client):
        response = client.get("/time-logs/allocation?date_from=2026-01-01&date_to=2026-01-31")
        assert response.status_code == 200


class TestUtilization:
    def test_utilization_success(self, client):
        response = client.get("/time-logs/utilization")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
