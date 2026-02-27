"""RAG (Retrieval-Augmented Generation) engine combining vector search with LLM generation."""

import logging

import google.generativeai as genai

from app.config import get_settings
from app.utils.vector_store import get_vector_store, VectorStore

logger = logging.getLogger(__name__)

_rag_engine = None


class RAGEngine:
    """Orchestrates context retrieval and LLM response generation.

    Workflow:
        1. Accept a user query.
        2. Retrieve relevant document chunks from the VectorStore.
        3. Build a prompt with the retrieved context.
        4. Generate a response via Google Gemini.
    """

    def __init__(
        self,
        vector_store: VectorStore | None = None,
    ) -> None:
        self._vector_store = vector_store or get_vector_store()
        settings = get_settings()

        api_key = settings.GEMINI_API_KEY or settings.GOOGLE_AI_API_KEY
        if api_key:
            genai.configure(api_key=api_key)
            self._configured = True
        else:
            self._configured = False
            logger.warning("Gemini API key not set — RAGEngine will be non-functional")

    # ------------------------------------------------------------------
    # Context retrieval
    # ------------------------------------------------------------------

    async def retrieve_context(
        self,
        query: str,
        agent_id: str | None = None,
        client_id: str | None = None,
        top_k: int = 5,
    ) -> str:
        """Search the vector store and combine the top results into a context string.

        Args:
            query: The natural-language query.
            agent_id: Optional scope filter.
            client_id: Optional scope filter.
            top_k: Number of chunks to retrieve.

        Returns:
            A single string with the most relevant chunks, separated by
            double newlines. Returns an empty string when no results are found.
        """
        results = await self._vector_store.search(
            query=query,
            agent_id=agent_id,
            client_id=client_id,
            top_k=top_k,
        )
        if not results:
            return ""

        context_parts: list[str] = []
        for result in results:
            context_parts.append(result["content"])
        return "\n\n".join(context_parts)

    # ------------------------------------------------------------------
    # Response generation
    # ------------------------------------------------------------------

    async def generate_response(
        self,
        query: str,
        context: str,
        system_prompt: str | None = None,
        model: str = "gemini-2.5-flash",
    ) -> str:
        """Generate an LLM response using the provided context.

        Args:
            query: The user's original question.
            context: Retrieved document context to ground the answer.
            system_prompt: Optional custom system prompt.
            model: Gemini model identifier (ignored, uses gemini-2.5-flash).

        Returns:
            The assistant's generated answer text.

        Raises:
            RuntimeError: If the Gemini client is not available.
        """
        if not self._configured:
            raise RuntimeError("RAGEngine: Gemini client unavailable (missing API key)")

        default_system = (
            "You are a helpful assistant. Use the provided context to answer "
            "the user's question accurately. If the context does not contain "
            "enough information, say so honestly."
        )

        gemini_model = genai.GenerativeModel(
            "gemini-2.5-flash",
            system_instruction=system_prompt or default_system,
        )

        user_content = (
            f"Context:\n{context}\n\n---\n\nQuestion: {query}"
            if context
            else query
        )

        response = await gemini_model.generate_content_async(user_content)
        return response.text or ""

    # ------------------------------------------------------------------
    # Orchestrator
    # ------------------------------------------------------------------

    async def query(
        self,
        query: str,
        agent_id: str | None = None,
        client_id: str | None = None,
        system_prompt: str | None = None,
        model: str = "gemini-2.5-flash",
    ) -> dict:
        """End-to-end RAG: retrieve context then generate a response.

        Args:
            query: The user's question.
            agent_id: Optional scope filter.
            client_id: Optional scope filter.
            system_prompt: Optional custom system prompt.
            model: Gemini model identifier.

        Returns:
            A dict with ``answer`` (str) and ``sources`` (list of source
            dicts from the vector search).
        """
        results = await self._vector_store.search(
            query=query,
            agent_id=agent_id,
            client_id=client_id,
        )

        context = "\n\n".join(r["content"] for r in results) if results else ""

        answer = await self.generate_response(
            query=query,
            context=context,
            system_prompt=system_prompt,
            model=model,
        )

        sources = [
            {
                "chunk_id": r["chunk_id"],
                "document_id": r["document_id"],
                "content": r["content"],
                "score": r["score"],
            }
            for r in results
        ]

        return {"answer": answer, "sources": sources}


# ------------------------------------------------------------------
# Singleton accessor
# ------------------------------------------------------------------


def get_rag_engine() -> RAGEngine:
    """Return the module-level RAGEngine singleton."""
    global _rag_engine
    if _rag_engine is None:
        _rag_engine = RAGEngine()
    return _rag_engine
