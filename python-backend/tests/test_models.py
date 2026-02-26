"""Comprehensive Pydantic model validation tests for all app/models/."""

import datetime as dt
from datetime import datetime

import pytest
from pydantic import ValidationError

# ---------------------------------------------------------------------------
# Client models
# ---------------------------------------------------------------------------

from app.models.client import (
    ClientBase,
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    PartnerGroup,
)


class TestPartnerGroup:
    def test_valid_values(self):
        assert PartnerGroup.COLLAB.value == "collab"
        assert PartnerGroup.EDCP.value == "edcp"
        assert PartnerGroup.DIRECT_CLIENTS.value == "direct_clients"
        assert PartnerGroup.SEPARATE_BUSINESSES.value == "separate_businesses"

    def test_invalid_partner_group(self):
        with pytest.raises(ValueError):
            PartnerGroup("invalid")


class TestClientBase:
    def test_create_valid(self):
        c = ClientBase(name="Acme", partner_group=PartnerGroup.COLLAB)
        assert c.name == "Acme"
        assert c.partner_group == PartnerGroup.COLLAB
        assert c.is_active is True
        assert c.contact_email is None

    def test_all_fields(self):
        c = ClientBase(
            name="Acme",
            partner_group="edcp",
            contact_email="a@b.com",
            contact_phone="+27000",
            description="Desc",
            is_active=False,
        )
        assert c.partner_group == PartnerGroup.EDCP
        assert c.is_active is False

    def test_missing_name_raises(self):
        with pytest.raises(ValidationError):
            ClientBase(partner_group="collab")

    def test_missing_partner_group_raises(self):
        with pytest.raises(ValidationError):
            ClientBase(name="Acme")

    def test_invalid_partner_group_raises(self):
        with pytest.raises(ValidationError):
            ClientBase(name="Acme", partner_group="nonexistent")


class TestClientCreate:
    def test_inherits_client_base(self):
        c = ClientCreate(name="X", partner_group="collab")
        assert isinstance(c, ClientBase)

    def test_valid_create(self):
        c = ClientCreate(name="X", partner_group="direct_clients")
        assert c.name == "X"


class TestClientUpdate:
    def test_all_optional(self):
        u = ClientUpdate()
        assert u.name is None
        assert u.partner_group is None
        assert u.is_active is None

    def test_partial_update(self):
        u = ClientUpdate(name="New Name")
        assert u.name == "New Name"
        assert u.partner_group is None


class TestClientResponse:
    def test_valid_response(self):
        r = ClientResponse(
            id="123",
            name="X",
            partner_group="collab",
            created_at=datetime(2026, 1, 1),
            updated_at=datetime(2026, 1, 1),
            created_by="user1",
        )
        assert r.id == "123"
        assert r.created_by == "user1"

    def test_missing_id_raises(self):
        with pytest.raises(ValidationError):
            ClientResponse(
                name="X",
                partner_group="collab",
                created_at=datetime(2026, 1, 1),
                updated_at=datetime(2026, 1, 1),
                created_by="user1",
            )


# ---------------------------------------------------------------------------
# Task models
# ---------------------------------------------------------------------------

from app.models.task import (
    TaskBase,
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskStatus,
    TaskPriority,
    TaskComment,
    TaskAttachment,
)


class TestTaskStatus:
    def test_all_values(self):
        assert TaskStatus.TODO.value == "todo"
        assert TaskStatus.IN_PROGRESS.value == "in_progress"
        assert TaskStatus.IN_REVIEW.value == "in_review"
        assert TaskStatus.DONE.value == "done"
        assert TaskStatus.BLOCKED.value == "blocked"

    def test_invalid_status(self):
        with pytest.raises(ValueError):
            TaskStatus("canceled")


class TestTaskPriority:
    def test_all_values(self):
        assert TaskPriority.LOW.value == "low"
        assert TaskPriority.MEDIUM.value == "medium"
        assert TaskPriority.HIGH.value == "high"
        assert TaskPriority.URGENT.value == "urgent"


class TestTaskBase:
    def test_defaults(self):
        t = TaskBase(title="My Task", client_id="c1")
        assert t.status == TaskStatus.TODO
        assert t.priority == TaskPriority.MEDIUM
        assert t.description is None
        assert t.assigned_to is None

    def test_missing_title_raises(self):
        with pytest.raises(ValidationError):
            TaskBase(client_id="c1")

    def test_missing_client_id_raises(self):
        with pytest.raises(ValidationError):
            TaskBase(title="My Task")

    def test_with_all_fields(self):
        t = TaskBase(
            title="T",
            client_id="c1",
            description="Desc",
            status="in_progress",
            priority="high",
            due_date=datetime(2026, 3, 1),
            assigned_to="u1",
        )
        assert t.status == TaskStatus.IN_PROGRESS
        assert t.priority == TaskPriority.HIGH


class TestTaskCreate:
    def test_inherits(self):
        t = TaskCreate(title="T", client_id="c1")
        assert isinstance(t, TaskBase)


class TestTaskUpdate:
    def test_all_optional(self):
        u = TaskUpdate()
        assert u.title is None
        assert u.status is None
        assert u.priority is None

    def test_partial(self):
        u = TaskUpdate(status="done")
        assert u.status == TaskStatus.DONE


class TestTaskComment:
    def test_valid(self):
        c = TaskComment(
            id="cm1",
            content="Hello",
            author_uid="u1",
            created_at=datetime(2026, 1, 1),
        )
        assert c.id == "cm1"
        assert c.author_name is None


class TestTaskAttachment:
    def test_valid(self):
        a = TaskAttachment(
            id="at1",
            filename="doc.pdf",
            url="https://example.com/doc.pdf",
            uploaded_by="u1",
            uploaded_at=datetime(2026, 1, 1),
        )
        assert a.content_type is None


class TestTaskResponse:
    def test_valid(self):
        r = TaskResponse(
            id="t1",
            title="T",
            client_id="c1",
            created_at=datetime(2026, 1, 1),
            updated_at=datetime(2026, 1, 1),
            created_by="u1",
        )
        assert r.comments == []
        assert r.attachments == []


# ---------------------------------------------------------------------------
# Time log models
# ---------------------------------------------------------------------------

from app.models.time_log import (
    TimeLogBase,
    TimeLogCreate,
    TimeLogUpdate,
    TimeLogResponse,
    calculate_duration_minutes,
)


class TestCalculateDurationMinutes:
    def test_normal(self):
        assert calculate_duration_minutes(dt.time(9, 0), dt.time(11, 30)) == 150

    def test_one_minute(self):
        assert calculate_duration_minutes(dt.time(9, 0), dt.time(9, 1)) == 1

    def test_full_day(self):
        assert calculate_duration_minutes(dt.time(0, 0), dt.time(23, 59)) == 1439

    def test_end_before_start_raises(self):
        with pytest.raises(ValueError, match="End time"):
            calculate_duration_minutes(dt.time(11, 0), dt.time(9, 0))

    def test_equal_times_raises(self):
        with pytest.raises(ValueError, match="End time"):
            calculate_duration_minutes(dt.time(9, 0), dt.time(9, 0))


class TestTimeLogBase:
    def test_valid(self):
        tl = TimeLogBase(
            date=dt.date(2026, 1, 15),
            client_id="c1",
            description="Work",
            start_time=dt.time(9, 0),
            end_time=dt.time(17, 0),
        )
        assert tl.is_billable is True
        assert tl.task_id is None

    def test_missing_fields_raises(self):
        with pytest.raises(ValidationError):
            TimeLogBase(date=dt.date(2026, 1, 15), client_id="c1")


class TestTimeLogCreate:
    def test_inherits(self):
        tl = TimeLogCreate(
            date=dt.date(2026, 1, 15),
            client_id="c1",
            description="Work",
            start_time=dt.time(9, 0),
            end_time=dt.time(17, 0),
        )
        assert isinstance(tl, TimeLogBase)


class TestTimeLogUpdate:
    def test_all_optional(self):
        u = TimeLogUpdate()
        assert u.date is None
        assert u.start_time is None

    def test_partial(self):
        u = TimeLogUpdate(is_billable=False)
        assert u.is_billable is False


class TestTimeLogResponse:
    def test_valid(self):
        r = TimeLogResponse(
            id="tl1",
            date=dt.date(2026, 1, 15),
            client_id="c1",
            description="Work",
            start_time=dt.time(9, 0),
            end_time=dt.time(17, 0),
            duration_minutes=480,
            created_at=datetime(2026, 1, 15),
            updated_at=datetime(2026, 1, 15),
            created_by="u1",
        )
        assert r.duration_minutes == 480


# ---------------------------------------------------------------------------
# Financial models
# ---------------------------------------------------------------------------

from app.models.financial import (
    SageCredentials,
    InvoiceResponse,
    PaymentResponse,
    FinancialSnapshot,
    PnlRow,
    PnlUpload,
    RevenueForecast,
)


class TestSageCredentials:
    def test_valid(self):
        sc = SageCredentials(
            access_token="at",
            refresh_token="rt",
            expires_at="2026-02-01T00:00:00Z",
            updated_at="2026-01-01T00:00:00Z",
        )
        assert sc.token_type == "Bearer"
        assert sc.scope is None

    def test_missing_required_raises(self):
        with pytest.raises(ValidationError):
            SageCredentials(access_token="at")


class TestInvoiceResponse:
    def test_valid(self):
        inv = InvoiceResponse(
            id="inv1",
            invoice_number="INV-001",
            status="paid",
            amount=10000.0,
            issued_date="2026-01-15",
            due_date="2026-02-15",
            created_at="2026-01-15T00:00:00",
            updated_at="2026-01-15T00:00:00",
        )
        assert inv.currency == "ZAR"
        assert inv.sage_id is None

    def test_overdue_status(self):
        inv = InvoiceResponse(
            id="inv2",
            invoice_number="INV-002",
            status="overdue",
            amount=5000.0,
            issued_date="2026-01-01",
            due_date="2026-01-31",
            created_at="2026-01-01T00:00:00",
            updated_at="2026-02-01T00:00:00",
        )
        assert inv.status == "overdue"


class TestPaymentResponse:
    def test_valid(self):
        p = PaymentResponse(
            id="pay1",
            amount=5000.0,
            payment_date="2026-01-20",
            created_at="2026-01-20T00:00:00",
            updated_at="2026-01-20T00:00:00",
        )
        assert p.currency == "ZAR"
        assert p.payment_method is None


class TestFinancialSnapshot:
    def test_valid(self):
        fs = FinancialSnapshot(
            id="snap1",
            period_start="2026-01-01",
            period_end="2026-01-31",
            total_revenue=100000.0,
            total_expenses=60000.0,
            net_profit=40000.0,
            invoice_count=10,
            payment_count=8,
            created_at="2026-01-31T00:00:00",
            source="sage_sync",
        )
        assert fs.cash_on_hand is None


class TestPnlRow:
    def test_valid(self):
        row = PnlRow(
            category="Revenue",
            actual=100000.0,
            period="2026-01",
        )
        assert row.subcategory is None
        assert row.forecast is None
        assert row.variance is None

    def test_with_forecast(self):
        row = PnlRow(
            category="Revenue",
            actual=100000.0,
            forecast=90000.0,
            variance=10000.0,
            period="2026-01",
        )
        assert row.variance == 10000.0


class TestPnlUpload:
    def test_valid(self):
        upload = PnlUpload(
            id="pnl1",
            filename="pnl.csv",
            period="2026-01",
            rows=[PnlRow(category="Revenue", actual=100000, period="2026-01")],
            uploaded_at="2026-01-31T00:00:00",
            uploaded_by="user1",
        )
        assert len(upload.rows) == 1


class TestRevenueForecast:
    def test_valid(self):
        fc = RevenueForecast(
            id="fc1",
            filename="forecast.csv",
            forecast_date="2026-01-15",
            entries=[{"client": "A", "amount": 50000}],
            uploaded_at="2026-01-15T00:00:00",
            uploaded_by="user1",
        )
        assert len(fc.entries) == 1


# ---------------------------------------------------------------------------
# Meeting models
# ---------------------------------------------------------------------------

from app.models.meeting import (
    MeetingSource,
    TranscriptSegment,
    MeetingTranscript,
    MeetingCreate,
    MeetingResponse,
    BriefingRequest,
    MeetingBriefing,
)


class TestMeetingSource:
    def test_values(self):
        assert MeetingSource.READ_AI.value == "read_ai"
        assert MeetingSource.FIREFLIES.value == "fireflies"
        assert MeetingSource.MANUAL.value == "manual"


class TestTranscriptSegment:
    def test_valid(self):
        seg = TranscriptSegment(speaker="Alice", text="Hello")
        assert seg.start_time is None
        assert seg.end_time is None


class TestMeetingTranscript:
    def test_valid(self):
        mt = MeetingTranscript(id="t1", meeting_id="m1")
        assert mt.segments == []
        assert mt.word_count == 0


class TestMeetingCreate:
    def test_valid_minimal(self):
        m = MeetingCreate(title="Stand-up", date="2026-01-15")
        assert m.source == MeetingSource.MANUAL
        assert m.participants == []

    def test_missing_title_raises(self):
        with pytest.raises(ValidationError):
            MeetingCreate(date="2026-01-15")


class TestMeetingResponse:
    def test_valid(self):
        r = MeetingResponse(id="m1", title="Meeting", date="2026-01-15")
        assert r.has_transcript is False
        assert r.action_items == []


class TestBriefingRequest:
    def test_defaults(self):
        br = BriefingRequest(meeting_id="m1")
        assert br.format == "formal"
        assert br.include_action_items is True


class TestMeetingBriefing:
    def test_valid(self):
        mb = MeetingBriefing(id="b1", meeting_id="m1", content="Summary text")
        assert mb.format == "formal"


# ---------------------------------------------------------------------------
# Agent models
# ---------------------------------------------------------------------------

from app.models.agent import (
    AgentTier,
    AgentStatus,
    AgentModel,
    AgentCreate,
    AgentUpdate,
    AgentResponse,
)


class TestAgentTier:
    def test_values(self):
        assert AgentTier.OPS_TRAFFIC.value == "ops_traffic"
        assert AgentTier.CLIENT_BASED.value == "client_based"


class TestAgentStatus:
    def test_values(self):
        assert AgentStatus.ACTIVE.value == "active"
        assert AgentStatus.PAUSED.value == "paused"
        assert AgentStatus.ARCHIVED.value == "archived"


class TestAgentModel:
    def test_values(self):
        assert AgentModel.GPT4O.value == "gpt-4o"
        assert AgentModel.GPT4O_MINI.value == "gpt-4o-mini"
        assert AgentModel.CLAUDE_SONNET.value == "claude-sonnet-4-6"
        assert AgentModel.CLAUDE_HAIKU.value == "claude-haiku-4-5"


class TestAgentCreate:
    def test_valid_ops(self):
        a = AgentCreate(name="Ops Agent", tier="ops_traffic")
        assert a.model == AgentModel.GPT4O_MINI
        assert a.capabilities == []

    def test_valid_client_based(self):
        a = AgentCreate(name="Client Agent", tier="client_based", client_id="c1")
        assert a.tier == AgentTier.CLIENT_BASED

    def test_missing_name_raises(self):
        with pytest.raises(ValidationError):
            AgentCreate(tier="ops_traffic")


class TestAgentUpdate:
    def test_all_optional(self):
        u = AgentUpdate()
        assert u.name is None
        assert u.model is None

    def test_partial(self):
        u = AgentUpdate(name="New Name", model="gpt-4o")
        assert u.model == AgentModel.GPT4O


class TestAgentResponse:
    def test_valid(self):
        r = AgentResponse(
            id="a1",
            name="Agent",
            tier="ops_traffic",
            status="active",
            model="gpt-4o-mini",
            created_at=datetime(2026, 1, 1),
            updated_at=datetime(2026, 1, 1),
            created_by="u1",
        )
        assert r.conversation_count == 0
        assert r.capabilities == []


# ---------------------------------------------------------------------------
# Document models
# ---------------------------------------------------------------------------

from app.models.document import (
    DocumentStatus,
    DocumentResponse,
    DocumentChunk,
)


class TestDocumentStatus:
    def test_values(self):
        assert DocumentStatus.PROCESSING.value == "processing"
        assert DocumentStatus.READY.value == "ready"
        assert DocumentStatus.ERROR.value == "error"


class TestDocumentResponse:
    def test_valid(self):
        r = DocumentResponse(
            id="d1",
            filename="test.pdf",
            uploaded_at=datetime(2026, 1, 1),
            uploaded_by="u1",
        )
        assert r.status == DocumentStatus.PROCESSING
        assert r.file_size == 0
        assert r.chunk_count == 0


class TestDocumentChunk:
    def test_valid(self):
        c = DocumentChunk(
            id="ch1",
            document_id="d1",
            content="Some text",
            chunk_index=0,
        )
        assert c.metadata == {}


# ---------------------------------------------------------------------------
# Chat models
# ---------------------------------------------------------------------------

from app.models.chat import (
    MessageRole,
    ChatMessage,
    ConversationCreate,
    ConversationResponse,
    SendMessageBody,
)


class TestMessageRole:
    def test_values(self):
        assert MessageRole.USER.value == "user"
        assert MessageRole.ASSISTANT.value == "assistant"
        assert MessageRole.SYSTEM.value == "system"


class TestChatMessage:
    def test_valid(self):
        msg = ChatMessage(
            id="msg1",
            conversation_id="conv1",
            role="user",
            content="Hello",
            created_at="2026-01-01T00:00:00",
        )
        assert msg.sources == []

    def test_missing_content_raises(self):
        with pytest.raises(ValidationError):
            ChatMessage(
                id="msg1",
                conversation_id="conv1",
                role="user",
                created_at="2026-01-01T00:00:00",
            )


class TestConversationCreate:
    def test_valid(self):
        cc = ConversationCreate(agent_id="a1")
        assert cc.title is None

    def test_with_title(self):
        cc = ConversationCreate(agent_id="a1", title="My Chat")
        assert cc.title == "My Chat"


class TestSendMessageBody:
    def test_valid(self):
        smb = SendMessageBody(content="Hello")
        assert smb.content == "Hello"


class TestConversationResponse:
    def test_valid(self):
        cr = ConversationResponse(
            id="conv1",
            agent_id="a1",
            created_at="2026-01-01T00:00:00",
            created_by="u1",
        )
        assert cr.message_count == 0
        assert cr.agent_name is None


# ---------------------------------------------------------------------------
# User models
# ---------------------------------------------------------------------------

from app.models.user import UserRole, CurrentUser


class TestUserRole:
    def test_values(self):
        assert UserRole.CEO.value == "ceo"
        assert UserRole.TEAM_MEMBER.value == "team_member"


class TestCurrentUser:
    def test_valid(self):
        u = CurrentUser(uid="u1")
        assert u.role == UserRole.TEAM_MEMBER
        assert u.email is None
        assert u.custom_claims is None

    def test_ceo(self):
        u = CurrentUser(uid="u1", role="ceo", email="ceo@test.com")
        assert u.role == UserRole.CEO


# ---------------------------------------------------------------------------
# Base models
# ---------------------------------------------------------------------------

from app.models.base import BaseResponse, ErrorResponse


class TestBaseResponse:
    def test_valid(self):
        r = BaseResponse(success=True, message="OK")
        assert r.success is True

    def test_no_message(self):
        r = BaseResponse(success=False)
        assert r.message is None


class TestErrorResponse:
    def test_valid(self):
        e = ErrorResponse(error="Something broke")
        assert e.success is False
        assert e.detail is None

    def test_with_detail(self):
        e = ErrorResponse(error="Fail", detail="Stack trace here")
        assert e.detail == "Stack trace here"
