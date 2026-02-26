"""Tests for chat/conversation API endpoints."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock


class TestListConversations:
    def test_list_conversations(self, client):
        response = client.get("/chats/")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_list_conversations_filter_agent(self, client):
        response = client.get("/chats/?agent_id=agent_1")
        assert response.status_code == 200


class TestCreateConversation:
    def test_create_conversation_success(self, client):
        response = client.post("/chats/", json={
            "agent_id": "agent_1",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_conversation_agent_not_found(self, client):
        response = client.post("/chats/", json={
            "agent_id": "nonexistent_agent",
        })
        assert response.status_code == 404

    def test_create_conversation_missing_agent_id(self, client):
        response = client.post("/chats/", json={})
        assert response.status_code == 422


class TestGetConversation:
    def test_get_conversation_success(self, client):
        response = client.get("/chats/conv_1")
        assert response.status_code == 200

    def test_get_conversation_not_found(self, client):
        response = client.get("/chats/nonexistent")
        assert response.status_code == 404


class TestDeleteConversation:
    def test_delete_conversation_success(self, client):
        response = client.delete("/chats/conv_1")
        assert response.status_code == 200

    def test_delete_conversation_not_found(self, client):
        response = client.delete("/chats/nonexistent")
        assert response.status_code == 404


class TestListMessages:
    def test_list_messages_success(self, client):
        response = client.get("/chats/conv_1/messages")
        assert response.status_code == 200

    def test_list_messages_not_found(self, client):
        response = client.get("/chats/nonexistent/messages")
        assert response.status_code == 404
