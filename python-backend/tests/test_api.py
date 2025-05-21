import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root_endpoint():
    """Test the root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to FableDash API"}

def test_health_check():
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

# Agent API tests
def test_get_agents():
    """Test getting all agents."""
    response = client.get("/api/agents/")
    assert response.status_code == 200
    assert "agents" in response.json()
    assert response.json()["success"] is True

# Chat API tests
def test_get_chats():
    """Test getting chats for an agent."""
    # This test assumes agent with ID 1 exists
    # In a real test, you would create a test agent first
    response = client.get("/api/chats/agent/1")
    # Even if the agent doesn't exist, the API should return a proper error
    assert response.status_code in [200, 404]
    if response.status_code == 200:
        assert "chats" in response.json()
        assert response.json()["success"] is True
    else:
        assert "detail" in response.json()

# Document API tests
def test_get_documents():
    """Test getting all documents."""
    response = client.get("/api/documents/")
    assert response.status_code == 200
    assert "documents" in response.json()
    assert response.json()["success"] is True

# Client API tests
def test_get_clients():
    """Test getting all clients."""
    response = client.get("/api/clients/")
    assert response.status_code == 200
    assert "clients" in response.json()
    assert response.json()["success"] is True

# Task API tests
def test_get_tasks():
    """Test getting all tasks."""
    response = client.get("/api/tasks/")
    assert response.status_code == 200
    assert "tasks" in response.json()
    assert response.json()["success"] is True

def test_get_task_statuses():
    """Test getting all task statuses."""
    response = client.get("/api/tasks/statuses")
    assert response.status_code == 200
    assert "statuses" in response.json()
    assert response.json()["success"] is True
