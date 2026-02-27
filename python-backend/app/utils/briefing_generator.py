"""AI-powered meeting briefing generator.

Converts raw meeting data and transcripts into polished formal briefs
with client context, action items, and next steps — the "Fable Ops Gem".
"""

import logging
from datetime import datetime

import google.generativeai as genai

from app.config import get_settings
from app.models.meeting import BRIEFING_COLLECTION, MeetingBriefing
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)


class BriefingGenerator:
    """Generates formal meeting briefs from transcripts and meeting metadata."""

    def __init__(self) -> None:
        settings = get_settings()
        api_key = settings.GEMINI_API_KEY or settings.GOOGLE_AI_API_KEY
        self._configured = False

        if api_key:
            try:
                genai.configure(api_key=api_key)
                self._configured = True
            except Exception:
                logger.exception("Failed to initialise Gemini client")
        else:
            logger.warning(
                "Gemini API key not set — briefing generation will be unavailable"
            )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_client(self) -> None:
        """Raise if the Gemini client is not available."""
        if not self._configured:
            raise RuntimeError(
                "Gemini client is not configured. Set the GEMINI_API_KEY environment variable."
            )

    async def _chat(self, system: str, user: str) -> str:
        """Send a chat request to Gemini and return the response text."""
        self._ensure_client()

        model = genai.GenerativeModel(
            "gemini-2.5-flash",
            system_instruction=system,
        )

        response = await model.generate_content_async(
            user,
            generation_config=genai.GenerationConfig(temperature=0.3),
        )
        return response.text or ""

    async def _fetch_client_context(self, client_id: str) -> dict | None:
        """Fetch client details from Firestore for context injection."""
        try:
            db = get_firestore_client()
            doc = db.collection("clients").document(client_id).get()
            if doc.exists:
                data = doc.to_dict()
                return {
                    "name": data.get("name", ""),
                    "company": data.get("company", ""),
                    "industry": data.get("industry", ""),
                    "notes": data.get("notes", ""),
                    "status": data.get("status", ""),
                }
        except Exception:
            logger.debug("Could not fetch client context for %s", client_id)
        return None

    # ------------------------------------------------------------------
    # Prompt builders
    # ------------------------------------------------------------------

    def _build_system_prompt(self, fmt: str) -> str:
        """Return the system prompt for the requested briefing format."""
        base = (
            "You are a professional executive briefing writer for Fable, "
            "a creative operations consultancy. You produce clear, well-structured "
            "meeting briefs that capture the substance and context of each discussion."
        )

        if fmt == "formal":
            return (
                f"{base}\n\n"
                "Generate a FORMAL meeting brief with the following sections:\n"
                "1. **Header** — Meeting title, date, participants, and client (if applicable)\n"
                "2. **Executive Summary** — 2-3 sentences capturing the overall outcome\n"
                "3. **Key Discussion Points** — Bullet list of major topics discussed\n"
                "4. **Decisions Made** — Any decisions reached during the meeting\n"
                "5. **Action Items** — Who is responsible, what needs to be done, and by when\n"
                "6. **Next Steps** — Upcoming follow-ups and timelines\n"
                "7. **Context** — Linked tasks, projects, or prior meeting references\n\n"
                "Use professional language. If information is not available for a section, "
                "omit that section rather than inventing content."
            )
        elif fmt == "summary":
            return (
                f"{base}\n\n"
                "Generate a concise SUMMARY briefing with only:\n"
                "1. **Executive Summary** — 3-5 sentences covering the key outcome\n"
                "2. **Action Items** — Who, what, and when\n\n"
                "Keep it tight. No filler. Omit sections with no content."
            )
        elif fmt == "dispatch":
            return (
                f"{base}\n\n"
                "Generate a short TEAM DISPATCH — a concise internal update for the team.\n"
                "Format: one short paragraph summarising the meeting outcome, "
                "followed by a bullet list of immediate action items with owners.\n"
                "Keep the tone direct and informal. Maximum 150 words total."
            )
        else:
            # Default to formal if unknown format
            return self._build_system_prompt("formal")

    def _build_user_prompt(
        self,
        meeting: dict,
        transcript_text: str | None,
        client_context: dict | None,
    ) -> str:
        """Assemble the user prompt from meeting data and context."""
        parts: list[str] = []

        # Meeting metadata
        title = meeting.get("title", "Untitled Meeting")
        date = meeting.get("date", "Unknown date")
        participants = meeting.get("participants", [])

        parts.append(f"Meeting: {title}")
        parts.append(f"Date: {date}")
        if participants:
            parts.append(f"Participants: {', '.join(participants)}")

        # Client context
        if client_context:
            client_name = client_context.get("name", "")
            if client_name:
                parts.append(f"\nClient: {client_name}")
            company = client_context.get("company", "")
            if company:
                parts.append(f"Company: {company}")
            industry = client_context.get("industry", "")
            if industry:
                parts.append(f"Industry: {industry}")
            client_notes = client_context.get("notes", "")
            if client_notes:
                parts.append(f"Client notes: {client_notes}")
        elif meeting.get("client_name"):
            parts.append(f"\nClient: {meeting['client_name']}")

        # Transcript or notes
        if transcript_text and transcript_text.strip():
            parts.append(f"\n--- Transcript / Notes ---\n{transcript_text.strip()}")
        elif meeting.get("notes"):
            parts.append(
                f"\n--- Meeting Notes ---\n{meeting['notes'].strip()}"
            )

        # Previously extracted action items
        action_items = meeting.get("action_items", [])
        if action_items:
            items_text = "\n".join(f"- {item}" for item in action_items)
            parts.append(f"\n--- Extracted Action Items ---\n{items_text}")

        # Key topics
        key_topics = meeting.get("key_topics", [])
        if key_topics:
            parts.append(f"\nKey topics: {', '.join(key_topics)}")

        # Linked tasks
        task_ids = meeting.get("task_ids", [])
        if task_ids:
            parts.append(f"\nLinked task IDs: {', '.join(task_ids)}")

        # Summary (from prior processing)
        summary = meeting.get("summary")
        if summary:
            parts.append(f"\n--- Previously Generated Summary ---\n{summary}")

        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate_briefing(
        self,
        meeting: dict,
        transcript_text: str | None,
        format: str = "formal",
    ) -> str:
        """Generate a meeting briefing from meeting data and optional transcript.

        Args:
            meeting: Meeting document dict from Firestore.
            transcript_text: Full transcript text, or None.
            format: One of "formal", "summary", or "dispatch".

        Returns:
            The generated briefing content as a string.
        """
        self._ensure_client()

        # Fetch client context if client_id is present
        client_context = None
        client_id = meeting.get("client_id")
        if client_id:
            client_context = await self._fetch_client_context(client_id)

        system_prompt = self._build_system_prompt(format)
        user_prompt = self._build_user_prompt(meeting, transcript_text, client_context)

        content = await self._chat(system_prompt, user_prompt)
        return content

    async def save_briefing(
        self,
        meeting_id: str,
        content: str,
        format: str,
        user_id: str,
    ) -> MeetingBriefing:
        """Persist a generated briefing to Firestore.

        Args:
            meeting_id: The meeting this briefing belongs to.
            content: Generated briefing text.
            format: The format used ("formal", "summary", "dispatch").
            user_id: UID of the user who triggered the generation.

        Returns:
            A MeetingBriefing model instance with the persisted data.
        """
        db = get_firestore_client()
        now = datetime.utcnow().isoformat()

        doc_data = {
            "meeting_id": meeting_id,
            "content": content,
            "format": format,
            "generated_at": now,
            "generated_by": user_id,
        }

        _, doc_ref = db.collection(BRIEFING_COLLECTION).add(doc_data)

        return MeetingBriefing(
            id=doc_ref.id,
            meeting_id=meeting_id,
            content=content,
            format=format,
            generated_at=now,
            generated_by=user_id,
        )


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_generator: BriefingGenerator | None = None


def get_briefing_generator() -> BriefingGenerator:
    """Return a module-level singleton BriefingGenerator."""
    global _generator
    if _generator is None:
        _generator = BriefingGenerator()
    return _generator
