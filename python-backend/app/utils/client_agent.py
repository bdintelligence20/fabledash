"""Tier 2 Client-Based Agent with context loading, task execution, and reporting."""

import logging
from datetime import datetime

import google.generativeai as genai

from app.config import get_settings
from app.models.client import COLLECTION_NAME as CLIENTS_COLLECTION
from app.models.task import COLLECTION_NAME as TASKS_COLLECTION
from app.models.time_log import COLLECTION_NAME as TIME_LOGS_COLLECTION
from app.models.meeting import COLLECTION_NAME as MEETINGS_COLLECTION
from app.models.financial import INVOICES_COLLECTION
from app.utils.firebase_client import get_firestore_client
from app.utils.rag_engine import get_rag_engine

logger = logging.getLogger(__name__)


class ClientAgent:
    """A per-client agent that combines Firestore context with RAG-powered LLM generation.

    Each ClientAgent is bound to a single client and can:
    - Load rich context (tasks, time logs, meetings, invoices) from Firestore
    - Execute tasks using RAG + client-scoped documents
    - Answer queries with conversation history support
    - Generate structured reports (status, financial, activity)
    """

    def __init__(self, agent_config: dict) -> None:
        """Initialise the client agent from its stored configuration.

        Args:
            agent_config: Dict containing at minimum ``client_id``.  Optional
                keys: ``model``, ``system_prompt``, ``document_ids``, ``id``,
                ``data_sources`` (the agent's own Firestore ID).
        """
        self.config = agent_config
        self.client_id: str = agent_config["client_id"]
        self.agent_id: str | None = agent_config.get("id")
        self.model: str = agent_config.get("model", "gemini-2.5-flash")
        self.system_prompt: str | None = agent_config.get("system_prompt")
        self.document_ids: list[str] = agent_config.get("document_ids", [])
        self.data_sources: list[str] = agent_config.get("data_sources", ["firestore"])

        settings = get_settings()
        api_key = settings.GEMINI_API_KEY or settings.GOOGLE_AI_API_KEY
        if api_key:
            genai.configure(api_key=api_key)
            self._gemini_configured = True
        else:
            self._gemini_configured = False
            logger.warning("Gemini API key not set — ClientAgent LLM calls will fail")

        self._rag = get_rag_engine()

    # ------------------------------------------------------------------
    # Context loading
    # ------------------------------------------------------------------

    async def get_client_context(self) -> dict:
        """Fetch rich context for this agent's client from Firestore.

        Returns:
            Dict with keys: ``client``, ``tasks``, ``time_logs``,
            ``meetings``, ``invoices``.
        """
        db = get_firestore_client()

        # --- Client details ---
        client_doc = db.collection(CLIENTS_COLLECTION).document(self.client_id).get()
        client_data: dict | None = None
        if client_doc.exists:
            client_data = client_doc.to_dict()
            client_data["id"] = client_doc.id

        # --- Recent tasks (limit 10) ---
        tasks_query = (
            db.collection(TASKS_COLLECTION)
            .where("client_id", "==", self.client_id)
            .order_by("created_at", direction="DESCENDING")
            .limit(10)
        )
        tasks = []
        for doc in tasks_query.stream():
            d = doc.to_dict()
            d["id"] = doc.id
            tasks.append(d)

        # --- Recent time logs (limit 10) ---
        logs_query = (
            db.collection(TIME_LOGS_COLLECTION)
            .where("client_id", "==", self.client_id)
            .order_by("created_at", direction="DESCENDING")
            .limit(10)
        )
        time_logs = []
        for doc in logs_query.stream():
            d = doc.to_dict()
            d["id"] = doc.id
            time_logs.append(d)

        # --- Recent meetings (limit 5) ---
        meetings_query = (
            db.collection(MEETINGS_COLLECTION)
            .where("client_id", "==", self.client_id)
            .order_by("created_at", direction="DESCENDING")
            .limit(5)
        )
        meetings = []
        for doc in meetings_query.stream():
            d = doc.to_dict()
            d["id"] = doc.id
            meetings.append(d)

        # --- Recent invoices (limit 5) ---
        invoices_query = (
            db.collection(INVOICES_COLLECTION)
            .where("client_id", "==", self.client_id)
            .order_by("created_at", direction="DESCENDING")
            .limit(5)
        )
        invoices = []
        for doc in invoices_query.stream():
            d = doc.to_dict()
            d["id"] = doc.id
            invoices.append(d)

        context = {
            "client": client_data,
            "tasks": tasks,
            "time_logs": time_logs,
            "meetings": meetings,
            "invoices": invoices,
        }

        # Conditionally fetch integration data based on data_sources
        client_email = client_data.get("contact_email") if client_data else None
        client_name = client_data.get("name") if client_data else None

        if "calendar" in self.data_sources:
            try:
                from app.utils.integrations.calendar_client import get_calendar_client
                cal = get_calendar_client()
                cal_meetings = await cal.get_upcoming_meetings(days_ahead=7, days_back=7)
                # Filter to client-related meetings if possible
                context["calendar_meetings"] = cal_meetings[:10] if cal_meetings else []
            except Exception as exc:
                logger.debug("Calendar data unavailable for agent %s: %s", self.agent_id, exc)
                context["calendar_meetings"] = []

        if "gmail" in self.data_sources and client_email:
            try:
                from app.utils.integrations.gmail_client import get_gmail_client
                gmail = get_gmail_client()
                emails = await gmail.get_emails_with_contact(client_email, days=14)
                context["client_emails"] = emails[:10] if emails else []
            except Exception as exc:
                logger.debug("Gmail data unavailable for agent %s: %s", self.agent_id, exc)
                context["client_emails"] = []

        if "drive" in self.data_sources and client_name:
            try:
                from app.utils.integrations.gdrive_client import get_gdrive_client
                drive = get_gdrive_client()
                files = await drive.search_files(client_name)
                context["drive_files"] = files[:10] if files else []
            except Exception as exc:
                logger.debug("Drive data unavailable for agent %s: %s", self.agent_id, exc)
                context["drive_files"] = []

        return context

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_context_prompt(self, context: dict) -> str:
        """Serialise the client context dict into a human-readable prompt section."""
        parts: list[str] = []

        client = context.get("client")
        if client:
            parts.append(
                f"## Client\nName: {client.get('name', 'Unknown')}\n"
                f"Group: {client.get('partner_group', 'N/A')}\n"
                f"Email: {client.get('contact_email', 'N/A')}\n"
                f"Active: {client.get('is_active', True)}"
            )

        tasks = context.get("tasks", [])
        if tasks:
            task_lines = []
            for t in tasks:
                task_lines.append(
                    f"- [{t.get('status', '?')}] {t.get('title', 'Untitled')} "
                    f"(priority: {t.get('priority', 'medium')})"
                )
            parts.append("## Recent Tasks\n" + "\n".join(task_lines))

        time_logs = context.get("time_logs", [])
        if time_logs:
            log_lines = []
            for tl in time_logs:
                log_lines.append(
                    f"- {tl.get('date', '?')}: {tl.get('description', '')} "
                    f"({tl.get('duration_minutes', 0)} min, "
                    f"billable={tl.get('is_billable', True)})"
                )
            parts.append("## Recent Time Logs\n" + "\n".join(log_lines))

        meetings = context.get("meetings", [])
        if meetings:
            mtg_lines = []
            for m in meetings:
                mtg_lines.append(
                    f"- {m.get('date', '?')}: {m.get('title', 'Untitled')} "
                    f"({m.get('duration_minutes', 0)} min)"
                )
            parts.append("## Recent Meetings\n" + "\n".join(mtg_lines))

        invoices = context.get("invoices", [])
        if invoices:
            inv_lines = []
            for inv in invoices:
                inv_lines.append(
                    f"- #{inv.get('invoice_number', '?')} — "
                    f"{inv.get('currency', 'ZAR')} {inv.get('amount', 0):.2f} "
                    f"[{inv.get('status', '?')}] due {inv.get('due_date', '?')}"
                )
            parts.append("## Recent Invoices\n" + "\n".join(inv_lines))

        # Integration data sections
        cal_meetings = context.get("calendar_meetings", [])
        if cal_meetings:
            cal_lines = []
            for cm in cal_meetings:
                summary = cm.get("summary", "Untitled")
                start = cm.get("start", "?")
                cal_lines.append(f"- {start}: {summary}")
            parts.append("## Upcoming Calendar Events\n" + "\n".join(cal_lines))

        client_emails = context.get("client_emails", [])
        if client_emails:
            email_lines = []
            for em in client_emails:
                subj = em.get("subject", "No subject")
                date = em.get("date", "?")
                sender = em.get("from", "?")
                email_lines.append(f"- {date}: {subj} (from: {sender})")
            parts.append("## Recent Client Emails\n" + "\n".join(email_lines))

        drive_files = context.get("drive_files", [])
        if drive_files:
            file_lines = []
            for f in drive_files:
                name = f.get("name", "Untitled")
                modified = f.get("modifiedTime", "?")
                file_lines.append(f"- {name} (modified: {modified})")
            parts.append("## Related Drive Files\n" + "\n".join(file_lines))

        return "\n\n".join(parts) if parts else "No client context available."

    def _ensure_gemini(self) -> None:
        """Raise a clear error if Gemini is not configured."""
        if not self._gemini_configured:
            raise RuntimeError(
                "ClientAgent: Gemini client unavailable (API key not set)"
            )

    # ------------------------------------------------------------------
    # Task execution
    # ------------------------------------------------------------------

    async def execute_task(self, task_description: str) -> str:
        """Execute a task using RAG retrieval and client context.

        Args:
            task_description: Natural-language description of the task.

        Returns:
            The generated deliverable / response text.
        """
        self._ensure_gemini()
        context = await self.get_client_context()
        context_prompt = self._build_context_prompt(context)

        # Retrieve RAG context scoped to this client
        rag_context = await self._rag.retrieve_context(
            query=task_description,
            agent_id=self.agent_id,
            client_id=self.client_id,
        )

        system = (
            self.system_prompt
            or (
                "You are a dedicated client agent for a consulting business. "
                "Use the provided client context and documents to complete "
                "the requested task thoroughly and accurately."
            )
        )

        user_content = (
            f"# Client Context\n{context_prompt}\n\n"
            f"# Relevant Documents\n{rag_context or 'No documents found.'}\n\n"
            f"---\n\n# Task\n{task_description}"
        )

        model = genai.GenerativeModel(
            "gemini-2.5-flash",
            system_instruction=system,
        )

        response = await model.generate_content_async(user_content)
        return response.text or ""

    # ------------------------------------------------------------------
    # Query answering
    # ------------------------------------------------------------------

    async def answer_query(
        self,
        query: str,
        conversation_history: list[dict] | None = None,
    ) -> dict:
        """Answer a query with client context and RAG, optionally continuing a conversation.

        Args:
            query: The user's question.
            conversation_history: Optional list of prior ``{"role", "content"}`` messages.

        Returns:
            Dict with ``answer`` (str) and ``sources`` (list).
        """
        self._ensure_gemini()
        context = await self.get_client_context()
        context_prompt = self._build_context_prompt(context)

        # RAG retrieval
        rag_results = await self._rag._vector_store.search(
            query=query,
            agent_id=self.agent_id,
            client_id=self.client_id,
        )
        rag_context = "\n\n".join(r["content"] for r in rag_results) if rag_results else ""

        system = (
            self.system_prompt
            or (
                "You are a knowledgeable client agent. Answer the user's "
                "questions using the provided client context and documents. "
                "If you don't have enough information, say so."
            )
        )

        # Build the full prompt with context and conversation history
        full_prompt_parts = [
            f"# Client Context\n{context_prompt}\n\n"
            f"# Relevant Documents\n{rag_context or 'No documents found.'}\n\n"
            f"---\n\n"
        ]

        # Replay conversation history
        if conversation_history:
            full_prompt_parts.append("# Conversation History\n")
            for msg in conversation_history:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                full_prompt_parts.append(f"**{role}**: {content}\n")
            full_prompt_parts.append("\n---\n\n")

        full_prompt_parts.append(f"# Current Question\n{query}")

        model = genai.GenerativeModel(
            "gemini-2.5-flash",
            system_instruction=system,
        )

        response = await model.generate_content_async("".join(full_prompt_parts))
        answer = response.text or ""

        sources = [
            {
                "chunk_id": r["chunk_id"],
                "document_id": r["document_id"],
                "content": r["content"],
                "score": r["score"],
            }
            for r in rag_results
        ]

        return {"answer": answer, "sources": sources}

    # ------------------------------------------------------------------
    # Report generation
    # ------------------------------------------------------------------

    async def generate_client_report(self, report_type: str = "status") -> str:
        """Generate a structured report for this client.

        Args:
            report_type: One of ``"status"`` (current state overview),
                ``"financial"`` (revenue and hours), or ``"activity"``
                (recent work summary).

        Returns:
            The generated report text.
        """
        self._ensure_gemini()
        context = await self.get_client_context()
        context_prompt = self._build_context_prompt(context)

        report_instructions = {
            "status": (
                "Generate a comprehensive client status report covering: "
                "current project state, open tasks, upcoming deadlines, "
                "recent activity, and any risks or blockers. "
                "Format with clear headers and bullet points."
            ),
            "financial": (
                "Generate a financial summary report covering: "
                "recent invoices and their statuses, total billed amounts, "
                "billable hours logged, outstanding payments, and revenue trends. "
                "Include specific numbers and dates."
            ),
            "activity": (
                "Generate an activity report summarising recent work: "
                "completed tasks, time logged, meetings held, and key deliverables. "
                "Highlight progress and upcoming milestones."
            ),
        }

        instruction = report_instructions.get(
            report_type,
            report_instructions["status"],
        )

        system = (
            "You are a professional report writer for a consulting business. "
            "Generate clear, well-structured reports from the provided data. "
            "Use markdown formatting. Include dates and specifics where available."
        )

        user_content = (
            f"# Client Context\n{context_prompt}\n\n"
            f"---\n\n# Report Request\n"
            f"Type: {report_type}\n\n{instruction}"
        )

        model = genai.GenerativeModel(
            "gemini-2.5-flash",
            system_instruction=system,
        )

        response = await model.generate_content_async(user_content)
        return response.text or ""
