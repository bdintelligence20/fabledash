"""Meeting sync service for pulling data from Read.AI and Fireflies into Firestore."""

import logging
from datetime import datetime

from app.models.meeting import (
    COLLECTION_NAME,
    TRANSCRIPT_COLLECTION,
    MeetingResponse,
    MeetingSource,
    MeetingTranscript,
    TranscriptSegment,
)
from app.utils.firebase_client import get_firestore_client
from app.utils.fireflies_client import FirefliesClient, get_fireflies_client
from app.utils.readai_client import ReadAIClient, get_readai_client

logger = logging.getLogger(__name__)


class MeetingSyncService:
    """Orchestrates syncing meeting data from external sources into Firestore.

    Pulls meetings from Read.AI and/or Fireflies.ai, maps them to
    MeetingResponse documents, and upserts into the Firestore meetings
    collection.  Duplicate detection uses ``source`` + ``source_id``.
    """

    def __init__(
        self,
        readai: ReadAIClient | None = None,
        fireflies: FirefliesClient | None = None,
    ) -> None:
        self.readai = readai or get_readai_client()
        self.fireflies = fireflies or get_fireflies_client()

    # ------------------------------------------------------------------
    # Public sync methods
    # ------------------------------------------------------------------

    async def sync_readai(self, since: datetime | None = None) -> dict:
        """Fetch meetings from Read.AI and upsert into Firestore.

        Args:
            since: Only sync meetings after this datetime.

        Returns:
            ``{"synced": int, "errors": list[str]}``
        """
        synced = 0
        errors: list[str] = []

        if not self.readai.is_configured():
            return {"synced": 0, "errors": ["Read.AI API key not configured"]}

        try:
            raw_meetings = await self.readai.get_meetings(since=since)
        except Exception as exc:
            logger.exception("Read.AI sync: failed to fetch meetings")
            return {"synced": 0, "errors": [f"Failed to fetch Read.AI meetings: {exc}"]}

        for raw in raw_meetings:
            try:
                meeting = self._map_readai_meeting(raw)
                await self._upsert_meeting(meeting)

                # Attempt to pull transcript
                source_id = raw.get("id", "")
                if source_id:
                    await self._sync_readai_transcript(meeting.id, source_id)

                synced += 1
            except Exception as exc:
                title = raw.get("title", "unknown")
                logger.exception("Read.AI sync: error processing meeting '%s'", title)
                errors.append(f"Error syncing Read.AI meeting '{title}': {exc}")

        logger.info("Read.AI sync complete: synced=%d errors=%d", synced, len(errors))
        return {"synced": synced, "errors": errors}

    async def sync_fireflies(self, since: datetime | None = None) -> dict:
        """Fetch transcripts from Fireflies and upsert into Firestore.

        Args:
            since: Only sync transcripts after this datetime.

        Returns:
            ``{"synced": int, "errors": list[str]}``
        """
        synced = 0
        errors: list[str] = []

        if not self.fireflies.is_configured():
            return {"synced": 0, "errors": ["Fireflies API key not configured"]}

        try:
            raw_transcripts = await self.fireflies.get_transcripts(since=since)
        except Exception as exc:
            logger.exception("Fireflies sync: failed to fetch transcripts")
            return {"synced": 0, "errors": [f"Failed to fetch Fireflies transcripts: {exc}"]}

        for raw in raw_transcripts:
            try:
                meeting = self._map_fireflies_meeting(raw)
                await self._upsert_meeting(meeting)

                # Attempt to pull detailed transcript
                source_id = raw.get("id", "")
                if source_id:
                    await self._sync_fireflies_transcript(meeting.id, source_id)

                synced += 1
            except Exception as exc:
                title = raw.get("title", "unknown")
                logger.exception("Fireflies sync: error processing transcript '%s'", title)
                errors.append(f"Error syncing Fireflies transcript '{title}': {exc}")

        logger.info("Fireflies sync complete: synced=%d errors=%d", synced, len(errors))
        return {"synced": synced, "errors": errors}

    async def sync_all(self, since: datetime | None = None) -> dict:
        """Run both Read.AI and Fireflies syncs and merge results.

        Args:
            since: Only sync records after this datetime.

        Returns:
            ``{"readai": {...}, "fireflies": {...}, "total_synced": int, "total_errors": int}``
        """
        readai_result = await self.sync_readai(since=since)
        fireflies_result = await self.sync_fireflies(since=since)

        return {
            "readai": readai_result,
            "fireflies": fireflies_result,
            "total_synced": readai_result["synced"] + fireflies_result["synced"],
            "total_errors": len(readai_result["errors"]) + len(fireflies_result["errors"]),
        }

    # ------------------------------------------------------------------
    # Client matching
    # ------------------------------------------------------------------

    async def _match_client(self, title: str, participants: list[str]) -> str | None:
        """Best-effort client matching based on meeting title and participants.

        Searches Firestore clients collection for a name that appears in
        the meeting title.  Falls back to checking participant email
        domains against client contact_email domains.

        Args:
            title: The meeting title.
            participants: List of participant names or emails.

        Returns:
            Client document ID if a match is found, else ``None``.
        """
        try:
            db = get_firestore_client()
            clients_ref = db.collection("clients")
            clients = list(clients_ref.where("is_active", "==", True).stream())

            title_lower = title.lower()

            # Pass 1: client name appears in meeting title
            for doc in clients:
                data = doc.to_dict()
                client_name = (data.get("name") or "").lower()
                if client_name and client_name in title_lower:
                    return doc.id

            # Pass 2: participant email domain matches client contact_email domain
            participant_domains: set[str] = set()
            for p in participants:
                if "@" in p:
                    participant_domains.add(p.split("@")[-1].lower())

            if participant_domains:
                for doc in clients:
                    data = doc.to_dict()
                    contact_email = data.get("contact_email") or ""
                    if "@" in contact_email:
                        client_domain = contact_email.split("@")[-1].lower()
                        if client_domain in participant_domains:
                            return doc.id

        except Exception:
            logger.exception("Client matching failed")

        return None

    # ------------------------------------------------------------------
    # Mapping helpers
    # ------------------------------------------------------------------

    def _map_readai_meeting(self, raw: dict) -> MeetingResponse:
        """Map a Read.AI meeting dict to a MeetingResponse.

        Uses ``source`` + ``source_id`` as the deterministic Firestore
        document ID so repeated syncs upsert instead of duplicating.
        """
        source_id = raw.get("id", "")
        doc_id = f"readai_{source_id}" if source_id else f"readai_{datetime.utcnow().timestamp()}"

        participants = raw.get("participants", [])
        if isinstance(participants, list) and participants and isinstance(participants[0], dict):
            participants = [p.get("name") or p.get("email", "") for p in participants]

        summary_data = raw.get("summary", {})
        summary_text = ""
        if isinstance(summary_data, str):
            summary_text = summary_data
        elif isinstance(summary_data, dict):
            summary_text = summary_data.get("overview", summary_data.get("text", ""))

        action_items = raw.get("action_items", [])
        if isinstance(action_items, list) and action_items and isinstance(action_items[0], dict):
            action_items = [item.get("text", str(item)) for item in action_items]

        key_topics = raw.get("key_topics", raw.get("topics", []))
        if isinstance(key_topics, list) and key_topics and isinstance(key_topics[0], dict):
            key_topics = [t.get("name", str(t)) for t in key_topics]

        return MeetingResponse(
            id=doc_id,
            title=raw.get("title", "Untitled Meeting"),
            date=raw.get("date", raw.get("start_time", "")),
            duration_minutes=raw.get("duration_minutes", raw.get("duration")),
            participants=participants,
            source=MeetingSource.READ_AI,
            source_id=source_id,
            has_transcript=raw.get("has_transcript", False),
            action_items=action_items,
            key_topics=key_topics,
            summary=summary_text or None,
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat(),
        )

    def _map_fireflies_meeting(self, raw: dict) -> MeetingResponse:
        """Map a Fireflies transcript dict to a MeetingResponse."""
        source_id = raw.get("id", "")
        doc_id = f"fireflies_{source_id}" if source_id else f"fireflies_{datetime.utcnow().timestamp()}"

        participants = raw.get("participants", [])
        if isinstance(participants, list) and participants and isinstance(participants[0], dict):
            participants = [p.get("name") or p.get("email", "") for p in participants]

        summary_data = raw.get("summary") or {}
        summary_text = ""
        action_items: list[str] = []
        key_topics: list[str] = []

        if isinstance(summary_data, dict):
            summary_text = summary_data.get("overview", "")
            raw_actions = summary_data.get("action_items", [])
            if isinstance(raw_actions, str):
                action_items = [line.strip() for line in raw_actions.split("\n") if line.strip()]
            elif isinstance(raw_actions, list):
                action_items = [str(a) for a in raw_actions]
            raw_keywords = summary_data.get("keywords", [])
            if isinstance(raw_keywords, list):
                key_topics = [str(k) for k in raw_keywords]

        # Fireflies returns duration in seconds
        duration_raw = raw.get("duration")
        duration_minutes = None
        if duration_raw is not None:
            try:
                duration_minutes = int(float(duration_raw) / 60)
            except (TypeError, ValueError):
                pass

        return MeetingResponse(
            id=doc_id,
            title=raw.get("title", "Untitled Meeting"),
            date=raw.get("date", ""),
            duration_minutes=duration_minutes,
            participants=participants,
            source=MeetingSource.FIREFLIES,
            source_id=source_id,
            has_transcript=True,  # Fireflies entries always have transcripts
            action_items=action_items,
            key_topics=key_topics,
            summary=summary_text or None,
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat(),
        )

    # ------------------------------------------------------------------
    # Firestore persistence
    # ------------------------------------------------------------------

    async def _upsert_meeting(self, meeting: MeetingResponse) -> None:
        """Write or update a meeting document in Firestore.

        The document ID is derived from ``source`` + ``source_id`` so
        repeated syncs are idempotent.  Client matching is attempted
        when ``client_id`` is not already set.
        """
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(meeting.id)
        existing = doc_ref.get()

        data = meeting.model_dump(mode="json")

        if existing.exists:
            # Preserve manually set fields
            existing_data = existing.to_dict()
            for keep in ("client_id", "client_name", "task_ids", "notes"):
                if existing_data.get(keep):
                    data[keep] = existing_data[keep]
            data["updated_at"] = datetime.utcnow().isoformat()
            doc_ref.update(data)
        else:
            # Attempt client matching for new records
            if not data.get("client_id"):
                client_id = await self._match_client(
                    data.get("title", ""),
                    data.get("participants", []),
                )
                if client_id:
                    data["client_id"] = client_id
                    # Also try to fetch client name
                    try:
                        client_doc = db.collection("clients").document(client_id).get()
                        if client_doc.exists:
                            data["client_name"] = client_doc.to_dict().get("name")
                    except Exception:
                        pass

            doc_ref.set(data)

    # ------------------------------------------------------------------
    # Transcript sync helpers
    # ------------------------------------------------------------------

    async def _sync_readai_transcript(self, meeting_doc_id: str, source_id: str) -> None:
        """Pull transcript from Read.AI and store in Firestore."""
        try:
            raw = await self.readai.get_transcript(source_id)
            if not raw:
                return

            segments_raw = raw.get("segments", raw.get("transcript", []))
            segments = []
            full_parts: list[str] = []

            if isinstance(segments_raw, list):
                for seg in segments_raw:
                    if isinstance(seg, dict):
                        text = seg.get("text", "")
                        segments.append(TranscriptSegment(
                            speaker=seg.get("speaker", seg.get("speaker_name", "Unknown")),
                            text=text,
                            start_time=seg.get("start_time"),
                            end_time=seg.get("end_time"),
                        ))
                        full_parts.append(text)
            elif isinstance(segments_raw, str):
                full_parts.append(segments_raw)

            full_text = "\n".join(full_parts)
            transcript = MeetingTranscript(
                id=f"transcript_{meeting_doc_id}",
                meeting_id=meeting_doc_id,
                segments=segments,
                full_text=full_text,
                word_count=len(full_text.split()),
                created_at=datetime.utcnow().isoformat(),
            )

            db = get_firestore_client()
            db.collection(TRANSCRIPT_COLLECTION).document(transcript.id).set(
                transcript.model_dump(mode="json")
            )

            # Mark meeting as having a transcript
            db.collection(COLLECTION_NAME).document(meeting_doc_id).update(
                {"has_transcript": True}
            )
        except Exception:
            logger.exception("Failed to sync Read.AI transcript for %s", meeting_doc_id)

    async def _sync_fireflies_transcript(self, meeting_doc_id: str, source_id: str) -> None:
        """Pull transcript from Fireflies and store in Firestore."""
        try:
            raw = await self.fireflies.get_transcript(source_id)
            if not raw:
                return

            sentences = raw.get("sentences", [])
            segments = []
            full_parts: list[str] = []

            for s in sentences or []:
                if isinstance(s, dict):
                    text = s.get("text", "")
                    segments.append(TranscriptSegment(
                        speaker=s.get("speaker_name", "Unknown"),
                        text=text,
                        start_time=s.get("start_time"),
                        end_time=s.get("end_time"),
                    ))
                    full_parts.append(text)

            full_text = "\n".join(full_parts)
            transcript = MeetingTranscript(
                id=f"transcript_{meeting_doc_id}",
                meeting_id=meeting_doc_id,
                segments=segments,
                full_text=full_text,
                word_count=len(full_text.split()),
                created_at=datetime.utcnow().isoformat(),
            )

            db = get_firestore_client()
            db.collection(TRANSCRIPT_COLLECTION).document(transcript.id).set(
                transcript.model_dump(mode="json")
            )

            # Mark meeting as having a transcript
            db.collection(COLLECTION_NAME).document(meeting_doc_id).update(
                {"has_transcript": True}
            )
        except Exception:
            logger.exception("Failed to sync Fireflies transcript for %s", meeting_doc_id)


def get_meeting_sync_service() -> MeetingSyncService:
    """Return a new MeetingSyncService with default clients."""
    return MeetingSyncService()
