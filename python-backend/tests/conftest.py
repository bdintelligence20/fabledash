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
