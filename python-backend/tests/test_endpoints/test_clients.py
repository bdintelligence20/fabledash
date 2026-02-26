"""Tests for client CRUD API endpoints."""

import pytest


class TestListClients:
    def test_list_clients_success(self, client):
        response = client.get("/clients/")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "data" in data

    def test_list_clients_returns_list(self, client):
        response = client.get("/clients/")
        assert isinstance(response.json()["data"], list)

    def test_list_clients_filter_partner_group(self, client):
        response = client.get("/clients/?partner_group=collab")
        assert response.status_code == 200

    def test_list_clients_filter_is_active(self, client):
        response = client.get("/clients/?is_active=true")
        assert response.status_code == 200


class TestCreateClient:
    def test_create_client_success(self, client):
        response = client.post("/clients/", json={
            "name": "New Client",
            "partner_group": "collab",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == "New Client"

    def test_create_client_all_fields(self, client):
        response = client.post("/clients/", json={
            "name": "Full Client",
            "partner_group": "edcp",
            "contact_email": "full@example.com",
            "contact_phone": "+27000000000",
            "description": "Full description",
            "is_active": True,
        })
        assert response.status_code == 200

    def test_create_client_missing_name(self, client):
        response = client.post("/clients/", json={
            "partner_group": "collab",
        })
        assert response.status_code == 422

    def test_create_client_missing_partner_group(self, client):
        response = client.post("/clients/", json={
            "name": "No Group",
        })
        assert response.status_code == 422

    def test_create_client_invalid_partner_group(self, client):
        response = client.post("/clients/", json={
            "name": "Bad Group",
            "partner_group": "invalid_group",
        })
        assert response.status_code == 422


class TestGetClient:
    def test_get_client_success(self, client):
        response = client.get("/clients/client_1")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_get_client_not_found(self, client):
        response = client.get("/clients/nonexistent_id")
        assert response.status_code == 404


class TestUpdateClient:
    def test_update_client_success(self, client):
        response = client.put("/clients/client_1", json={
            "name": "Updated Name",
        })
        assert response.status_code == 200

    def test_update_client_not_found(self, client):
        response = client.put("/clients/nonexistent_id", json={
            "name": "Updated Name",
        })
        assert response.status_code == 404


class TestDeleteClient:
    def test_delete_client_success(self, client):
        response = client.delete("/clients/client_1")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_delete_client_not_found(self, client):
        response = client.delete("/clients/nonexistent_id")
        assert response.status_code == 404
