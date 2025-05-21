import pytest
from fastapi.testclient import TestClient
import os
import sys
from dotenv import load_dotenv

# Add the parent directory to sys.path to allow imports from the app package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load environment variables from .env.test if it exists
load_dotenv('.env.test')

# Import the FastAPI app
from app.main import app

@pytest.fixture
def client():
    """
    Create a test client for the FastAPI app.
    """
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def mock_supabase(monkeypatch):
    """
    Mock the Supabase client for testing.
    This allows tests to run without a real Supabase connection.
    """
    class MockSupabaseTable:
        def __init__(self, name):
            self.name = name
            self.data = []
        
        def select(self, *args):
            return self
        
        def insert(self, data):
            return self
        
        def update(self, data):
            return self
        
        def delete(self):
            return self
        
        def eq(self, field, value):
            return self
        
        def in_(self, field, values):
            return self
        
        def gte(self, field, value):
            return self
        
        def lte(self, field, value):
            return self
        
        def order(self, field, desc=False):
            return self
        
        def single(self):
            return self
        
        def execute(self):
            # Return mock data based on the table name
            if self.name == "agents":
                return MockSupabaseResponse([
                    {"id": 1, "name": "Test Agent", "description": "A test agent", "is_parent": False, "parent_id": None, "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z"}
                ])
            elif self.name == "chats":
                return MockSupabaseResponse([
                    {"id": 1, "agent_id": 1, "title": "Test Chat", "parent_chat_id": None, "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z"}
                ])
            elif self.name == "messages":
                return MockSupabaseResponse([
                    {"id": 1, "chat_id": 1, "role": "user", "content": "Hello", "created_at": "2025-01-01T00:00:00Z"}
                ])
            elif self.name == "documents":
                return MockSupabaseResponse([
                    {"id": 1, "agent_id": 1, "filename": "test.pdf", "file_type": "pdf", "file_size": 1000, "content_type": "application/pdf", "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z"}
                ])
            elif self.name == "clients":
                return MockSupabaseResponse([
                    {"id": 1, "name": "Test Client", "email": "test@example.com", "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z"}
                ])
            elif self.name == "tasks":
                return MockSupabaseResponse([
                    {"id": 1, "title": "Test Task", "status_id": 1, "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z"}
                ])
            elif self.name == "task_statuses":
                return MockSupabaseResponse([
                    {"id": 1, "name": "To Do", "color": "#3498db", "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z"}
                ])
            else:
                return MockSupabaseResponse([])
    
    class MockSupabaseResponse:
        def __init__(self, data=None, error=None):
            self.data = data or []
            self.error = error
    
    class MockSupabase:
        def table(self, name):
            return MockSupabaseTable(name)
    
    # Patch the get_supabase_client function to return the mock
    from app.utils.supabase_client import get_supabase_client
    monkeypatch.setattr(get_supabase_client, "__call__", lambda: MockSupabase())
    
    return MockSupabase()

@pytest.fixture
def mock_openai(monkeypatch):
    """
    Mock the OpenAI client for testing.
    This allows tests to run without a real OpenAI API connection.
    """
    class MockOpenAIResponse:
        def __init__(self):
            self.choices = [
                type('obj', (object,), {
                    'message': type('obj', (object,), {
                        'content': "This is a mock response from the OpenAI API."
                    })
                })
            ]
            self.data = [
                type('obj', (object,), {
                    'embedding': [0.1] * 1536
                })
            ]
    
    class MockOpenAIChat:
        async def create(self, **kwargs):
            return MockOpenAIResponse()
    
    class MockOpenAIEmbeddings:
        async def create(self, **kwargs):
            return MockOpenAIResponse()
    
    class MockOpenAI:
        def __init__(self):
            self.chat = type('obj', (object,), {'completions': MockOpenAIChat()})
            self.embeddings = MockOpenAIEmbeddings()
    
    # Patch the get_openai_client function to return the mock
    from app.utils.openai_client import get_openai_client
    monkeypatch.setattr(get_openai_client, "__call__", lambda: MockOpenAI())
    
    return MockOpenAI()
