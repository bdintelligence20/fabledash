"""Tests for authentication API endpoints."""

import pytest
from unittest.mock import patch, MagicMock


class TestVerifyToken:
    def test_verify_token_success(self, client):
        response = client.post("/auth/verify")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["user"]["uid"] == "user_1"
        assert data["user"]["role"] == "ceo"

    def test_verify_token_returns_user_info(self, client):
        response = client.post("/auth/verify")
        data = response.json()
        assert "email" in data["user"]
        assert "display_name" in data["user"]


class TestGetMe:
    def test_get_me_success(self, client):
        response = client.get("/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["user"]["uid"] == "user_1"
        assert data["user"]["email"] == "ceo@fable.co.za"

    def test_get_me_returns_role(self, client):
        response = client.get("/auth/me")
        data = response.json()
        assert data["user"]["role"] == "ceo"


class TestSetRole:
    def test_set_role_invalid_role(self, client):
        with patch("app.api.auth.auth") as mock_auth:
            response = client.post("/auth/set-role", json={
                "uid": "user_2",
                "role": "superadmin",
            })
            assert response.status_code == 400

    def test_set_role_valid_ceo(self, client):
        with patch("app.api.auth.auth") as mock_auth:
            mock_user_record = MagicMock()
            mock_user_record.custom_claims = {}
            mock_auth.get_user.return_value = mock_user_record
            mock_auth.set_custom_user_claims = MagicMock()

            response = client.post("/auth/set-role", json={
                "uid": "user_2",
                "role": "ceo",
            })
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    def test_set_role_valid_team_member(self, client):
        with patch("app.api.auth.auth") as mock_auth:
            mock_user_record = MagicMock()
            mock_user_record.custom_claims = {}
            mock_auth.get_user.return_value = mock_user_record
            mock_auth.set_custom_user_claims = MagicMock()

            response = client.post("/auth/set-role", json={
                "uid": "user_2",
                "role": "team_member",
            })
            assert response.status_code == 200

    def test_set_role_user_not_found(self, client):
        with patch("app.api.auth.auth") as mock_auth:
            mock_auth.UserNotFoundError = type("UserNotFoundError", (Exception,), {})
            mock_auth.get_user.side_effect = mock_auth.UserNotFoundError("not found")

            response = client.post("/auth/set-role", json={
                "uid": "nonexistent",
                "role": "ceo",
            })
            assert response.status_code == 404

    def test_set_role_missing_fields(self, client):
        response = client.post("/auth/set-role", json={})
        assert response.status_code == 422
