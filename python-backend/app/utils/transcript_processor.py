"""AI-powered transcript processing for meeting intelligence.

Uses Google Gemini to extract entities, generate summaries,
and identify action items from meeting transcripts.
"""

import json
import logging
from datetime import datetime

import google.generativeai as genai

from app.config import get_settings
from app.models.client import COLLECTION_NAME as CLIENTS_COLLECTION
from app.models.meeting import COLLECTION_NAME as MEETINGS_COLLECTION
from app.models.task import COLLECTION_NAME as TASKS_COLLECTION
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)


class TranscriptProcessor:
    """Orchestrates AI extraction, entity matching, and summarisation of meeting transcripts."""

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
            logger.warning("Gemini API key not set — transcript processing will be unavailable")

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

    # ------------------------------------------------------------------
    # Public extraction methods
    # ------------------------------------------------------------------

    async def extract_entities(self, text: str) -> dict:
        """Extract structured entities from transcript text via Gemini.

        Returns a dict with keys:
            client_names  -- list[str]
            task_refs     -- list[str]   (project/task references)
            people        -- list[str]
            dates         -- list[str]
            action_items  -- list[str]
        """
        system = (
            "You are an expert meeting analyst. Extract structured entities from "
            "the meeting transcript provided. Return ONLY valid JSON with the keys: "
            "client_names (list of company/client names mentioned), "
            "task_refs (list of project or task references), "
            "people (list of person names), "
            "dates (list of dates or deadlines mentioned), "
            "action_items (list of action items or follow-ups). "
            "If a category has no matches, return an empty list."
        )
        raw = await self._chat(system, text)

        # Strip markdown fencing if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("Failed to parse entity extraction JSON: %s", raw[:200])
            parsed = {
                "client_names": [],
                "task_refs": [],
                "people": [],
                "dates": [],
                "action_items": [],
            }
        return parsed

    async def match_entities_to_records(self, entities: dict) -> dict:
        """Fuzzy-match extracted entity names to Firestore client and task records.

        Returns:
            {
                "matched_client": {"id": ..., "name": ...} | None,
                "matched_tasks": [{"id": ..., "title": ...}, ...]
            }
        """
        db = get_firestore_client()
        matched_client = None
        matched_tasks: list[dict] = []

        # --- Match clients ---
        client_names: list[str] = entities.get("client_names", [])
        if client_names:
            try:
                clients_ref = db.collection(CLIENTS_COLLECTION)
                for doc in clients_ref.where("is_active", "==", True).stream():
                    doc_dict = doc.to_dict()
                    stored_name = (doc_dict.get("name") or "").lower()
                    for candidate in client_names:
                        # Simple substring / case-insensitive match
                        if (
                            candidate.lower() in stored_name
                            or stored_name in candidate.lower()
                        ):
                            matched_client = {"id": doc.id, "name": doc_dict.get("name", "")}
                            break
                    if matched_client:
                        break
            except Exception:
                logger.exception("Error matching client entities")

        # --- Match tasks ---
        task_refs: list[str] = entities.get("task_refs", [])
        if task_refs:
            try:
                tasks_ref = db.collection(TASKS_COLLECTION)
                for doc in tasks_ref.stream():
                    doc_dict = doc.to_dict()
                    stored_title = (doc_dict.get("title") or "").lower()
                    for candidate in task_refs:
                        if (
                            candidate.lower() in stored_title
                            or stored_title in candidate.lower()
                        ):
                            matched_tasks.append(
                                {"id": doc.id, "title": doc_dict.get("title", "")}
                            )
                            break
            except Exception:
                logger.exception("Error matching task entities")

        return {
            "matched_client": matched_client,
            "matched_tasks": matched_tasks,
        }

    async def generate_summary(self, text: str, title: str = "") -> str:
        """Generate a concise 3-5 bullet point summary of the transcript."""
        context = f" titled '{title}'" if title else ""
        system = (
            f"You are a concise meeting summariser. Summarise the meeting transcript{context} "
            "into 3-5 bullet points. Each bullet should capture a key discussion point, "
            "decision, or outcome. Return only the bullet points, one per line, "
            "prefixed with '- '."
        )
        return await self._chat(system, text)

    async def extract_action_items(self, text: str) -> list[str]:
        """Extract action items / follow-ups from the transcript.

        Returns a list of action item strings.
        """
        system = (
            "You are a meeting analyst. Extract all action items, follow-ups, and "
            "commitments from the meeting transcript. Return ONLY a JSON array of "
            "strings. Each string should be a single, concise action item. "
            "If there are no action items, return an empty array []."
        )
        raw = await self._chat(system, text)

        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

        try:
            items = json.loads(cleaned)
            if isinstance(items, list):
                return [str(i) for i in items]
        except json.JSONDecodeError:
            logger.warning("Failed to parse action items JSON: %s", raw[:200])
        return []

    # ------------------------------------------------------------------
    # Orchestration
    # ------------------------------------------------------------------

    async def process_transcript(self, meeting_id: str, text: str) -> dict:
        """Run the full processing pipeline on a meeting transcript.

        Steps:
            1. Extract entities via Gemini
            2. Fuzzy-match entities to Firestore clients/tasks
            3. Generate a bullet-point summary
            4. Extract action items
            5. Update the meeting document in Firestore

        Returns the combined results dict.
        """
        self._ensure_client()
        db = get_firestore_client()

        # Fetch the meeting to get title for summary context
        meeting_ref = db.collection(MEETINGS_COLLECTION).document(meeting_id)
        meeting_doc = meeting_ref.get()
        if not meeting_doc.exists:
            raise ValueError(f"Meeting {meeting_id} not found")

        meeting_data = meeting_doc.to_dict()
        title = meeting_data.get("title", "")

        # Run extraction steps (sequential to stay within rate limits)
        entities = await self.extract_entities(text)
        matches = await self.match_entities_to_records(entities)
        summary = await self.generate_summary(text, title)
        action_items = await self.extract_action_items(text)

        # Build the update payload
        update_payload: dict = {
            "summary": summary,
            "action_items": action_items,
            "key_topics": entities.get("people", []) + entities.get("dates", []),
            "updated_at": datetime.utcnow().isoformat(),
        }

        if matches.get("matched_client"):
            update_payload["client_id"] = matches["matched_client"]["id"]
            update_payload["client_name"] = matches["matched_client"]["name"]

        if matches.get("matched_tasks"):
            update_payload["task_ids"] = [t["id"] for t in matches["matched_tasks"]]

        # Persist to Firestore
        meeting_ref.update(update_payload)
        logger.info("Meeting %s processed successfully", meeting_id)

        return {
            "meeting_id": meeting_id,
            "summary": summary,
            "action_items": action_items,
            "entities": entities,
            "matched_client": matches.get("matched_client"),
            "matched_tasks": matches.get("matched_tasks", []),
        }


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_processor: TranscriptProcessor | None = None


def get_transcript_processor() -> TranscriptProcessor:
    """Return a module-level singleton TranscriptProcessor."""
    global _processor
    if _processor is None:
        _processor = TranscriptProcessor()
    return _processor
