"""Tier 1 Ops/Traffic Agent — CEO briefs, client-agent dispatch, proactive alerts, daily summary."""

import logging
import uuid
from datetime import datetime, timedelta, timezone

import google.generativeai as genai

from app.config import get_settings
from app.models.agent import COLLECTION_NAME as AGENTS_COLLECTION
from app.models.chat import (
    COLLECTION_NAME as CONVERSATIONS_COLLECTION,
    MESSAGES_COLLECTION,
    MessageRole,
)
from app.models.meeting import COLLECTION_NAME as MEETINGS_COLLECTION
from app.models.task import COLLECTION_NAME as TASKS_COLLECTION
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


class OpsTrafficAgent:
    """Tier 1 Ops/Traffic Agent for CEO-level operations intelligence.

    Capabilities:
    - Compile briefs from structured context via Gemini
    - Dispatch briefs to client agents (create conversation + send message)
    - Check for proactive alerts across tasks, meetings, time logs
    - Generate a daily CEO morning summary
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.db = get_firestore_client()
        self._gemini_configured = False

        api_key = settings.GEMINI_API_KEY or settings.GOOGLE_AI_API_KEY
        if api_key:
            genai.configure(api_key=api_key)
            self._gemini_configured = True
        else:
            logger.warning("Gemini API key not configured — OpsTrafficAgent AI features disabled")

    def _require_gemini(self) -> None:
        """Raise if Gemini is not configured."""
        if not self._gemini_configured:
            raise RuntimeError("Gemini API key is not configured")

    # ------------------------------------------------------------------
    # compile_brief
    # ------------------------------------------------------------------

    async def compile_brief(self, topic: str, context: dict) -> str:
        """Use Gemini to compile an ops brief from provided context.

        Args:
            topic: The brief's subject (e.g., "Client X onboarding status").
            context: Structured data dict (meetings, tasks, financials, etc.)

        Returns:
            A formatted operations brief string.
        """
        self._require_gemini()

        context_text = "\n".join(f"- {k}: {v}" for k, v in context.items())

        system_instruction = (
            "You are the Ops/Traffic Agent for FableDash, a CEO intelligence platform. "
            "Compile a concise, actionable executive brief. Use bullet points. "
            "Highlight risks, blockers, and recommended next steps."
        )

        model = genai.GenerativeModel(
            "gemini-2.5-flash",
            system_instruction=system_instruction,
        )

        prompt = (
            f"Topic: {topic}\n\n"
            f"Context:\n{context_text}\n\n"
            "Compile this into an executive operations brief."
        )

        response = await model.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.4,
                max_output_tokens=2000,
            ),
        )
        return response.text or ""

    # ------------------------------------------------------------------
    # dispatch_to_client_agent
    # ------------------------------------------------------------------

    async def dispatch_to_client_agent(
        self,
        agent_id: str,
        brief: str,
        instructions: str,
    ) -> dict:
        """Create a conversation with a client agent and send a brief as a message.

        Mirrors the logic in the chats API: creates a conversation document,
        saves the user message, generates an AI response, saves the assistant
        message, and updates conversation metadata.

        Args:
            agent_id: Target client agent Firestore ID.
            brief: The operations brief content to send.
            instructions: Additional instructions for the agent.

        Returns:
            Dict with conversation_id and assistant response content.
        """
        # Verify agent exists
        agent_doc = self.db.collection(AGENTS_COLLECTION).document(agent_id).get()
        if not agent_doc.exists:
            raise ValueError(f"Agent {agent_id} not found")

        agent_data = agent_doc.to_dict()
        agent_name = agent_data.get("name", "Agent")
        system_prompt = agent_data.get("system_prompt") or "You are a helpful AI assistant."

        # --- Create conversation ---
        now = _now_iso()
        conv_id = str(uuid.uuid4())
        conv_dict = {
            "agent_id": agent_id,
            "agent_name": agent_name,
            "title": f"Ops Dispatch: {brief[:60]}",
            "message_count": 0,
            "last_message_at": None,
            "created_at": now,
            "created_by": "ops_agent",
        }
        self.db.collection(CONVERSATIONS_COLLECTION).document(conv_id).set(conv_dict)

        # --- Save dispatch message ---
        user_msg_id = str(uuid.uuid4())
        user_content = f"## Operations Brief\n\n{brief}\n\n## Instructions\n\n{instructions}"
        user_msg_dict = {
            "conversation_id": conv_id,
            "role": MessageRole.USER.value,
            "content": user_content,
            "sources": [],
            "created_at": now,
        }
        self.db.collection(MESSAGES_COLLECTION).document(user_msg_id).set(user_msg_dict)

        # --- Generate AI response ---
        assistant_content = ""
        try:
            self._require_gemini()

            model = genai.GenerativeModel(
                "gemini-2.5-flash",
                system_instruction=system_prompt,
            )

            response = await model.generate_content_async(
                user_content,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=4000,
                ),
            )
            assistant_content = response.text or ""
        except Exception:
            logger.warning("Failed to generate dispatch response for agent %s", agent_id)
            assistant_content = "[Ops Agent] Dispatch delivered. AI response unavailable."

        # --- Save assistant message ---
        asst_now = _now_iso()
        asst_msg_id = str(uuid.uuid4())
        asst_msg_dict = {
            "conversation_id": conv_id,
            "role": MessageRole.ASSISTANT.value,
            "content": assistant_content,
            "sources": [],
            "created_at": asst_now,
        }
        self.db.collection(MESSAGES_COLLECTION).document(asst_msg_id).set(asst_msg_dict)

        # --- Update conversation metadata ---
        self.db.collection(CONVERSATIONS_COLLECTION).document(conv_id).update({
            "message_count": 2,
            "last_message_at": asst_now,
        })

        # --- Increment agent conversation_count ---
        try:
            agent_ref = self.db.collection(AGENTS_COLLECTION).document(agent_id)
            existing = agent_ref.get().to_dict() or {}
            agent_ref.update({
                "conversation_count": (existing.get("conversation_count", 0) + 1),
            })
        except Exception:
            logger.warning("Failed to increment conversation_count on agent %s", agent_id)

        return {
            "conversation_id": conv_id,
            "agent_id": agent_id,
            "agent_name": agent_name,
            "assistant_response": assistant_content,
        }

    # ------------------------------------------------------------------
    # check_alerts
    # ------------------------------------------------------------------

    async def check_alerts(self) -> list[dict]:
        """Query Firestore for proactive alerts across tasks and meetings.

        Alert types:
        - overdue_task: tasks with status != done and due_date < today
        - upcoming_deadline: tasks due within the next 3 days
        - unlinked_meeting: meetings without a client_id

        Returns:
            List of alert dicts with type, severity, message, entity_id.
        """
        alerts: list[dict] = []
        now = datetime.now(timezone.utc)
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        three_days = today + timedelta(days=3)

        # --- Overdue tasks ---
        try:
            tasks_query = self.db.collection(TASKS_COLLECTION).stream()
            for doc in tasks_query:
                task = doc.to_dict()
                due_date = task.get("due_date")
                status = task.get("status", "")

                if not due_date or status == "done":
                    continue

                # Handle both datetime objects and ISO strings
                if isinstance(due_date, str):
                    try:
                        due_dt = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        continue
                elif isinstance(due_date, datetime):
                    due_dt = due_date if due_date.tzinfo else due_date.replace(tzinfo=timezone.utc)
                else:
                    continue

                if due_dt < today:
                    alerts.append({
                        "type": "overdue_task",
                        "severity": "high",
                        "message": f"Task \"{task.get('title', 'Untitled')}\" is overdue (due {due_dt.strftime('%Y-%m-%d')})",
                        "entity_id": doc.id,
                    })
                elif due_dt <= three_days:
                    alerts.append({
                        "type": "upcoming_deadline",
                        "severity": "medium",
                        "message": f"Task \"{task.get('title', 'Untitled')}\" due {due_dt.strftime('%Y-%m-%d')}",
                        "entity_id": doc.id,
                    })
        except Exception:
            logger.warning("Failed to check task alerts", exc_info=True)

        # --- Unlinked meetings ---
        try:
            meetings_query = self.db.collection(MEETINGS_COLLECTION).stream()
            for doc in meetings_query:
                meeting = doc.to_dict()
                if not meeting.get("client_id"):
                    alerts.append({
                        "type": "unlinked_meeting",
                        "severity": "low",
                        "message": f"Meeting \"{meeting.get('title', 'Untitled')}\" has no linked client",
                        "entity_id": doc.id,
                    })
        except Exception:
            logger.warning("Failed to check meeting alerts", exc_info=True)

        return alerts

    # ------------------------------------------------------------------
    # daily_summary
    # ------------------------------------------------------------------

    async def daily_summary(self) -> str:
        """Compile a daily CEO morning briefing.

        Gathers:
        - Today's meetings
        - Overdue tasks
        - Upcoming deadlines (next 3 days)
        - Recent time log activity
        - Alert count

        Returns:
            Formatted daily summary string (via Gemini if available, plaintext fallback).
        """
        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        three_days = today_start + timedelta(days=3)

        # --- Gather today's meetings ---
        meetings_today: list[str] = []
        try:
            for doc in self.db.collection(MEETINGS_COLLECTION).stream():
                meeting = doc.to_dict()
                meeting_date = meeting.get("date", "")
                if isinstance(meeting_date, str) and meeting_date.startswith(today_str):
                    title = meeting.get("title", "Untitled")
                    participants = ", ".join(meeting.get("participants", []))
                    meetings_today.append(f"{title} ({participants})" if participants else title)
        except Exception:
            logger.warning("Failed to gather meetings for daily summary", exc_info=True)

        # --- Gather overdue + upcoming tasks ---
        overdue_tasks: list[str] = []
        upcoming_tasks: list[str] = []
        try:
            for doc in self.db.collection(TASKS_COLLECTION).stream():
                task = doc.to_dict()
                due_date = task.get("due_date")
                status = task.get("status", "")

                if not due_date or status == "done":
                    continue

                if isinstance(due_date, str):
                    try:
                        due_dt = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        continue
                elif isinstance(due_date, datetime):
                    due_dt = due_date if due_date.tzinfo else due_date.replace(tzinfo=timezone.utc)
                else:
                    continue

                title = task.get("title", "Untitled")
                if due_dt < today_start:
                    overdue_tasks.append(f"{title} (due {due_dt.strftime('%Y-%m-%d')})")
                elif due_dt <= three_days:
                    upcoming_tasks.append(f"{title} (due {due_dt.strftime('%Y-%m-%d')})")
        except Exception:
            logger.warning("Failed to gather tasks for daily summary", exc_info=True)

        # --- Gather recent time logs ---
        recent_time: list[str] = []
        try:
            time_query = (
                self.db.collection("time_logs")
                .order_by("created_at", direction="DESCENDING")
                .limit(10)
            )
            for doc in time_query.stream():
                tl = doc.to_dict()
                desc = tl.get("description", "")
                duration = tl.get("duration_minutes", 0)
                if desc:
                    recent_time.append(f"{desc} ({duration}min)")
        except Exception:
            logger.warning("Failed to gather time logs for daily summary", exc_info=True)

        # --- Get alert count ---
        alerts = await self.check_alerts()
        alert_count = len(alerts)
        high_alerts = sum(1 for a in alerts if a.get("severity") == "high")

        # --- Build raw summary data ---
        summary_data = (
            f"Date: {today_str}\n\n"
            f"MEETINGS TODAY ({len(meetings_today)}):\n"
            + ("\n".join(f"  - {m}" for m in meetings_today) or "  None scheduled")
            + f"\n\nOVERDUE TASKS ({len(overdue_tasks)}):\n"
            + ("\n".join(f"  - {t}" for t in overdue_tasks) or "  None")
            + f"\n\nUPCOMING DEADLINES ({len(upcoming_tasks)}):\n"
            + ("\n".join(f"  - {t}" for t in upcoming_tasks) or "  None")
            + f"\n\nRECENT TIME ACTIVITY ({len(recent_time)}):\n"
            + ("\n".join(f"  - {t}" for t in recent_time) or "  No recent entries")
            + f"\n\nALERTS: {alert_count} total ({high_alerts} high severity)"
        )

        # --- Format via Gemini if available ---
        if self._gemini_configured:
            try:
                model = genai.GenerativeModel(
                    "gemini-2.5-flash",
                    system_instruction=(
                        "You are the Ops/Traffic Agent for FableDash. "
                        "Format the following raw data into a concise CEO morning briefing. "
                        "Use clear sections, bullet points, and highlight anything urgent. "
                        "Keep it professional and actionable."
                    ),
                )

                response = await model.generate_content_async(
                    f"Generate the CEO morning briefing from this data:\n\n{summary_data}",
                    generation_config=genai.GenerationConfig(
                        temperature=0.3,
                        max_output_tokens=2000,
                    ),
                )
                return response.text or summary_data
            except Exception:
                logger.warning("Gemini formatting failed for daily summary — returning raw data")

        return summary_data
