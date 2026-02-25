"""Meeting data models for Read.AI and Fireflies integrations."""

from enum import Enum

from pydantic import BaseModel

# --- Firestore collection names ---

COLLECTION_NAME = "meetings"
TRANSCRIPT_COLLECTION = "transcripts"
BRIEFING_COLLECTION = "meeting_briefings"


# --- Enums ---


class MeetingSource(str, Enum):
    """Source platform for a meeting record."""

    READ_AI = "read_ai"
    FIREFLIES = "fireflies"
    MANUAL = "manual"


# --- Transcript models ---


class TranscriptSegment(BaseModel):
    """Single segment of a meeting transcript."""

    speaker: str
    text: str
    start_time: float | None = None
    end_time: float | None = None


class MeetingTranscript(BaseModel):
    """Full meeting transcript with segmented and plain-text representations."""

    id: str
    meeting_id: str
    segments: list[TranscriptSegment] = []
    full_text: str = ""
    word_count: int = 0
    created_at: str = ""


# --- Meeting CRUD models ---


class MeetingCreate(BaseModel):
    """Payload for creating a new meeting record."""

    title: str
    date: str
    duration_minutes: int | None = None
    participants: list[str] = []
    source: MeetingSource = MeetingSource.MANUAL
    client_id: str | None = None
    task_ids: list[str] = []
    notes: str | None = None


class MeetingResponse(BaseModel):
    """Meeting document returned from the API."""

    id: str
    title: str
    date: str
    duration_minutes: int | None = None
    participants: list[str] = []
    source: MeetingSource = MeetingSource.MANUAL
    source_id: str | None = None
    client_id: str | None = None
    client_name: str | None = None
    task_ids: list[str] = []
    notes: str | None = None
    has_transcript: bool = False
    action_items: list[str] = []
    key_topics: list[str] = []
    summary: str | None = None
    created_at: str = ""
    updated_at: str = ""


# --- Briefing models ---


class BriefingRequest(BaseModel):
    """Request payload for generating a meeting briefing."""

    meeting_id: str
    format: str = "formal"
    include_action_items: bool = True


class MeetingBriefing(BaseModel):
    """AI-generated meeting briefing document."""

    id: str
    meeting_id: str
    content: str
    format: str = "formal"
    generated_at: str = ""
    generated_by: str = ""
