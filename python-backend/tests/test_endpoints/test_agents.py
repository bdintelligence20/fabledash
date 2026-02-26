"""Tests for agent CRUD and ops/client agent API endpoints."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock


class TestListAgents:
    def test_list_agents(self, client):
        response = client.get("/agents/")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_list_agents_filter_tier(self, client):
        response = client.get("/agents/?tier=ops_traffic")
        assert response.status_code == 200

    def test_list_agents_filter_status(self, client):
        response = client.get("/agents/?status=active")
        assert response.status_code == 200


class TestCreateAgent:
    def test_create_ops_agent(self, client):
        response = client.post("/agents/", json={
            "name": "New Ops Agent",
            "tier": "ops_traffic",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_client_agent_no_client_id(self, client):
        response = client.post("/agents/", json={
            "name": "Client Agent",
            "tier": "client_based",
        })
        assert response.status_code == 422

    def test_create_client_agent_success(self, client):
        response = client.post("/agents/", json={
            "name": "Client Agent",
            "tier": "client_based",
            "client_id": "client_1",
        })
        assert response.status_code == 200

    def test_create_agent_missing_name(self, client):
        response = client.post("/agents/", json={
            "tier": "ops_traffic",
        })
        assert response.status_code == 422

    def test_create_agent_invalid_tier(self, client):
        response = client.post("/agents/", json={
            "name": "Bad",
            "tier": "invalid_tier",
        })
        assert response.status_code == 422


class TestGetAgent:
    def test_get_agent_success(self, client):
        response = client.get("/agents/agent_1")
        assert response.status_code == 200

    def test_get_agent_not_found(self, client):
        response = client.get("/agents/nonexistent")
        assert response.status_code == 404


class TestUpdateAgent:
    def test_update_agent_success(self, client):
        response = client.put("/agents/agent_1", json={
            "name": "Updated Agent",
        })
        assert response.status_code == 200

    def test_update_agent_not_found(self, client):
        response = client.put("/agents/nonexistent", json={
            "name": "Updated",
        })
        assert response.status_code == 404


class TestDeleteAgent:
    def test_delete_agent_success(self, client):
        response = client.delete("/agents/agent_1")
        assert response.status_code == 200

    def test_delete_agent_not_found(self, client):
        response = client.delete("/agents/nonexistent")
        assert response.status_code == 404


class TestActivateAgent:
    def test_activate_agent(self, client):
        response = client.post("/agents/agent_1/activate")
        assert response.status_code == 200

    def test_activate_agent_not_found(self, client):
        response = client.post("/agents/nonexistent/activate")
        assert response.status_code == 404


class TestPauseAgent:
    def test_pause_agent(self, client):
        response = client.post("/agents/agent_1/pause")
        assert response.status_code == 200

    def test_pause_agent_not_found(self, client):
        response = client.post("/agents/nonexistent/pause")
        assert response.status_code == 404


class TestOpsBrief:
    def test_ops_brief(self, client):
        with patch("app.api.agents._get_ops_agent") as mock_ops:
            mock_agent = MagicMock()
            mock_agent.compile_brief = AsyncMock(return_value="Brief content")
            mock_ops.return_value = mock_agent

            response = client.post("/agents/ops/brief", json={
                "topic": "daily update",
                "context": {"key": "value"},
            })
            assert response.status_code == 200


class TestOpsDispatch:
    def test_ops_dispatch(self, client):
        with patch("app.api.agents._get_ops_agent") as mock_ops:
            mock_agent = MagicMock()
            mock_agent.dispatch_to_client_agent = AsyncMock(return_value={"dispatched": True})
            mock_ops.return_value = mock_agent

            response = client.post("/agents/ops/dispatch", json={
                "agent_id": "agent_1",
                "brief": "Some brief",
                "instructions": "Do this",
            })
            assert response.status_code == 200


class TestOpsAlerts:
    def test_ops_alerts(self, client):
        with patch("app.api.agents._get_ops_agent") as mock_ops:
            mock_agent = MagicMock()
            mock_agent.check_alerts = AsyncMock(return_value=[])
            mock_ops.return_value = mock_agent

            response = client.get("/agents/ops/alerts")
            assert response.status_code == 200


class TestOpsDailySummary:
    def test_ops_daily_summary(self, client):
        with patch("app.api.agents._get_ops_agent") as mock_ops:
            mock_agent = MagicMock()
            mock_agent.daily_summary = AsyncMock(return_value="All clear today.")
            mock_ops.return_value = mock_agent

            response = client.get("/agents/ops/daily-summary")
            assert response.status_code == 200


class TestAgentContext:
    def test_get_context_agent_not_found(self, client):
        response = client.get("/agents/nonexistent/context")
        assert response.status_code == 404
