"""Tests for task CRUD API endpoints including comments and attachments."""

import pytest


class TestListTasks:
    def test_list_tasks_success(self, client):
        response = client.get("/tasks/")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert isinstance(data["data"], list)

    def test_list_tasks_filter_status(self, client):
        response = client.get("/tasks/?status=todo")
        assert response.status_code == 200

    def test_list_tasks_filter_client_id(self, client):
        response = client.get("/tasks/?client_id=client_1")
        assert response.status_code == 200

    def test_list_tasks_filter_priority(self, client):
        response = client.get("/tasks/?priority=high")
        assert response.status_code == 200

    def test_list_tasks_filter_assigned_to(self, client):
        response = client.get("/tasks/?assigned_to=user_1")
        assert response.status_code == 200


class TestCreateTask:
    def test_create_task_success(self, client):
        response = client.post("/tasks/", json={
            "title": "New Task",
            "client_id": "client_1",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["title"] == "New Task"

    def test_create_task_all_fields(self, client):
        response = client.post("/tasks/", json={
            "title": "Full Task",
            "description": "Full description",
            "client_id": "client_1",
            "status": "in_progress",
            "priority": "high",
            "due_date": "2026-03-01T00:00:00",
            "assigned_to": "user_1",
        })
        assert response.status_code == 200

    def test_create_task_missing_title(self, client):
        response = client.post("/tasks/", json={
            "client_id": "client_1",
        })
        assert response.status_code == 422

    def test_create_task_missing_client_id(self, client):
        response = client.post("/tasks/", json={
            "title": "No Client",
        })
        assert response.status_code == 422

    def test_create_task_invalid_status(self, client):
        response = client.post("/tasks/", json={
            "title": "Bad Status",
            "client_id": "c1",
            "status": "invalid_status",
        })
        assert response.status_code == 422


class TestGetTask:
    def test_get_task_success(self, client):
        response = client.get("/tasks/task_1")
        assert response.status_code == 200

    def test_get_task_not_found(self, client):
        response = client.get("/tasks/nonexistent")
        assert response.status_code == 404


class TestUpdateTask:
    def test_update_task_success(self, client):
        response = client.put("/tasks/task_1", json={
            "title": "Updated Task",
        })
        assert response.status_code == 200

    def test_update_task_not_found(self, client):
        response = client.put("/tasks/nonexistent", json={
            "title": "Updated",
        })
        assert response.status_code == 404

    def test_update_task_status(self, client):
        response = client.put("/tasks/task_1", json={
            "status": "done",
        })
        assert response.status_code == 200


class TestDeleteTask:
    def test_delete_task_success(self, client):
        response = client.delete("/tasks/task_1")
        assert response.status_code == 200

    def test_delete_task_not_found(self, client):
        response = client.delete("/tasks/nonexistent")
        assert response.status_code == 404


class TestTaskComments:
    def test_add_comment_success(self, client):
        response = client.post("/tasks/task_1/comments", json={
            "content": "Great work!",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_add_comment_empty_content(self, client):
        response = client.post("/tasks/task_1/comments", json={
            "content": "",
        })
        assert response.status_code == 400

    def test_add_comment_missing_content(self, client):
        response = client.post("/tasks/task_1/comments", json={})
        assert response.status_code == 400

    def test_add_comment_task_not_found(self, client):
        response = client.post("/tasks/nonexistent/comments", json={
            "content": "Comment",
        })
        assert response.status_code == 404

    def test_delete_comment_task_not_found(self, client):
        response = client.delete("/tasks/nonexistent/comments/cm1")
        assert response.status_code == 404


class TestTaskAttachments:
    def test_add_attachment_success(self, client):
        response = client.post("/tasks/task_1/attachments", json={
            "filename": "doc.pdf",
            "url": "https://example.com/doc.pdf",
        })
        assert response.status_code == 200

    def test_add_attachment_missing_filename(self, client):
        response = client.post("/tasks/task_1/attachments", json={
            "url": "https://example.com/doc.pdf",
        })
        assert response.status_code == 400

    def test_add_attachment_missing_url(self, client):
        response = client.post("/tasks/task_1/attachments", json={
            "filename": "doc.pdf",
        })
        assert response.status_code == 400

    def test_add_attachment_task_not_found(self, client):
        response = client.post("/tasks/nonexistent/attachments", json={
            "filename": "doc.pdf",
            "url": "https://example.com/doc.pdf",
        })
        assert response.status_code == 404

    def test_delete_attachment_task_not_found(self, client):
        response = client.delete("/tasks/nonexistent/attachments/at1")
        assert response.status_code == 404
