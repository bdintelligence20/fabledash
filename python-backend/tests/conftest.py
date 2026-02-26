"""Comprehensive test fixtures for FableDash Python backend.

Provides mocked Firebase/Firestore, auth overrides, sample data,
and a TestClient that requires no external services.
"""

import os
import sys
from datetime import datetime, date, time
from unittest.mock import MagicMock, AsyncMock, patch

import pytest
from dotenv import load_dotenv

# Ensure the project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Load test environment variables BEFORE any app imports
load_dotenv(".env.test")

# Ensure env vars are set so app.config.Settings can load without errors
os.environ.setdefault("FIREBASE_PROJECT_ID", "test-project")
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("FIREBASE_CREDENTIALS_PATH", "/nonexistent/path")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")


# ---------------------------------------------------------------------------
# Mock Firebase before any app code imports it
# ---------------------------------------------------------------------------

_mock_firebase_admin = MagicMock()
_mock_firebase_admin._apps = {"[DEFAULT]": MagicMock()}
_mock_firebase_admin.initialize_app = MagicMock()

sys.modules.setdefault("firebase_admin", _mock_firebase_admin)
sys.modules.setdefault("firebase_admin.auth", MagicMock())
sys.modules.setdefault("firebase_admin.credentials", MagicMock())
sys.modules.setdefault("firebase_admin.firestore", MagicMock())


# ---------------------------------------------------------------------------
# Mock Firestore document/collection helpers
# ---------------------------------------------------------------------------


class MockDocumentSnapshot:
    """Simulates a Firestore DocumentSnapshot."""

    def __init__(self, doc_id: str, data: dict | None, exists: bool = True):
        self.id = doc_id
        self._data = data
        self.exists = exists
        self.reference = MagicMock()

    def to_dict(self):
        return dict(self._data) if self._data else {}


class MockDocumentReference:
    """Simulates a Firestore DocumentReference."""

    def __init__(self, doc_id: str, data: dict | None = None, exists: bool = True):
        self.id = doc_id
        self._data = data
        self._exists = exists

    def get(self):
        return MockDocumentSnapshot(self.id, self._data, self._exists)

    def set(self, data, merge=False):
        self._data = data
        self._exists = True

    def update(self, data):
        if self._data is None:
            self._data = {}
        self._data.update(data)

    def delete(self):
        self._exists = False
        self._data = None


class MockQuery:
    """Simulates a Firestore query with chaining."""

    def __init__(self, docs=None):
        self._docs = docs or []

    def where(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def stream(self):
        return iter(self._docs)


class MockCollectionReference:
    """Simulates a Firestore CollectionReference."""

    def __init__(self, docs=None):
        self._docs = {d.id: d for d in (docs or [])}
        self._add_counter = 0

    def document(self, doc_id=None):
        if doc_id and doc_id in self._docs:
            snap = self._docs[doc_id]
            ref = MockDocumentReference(doc_id, snap._data, snap.exists)
            return ref
        if doc_id:
            return MockDocumentReference(doc_id, None, False)
        # Auto-generate ID for document() with no args
        self._add_counter += 1
        return MockDocumentReference(f"auto_{self._add_counter}")

    def add(self, data):
        self._add_counter += 1
        doc_id = f"new_doc_{self._add_counter}"
        ref = MockDocumentReference(doc_id, data)
        self._docs[doc_id] = MockDocumentSnapshot(doc_id, data)
        return (None, ref)

    def where(self, *args, **kwargs):
        return MockQuery(list(self._docs.values()))

    def order_by(self, *args, **kwargs):
        return MockQuery(list(self._docs.values()))

    def limit(self, *args, **kwargs):
        return MockQuery(list(self._docs.values()))

    def stream(self):
        return iter(self._docs.values())


class MockFirestoreClient:
    """Simulates the Firestore client with multiple collections."""

    def __init__(self):
        self._collections: dict[str, MockCollectionReference] = {}

    def collection(self, name: str) -> MockCollectionReference:
        if name not in self._collections:
            self._collections[name] = MockCollectionReference()
        return self._collections[name]

    def batch(self):
        return MockBatch()

    def set_collection(self, name: str, docs: list[MockDocumentSnapshot]):
        self._collections[name] = MockCollectionReference(docs)


class MockBatch:
    """Simulates a Firestore WriteBatch."""

    def __init__(self):
        self._operations = []

    def set(self, ref, data):
        self._operations.append(("set", ref, data))

    def delete(self, ref):
        self._operations.append(("delete", ref))

    def commit(self):
        pass


# ---------------------------------------------------------------------------
# Sample data factories
# ---------------------------------------------------------------------------


def make_client_doc(doc_id="client_1", name="Test Client", partner_group="collab"):
    """Create a sample client document snapshot."""
    return MockDocumentSnapshot(doc_id, {
        "name": name,
        "partner_group": partner_group,
        "contact_email": "test@example.com",
        "contact_phone": "+27123456789",
        "description": "Test client",
        "is_active": True,
        "created_at": datetime(2026, 1, 1),
        "updated_at": datetime(2026, 1, 1),
        "created_by": "user_1",
    })


def make_task_doc(doc_id="task_1", title="Test Task", client_id="client_1",
                  status="todo", priority="medium"):
    """Create a sample task document snapshot."""
    return MockDocumentSnapshot(doc_id, {
        "title": title,
        "description": "Test task description",
        "client_id": client_id,
        "status": status,
        "priority": priority,
        "due_date": datetime(2026, 3, 1),
        "assigned_to": "user_1",
        "comments": [],
        "attachments": [],
        "created_at": datetime(2026, 1, 1),
        "updated_at": datetime(2026, 1, 1),
        "created_by": "user_1",
    })


def make_time_log_doc(doc_id="tl_1", client_id="client_1", duration_minutes=120):
    """Create a sample time log document snapshot."""
    return MockDocumentSnapshot(doc_id, {
        "date": "2026-01-15",
        "client_id": client_id,
        "task_id": "task_1",
        "description": "Test time log",
        "start_time": "09:00",
        "end_time": "11:00",
        "is_billable": True,
        "duration_minutes": duration_minutes,
        "created_at": "2026-01-15T09:00:00",
        "updated_at": "2026-01-15T09:00:00",
        "created_by": "user_1",
    })


def make_meeting_doc(doc_id="meeting_1", title="Test Meeting"):
    """Create a sample meeting document snapshot."""
    return MockDocumentSnapshot(doc_id, {
        "title": title,
        "date": "2026-01-15",
        "duration_minutes": 60,
        "participants": ["Alice", "Bob"],
        "source": "manual",
        "source_id": None,
        "client_id": "client_1",
        "client_name": "Test Client",
        "task_ids": [],
        "notes": "Test notes",
        "has_transcript": False,
        "action_items": [],
        "key_topics": [],
        "summary": None,
        "created_at": "2026-01-15T10:00:00",
        "updated_at": "2026-01-15T10:00:00",
    })


def make_agent_doc(doc_id="agent_1", name="Test Agent", tier="ops_traffic",
                   client_id=None, status="active"):
    """Create a sample agent document snapshot."""
    return MockDocumentSnapshot(doc_id, {
        "name": name,
        "description": "Test agent",
        "tier": tier,
        "status": status,
        "client_id": client_id,
        "client_name": None,
        "parent_agent_id": None,
        "model": "gpt-4o-mini",
        "system_prompt": "You are a helpful assistant.",
        "capabilities": ["chat"],
        "document_ids": [],
        "conversation_count": 0,
        "created_at": datetime(2026, 1, 1),
        "updated_at": datetime(2026, 1, 1),
        "created_by": "user_1",
    })


def make_document_doc(doc_id="doc_1", filename="test.txt"):
    """Create a sample document snapshot."""
    return MockDocumentSnapshot(doc_id, {
        "filename": filename,
        "file_type": "text/plain",
        "file_size": 1024,
        "status": "ready",
        "agent_id": None,
        "client_id": None,
        "chunk_count": 3,
        "error_message": None,
        "uploaded_at": datetime(2026, 1, 1),
        "uploaded_by": "user_1",
    })


def make_conversation_doc(doc_id="conv_1", agent_id="agent_1"):
    """Create a sample conversation document snapshot."""
    return MockDocumentSnapshot(doc_id, {
        "agent_id": agent_id,
        "agent_name": "Test Agent",
        "title": "Test Conversation",
        "message_count": 0,
        "last_message_at": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "created_by": "user_1",
    })


def make_invoice_doc(doc_id="inv_1", amount=10000, status="paid"):
    """Create a sample invoice document snapshot."""
    return MockDocumentSnapshot(doc_id, {
        "id": doc_id,
        "sage_id": None,
        "client_id": "client_1",
        "invoice_number": "INV-001",
        "status": status,
        "amount": amount,
        "currency": "ZAR",
        "issued_date": "2026-01-15",
        "due_date": "2026-02-15",
        "paid_date": "2026-01-20",
        "description": "Test invoice",
        "created_at": "2026-01-15T00:00:00",
        "updated_at": "2026-01-15T00:00:00",
    })


def make_snapshot_doc(doc_id="snap_1", total_revenue=100000, total_expenses=60000):
    """Create a sample financial snapshot document."""
    return MockDocumentSnapshot(doc_id, {
        "id": doc_id,
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "net_profit": total_revenue - total_expenses,
        "cash_on_hand": 200000,
        "accounts_receivable": 50000,
        "accounts_payable": 30000,
        "invoice_count": 10,
        "payment_count": 8,
        "created_at": "2026-01-31T00:00:00",
        "source": "sage_sync",
    })


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_firestore():
    """Return a fresh MockFirestoreClient."""
    return MockFirestoreClient()


@pytest.fixture
def mock_firestore_with_data():
    """Return a MockFirestoreClient pre-loaded with sample data."""
    db = MockFirestoreClient()
    db.set_collection("clients", [make_client_doc()])
    db.set_collection("tasks", [make_task_doc()])
    db.set_collection("time_logs", [make_time_log_doc()])
    db.set_collection("meetings", [make_meeting_doc()])
    db.set_collection("agents", [make_agent_doc()])
    db.set_collection("documents", [make_document_doc()])
    db.set_collection("conversations", [make_conversation_doc()])
    db.set_collection("invoices", [make_invoice_doc()])
    db.set_collection("financial_snapshots", [make_snapshot_doc()])
    return db


@pytest.fixture
def mock_current_user():
    """Return a mock CurrentUser for dependency injection."""
    from app.models.user import CurrentUser, UserRole
    return CurrentUser(
        uid="user_1",
        email="ceo@fable.co.za",
        display_name="Test CEO",
        role=UserRole.CEO,
    )


@pytest.fixture
def mock_team_member():
    """Return a mock team member CurrentUser."""
    from app.models.user import CurrentUser, UserRole
    return CurrentUser(
        uid="user_2",
        email="member@fable.co.za",
        display_name="Team Member",
        role=UserRole.TEAM_MEMBER,
    )


@pytest.fixture
def client(mock_firestore_with_data, mock_current_user):
    """Create a TestClient with mocked Firebase and auth dependencies."""
    from fastapi.testclient import TestClient
    from app.dependencies.auth import get_current_user
    from app.utils.firebase_client import get_firestore_client
    from app.main import app

    def _override_get_firestore():
        return mock_firestore_with_data

    def _override_get_current_user():
        return mock_current_user

    app.dependency_overrides[get_firestore_client] = _override_get_firestore
    app.dependency_overrides[get_current_user] = _override_get_current_user

    # Also patch the module-level function used via direct import
    with patch("app.utils.firebase_client.get_firestore_client", return_value=mock_firestore_with_data), \
         patch("app.utils.firebase_client._db", mock_firestore_with_data):
        with TestClient(app) as test_client:
            yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def client_no_auth(mock_firestore_with_data):
    """Create a TestClient with mocked Firebase but NO auth override.

    Useful for testing auth-required endpoints return 401.
    """
    from fastapi.testclient import TestClient
    from app.utils.firebase_client import get_firestore_client
    from app.main import app

    def _override_get_firestore():
        return mock_firestore_with_data

    app.dependency_overrides[get_firestore_client] = _override_get_firestore

    with patch("app.utils.firebase_client.get_firestore_client", return_value=mock_firestore_with_data), \
         patch("app.utils.firebase_client._db", mock_firestore_with_data):
        with TestClient(app) as test_client:
            yield test_client

    app.dependency_overrides.clear()
