"""Vector store using Google Gemini embeddings and Firestore for storage."""

import asyncio
import logging
from typing import Any

import numpy as np
import google.generativeai as genai

from app.config import get_settings
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)

EMBEDDINGS_COLLECTION = "embeddings"
EMBEDDING_MODEL = "models/text-embedding-004"

_vector_store = None


class VectorStore:
    """Manages vector embeddings via Google Gemini and stores them in Firestore.

    Uses brute-force cosine similarity for search. Suitable for small-to-medium
    document sets per agent/client scope. For production scale, swap in a
    dedicated vector database.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._configured = False
        api_key = settings.GEMINI_API_KEY or settings.GOOGLE_AI_API_KEY

        if not api_key:
            logger.warning("Gemini API key not set — VectorStore will be non-functional")
        else:
            genai.configure(api_key=api_key)
            self._configured = True
            logger.info("VectorStore initialised with Google Gemini embeddings")

    # ------------------------------------------------------------------
    # Embedding generation
    # ------------------------------------------------------------------

    async def generate_embedding(self, text: str) -> list[float]:
        """Generate an embedding vector for the given text.

        Args:
            text: The text to embed.

        Returns:
            A list of floats representing the embedding vector.

        Raises:
            RuntimeError: If the Gemini client is not available.
        """
        if not self._configured:
            raise RuntimeError("VectorStore: Gemini client unavailable (missing API key)")

        # genai.embed_content is synchronous, run in thread to avoid blocking
        result = await asyncio.to_thread(
            genai.embed_content,
            model=EMBEDDING_MODEL,
            content=text,
        )
        return result['embedding']

    # ------------------------------------------------------------------
    # Storage
    # ------------------------------------------------------------------

    async def store_embedding(
        self,
        chunk_id: str,
        document_id: str,
        embedding: list[float],
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Persist an embedding and its associated content in Firestore.

        Args:
            chunk_id: Unique identifier for the chunk.
            document_id: Parent document identifier.
            embedding: The embedding vector.
            content: Original text content for the chunk.
            metadata: Optional extra metadata (agent_id, client_id, etc.).
        """
        db = get_firestore_client()
        doc_ref = db.collection(EMBEDDINGS_COLLECTION).document(chunk_id)
        doc_ref.set(
            {
                "chunk_id": chunk_id,
                "document_id": document_id,
                "embedding": embedding,
                "content": content,
                "metadata": metadata or {},
            }
        )
        logger.debug("Stored embedding for chunk %s (document %s)", chunk_id, document_id)

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    async def search(
        self,
        query: str,
        agent_id: str | None = None,
        client_id: str | None = None,
        top_k: int = 5,
    ) -> list[dict]:
        """Perform a similarity search against stored embeddings.

        Generates a query embedding, fetches all embeddings within the
        agent/client scope from Firestore, computes cosine similarity in
        memory, and returns the top_k results.

        Args:
            query: Natural-language search query.
            agent_id: Optional scope filter.
            client_id: Optional scope filter.
            top_k: Number of results to return.

        Returns:
            A list of dicts with ``content``, ``score``, ``chunk_id``,
            ``document_id``, and ``metadata`` keys, sorted by descending
            similarity score.
        """
        query_embedding = await self.generate_embedding(query)

        db = get_firestore_client()
        collection_ref = db.collection(EMBEDDINGS_COLLECTION)

        # Build scoped query
        query_ref: Any = collection_ref
        if agent_id:
            query_ref = query_ref.where("metadata.agent_id", "==", agent_id)
        if client_id:
            query_ref = query_ref.where("metadata.client_id", "==", client_id)

        docs = query_ref.stream()

        results: list[dict] = []
        for doc in docs:
            data = doc.to_dict()
            stored_embedding = data.get("embedding")
            if not stored_embedding:
                continue
            score = self._cosine_similarity(query_embedding, stored_embedding)
            results.append(
                {
                    "content": data.get("content", ""),
                    "score": score,
                    "chunk_id": data.get("chunk_id", doc.id),
                    "document_id": data.get("document_id", ""),
                    "metadata": data.get("metadata", {}),
                }
            )

        results.sort(key=lambda r: r["score"], reverse=True)
        return results[:top_k]

    # ------------------------------------------------------------------
    # Similarity
    # ------------------------------------------------------------------

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        """Compute cosine similarity between two vectors using numpy.

        Args:
            a: First vector.
            b: Second vector.

        Returns:
            Cosine similarity in the range [-1, 1].
        """
        vec_a = np.array(a)
        vec_b = np.array(b)
        dot = np.dot(vec_a, vec_b)
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(dot / (norm_a * norm_b))

    # ------------------------------------------------------------------
    # Batch indexing
    # ------------------------------------------------------------------

    async def index_document_chunks(
        self, document_id: str, chunks: list[dict]
    ) -> None:
        """Generate embeddings for a list of document chunks and store them.

        Each chunk dict must contain at least ``id`` and ``content`` keys,
        and may include a ``metadata`` dict.

        Args:
            document_id: Parent document identifier.
            chunks: List of chunk dicts with ``id``, ``content``, and
                optional ``metadata``.
        """
        for chunk in chunks:
            chunk_id = chunk["id"]
            content = chunk["content"]
            metadata = chunk.get("metadata", {})
            try:
                embedding = await self.generate_embedding(content)
                await self.store_embedding(
                    chunk_id=chunk_id,
                    document_id=document_id,
                    embedding=embedding,
                    content=content,
                    metadata=metadata,
                )
            except Exception:
                logger.exception(
                    "Failed to index chunk %s of document %s", chunk_id, document_id
                )

        logger.info(
            "Indexed %d chunks for document %s", len(chunks), document_id
        )


# ------------------------------------------------------------------
# Singleton accessor
# ------------------------------------------------------------------


def get_vector_store() -> VectorStore:
    """Return the module-level VectorStore singleton."""
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store
