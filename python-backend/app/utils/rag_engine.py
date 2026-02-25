"""RAG (Retrieval-Augmented Generation) engine combining vector search with LLM generation."""

import logging

from openai import AsyncOpenAI

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
        4. Generate a response via OpenAI chat completions.
    """

    def __init__(
        self,
        vector_store: VectorStore | None = None,
        openai_client: AsyncOpenAI | None = None,
    ) -> None:
        self._vector_store = vector_store or get_vector_store()
        settings = get_settings()

        if openai_client is not None:
            self._client = openai_client
        elif settings.OPENAI_API_KEY:
            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        else:
            self._client = None
            logger.warning("OPENAI_API_KEY not set — RAGEngine will be non-functional")

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
        model: str = "gpt-4o-mini",
    ) -> str:
        """Generate an LLM response using the provided context.

        Args:
            query: The user's original question.
            context: Retrieved document context to ground the answer.
            system_prompt: Optional custom system prompt.
            model: OpenAI model identifier.

        Returns:
            The assistant's generated answer text.

        Raises:
            RuntimeError: If the OpenAI client is not available.
        """
        if self._client is None:
            raise RuntimeError("RAGEngine: OpenAI client unavailable (missing API key)")

        default_system = (
            "You are a helpful assistant. Use the provided context to answer "
            "the user's question accurately. If the context does not contain "
            "enough information, say so honestly."
        )

        messages = [
            {"role": "system", "content": system_prompt or default_system},
            {
                "role": "user",
                "content": (
                    f"Context:\n{context}\n\n---\n\nQuestion: {query}"
                    if context
                    else query
                ),
            },
        ]

        response = await self._client.chat.completions.create(
            model=model,
            messages=messages,
        )
        return response.choices[0].message.content or ""

    # ------------------------------------------------------------------
    # Orchestrator
    # ------------------------------------------------------------------

    async def query(
        self,
        query: str,
        agent_id: str | None = None,
        client_id: str | None = None,
        system_prompt: str | None = None,
        model: str = "gpt-4o-mini",
    ) -> dict:
        """End-to-end RAG: retrieve context then generate a response.

        Args:
            query: The user's question.
            agent_id: Optional scope filter.
            client_id: Optional scope filter.
            system_prompt: Optional custom system prompt.
            model: OpenAI model identifier.

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
