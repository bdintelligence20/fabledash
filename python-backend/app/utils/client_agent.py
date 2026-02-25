"""Tier 2 Client-Based Agent with context loading, task execution, and reporting."""

import logging
from datetime import datetime

from openai import AsyncOpenAI

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
                keys: ``model``, ``system_prompt``, ``document_ids``, ``id``
                (the agent's own Firestore ID).
        """
        self.config = agent_config
        self.client_id: str = agent_config["client_id"]
        self.agent_id: str | None = agent_config.get("id")
        self.model: str = agent_config.get("model", "gpt-4o-mini")
        self.system_prompt: str | None = agent_config.get("system_prompt")
        self.document_ids: list[str] = agent_config.get("document_ids", [])

        settings = get_settings()
        if settings.OPENAI_API_KEY:
            self._openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        else:
            self._openai = None
            logger.warning("OPENAI_API_KEY not set — ClientAgent LLM calls will fail")

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

        return {
            "client": client_data,
            "tasks": tasks,
            "time_logs": time_logs,
            "meetings": meetings,
            "invoices": invoices,
        }

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

        return "\n\n".join(parts) if parts else "No client context available."

    async def _ensure_openai(self) -> AsyncOpenAI:
        """Return the OpenAI client or raise a clear error."""
        if self._openai is None:
            raise RuntimeError(
                "ClientAgent: OpenAI client unavailable (OPENAI_API_KEY not set)"
            )
        return self._openai

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
        client = await self._ensure_openai()
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

        response = await client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
            ],
        )
        return response.choices[0].message.content or ""

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
        client = await self._ensure_openai()
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

        messages: list[dict] = [{"role": "system", "content": system}]

        # Inject context as the first user turn
        messages.append({
            "role": "user",
            "content": (
                f"# Client Context\n{context_prompt}\n\n"
                f"# Relevant Documents\n{rag_context or 'No documents found.'}"
            ),
        })
        messages.append({
            "role": "assistant",
            "content": "Understood. I have the client context loaded. How can I help?",
        })

        # Replay conversation history
        if conversation_history:
            messages.extend(conversation_history)

        # Current query
        messages.append({"role": "user", "content": query})

        response = await client.chat.completions.create(
            model=self.model,
            messages=messages,
        )
        answer = response.choices[0].message.content or ""

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
        client = await self._ensure_openai()
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

        response = await client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
            ],
        )
        return response.choices[0].message.content or ""
