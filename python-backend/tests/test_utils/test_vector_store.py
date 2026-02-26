"""Tests for VectorStore embedding generation, storage, and search."""

import pytest
import numpy as np
from unittest.mock import patch, MagicMock, AsyncMock

from tests.conftest import MockFirestoreClient, MockDocumentSnapshot


class TestCosineSimilarity:
    def test_identical_vectors(self):
        from app.utils.vector_store import VectorStore
        score = VectorStore._cosine_similarity([1.0, 0.0, 0.0], [1.0, 0.0, 0.0])
        assert score == pytest.approx(1.0, abs=1e-6)

    def test_orthogonal_vectors(self):
        from app.utils.vector_store import VectorStore
        score = VectorStore._cosine_similarity([1.0, 0.0], [0.0, 1.0])
        assert score == pytest.approx(0.0, abs=1e-6)

    def test_opposite_vectors(self):
        from app.utils.vector_store import VectorStore
        score = VectorStore._cosine_similarity([1.0, 0.0], [-1.0, 0.0])
        assert score == pytest.approx(-1.0, abs=1e-6)

    def test_zero_vector_a(self):
        from app.utils.vector_store import VectorStore
        score = VectorStore._cosine_similarity([0.0, 0.0], [1.0, 1.0])
        assert score == 0.0

    def test_zero_vector_b(self):
        from app.utils.vector_store import VectorStore
        score = VectorStore._cosine_similarity([1.0, 1.0], [0.0, 0.0])
        assert score == 0.0

    def test_similar_vectors(self):
        from app.utils.vector_store import VectorStore
        score = VectorStore._cosine_similarity([1.0, 1.0], [1.0, 0.9])
        assert score > 0.99

    def test_different_magnitude_same_direction(self):
        from app.utils.vector_store import VectorStore
        score = VectorStore._cosine_similarity([1.0, 0.0], [100.0, 0.0])
        assert score == pytest.approx(1.0, abs=1e-6)

    def test_high_dimensional_vectors(self):
        from app.utils.vector_store import VectorStore
        a = list(np.random.randn(1536))
        score = VectorStore._cosine_similarity(a, a)
        assert score == pytest.approx(1.0, abs=1e-5)


class TestGenerateEmbedding:
    @pytest.mark.asyncio
    async def test_generate_embedding_success(self):
        mock_openai = AsyncMock()
        mock_response = MagicMock()
        mock_response.data = [MagicMock()]
        mock_response.data[0].embedding = [0.1] * 1536
        mock_openai.embeddings.create = AsyncMock(return_value=mock_response)

        with patch("app.utils.vector_store.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(OPENAI_API_KEY="test-key")
            with patch("app.utils.vector_store.AsyncOpenAI", return_value=mock_openai):
                from app.utils.vector_store import VectorStore
                store = VectorStore()
                embedding = await store.generate_embedding("test text")

        assert len(embedding) == 1536
        assert all(v == 0.1 for v in embedding)

    @pytest.mark.asyncio
    async def test_generate_embedding_no_client_raises(self):
        with patch("app.utils.vector_store.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(OPENAI_API_KEY="")
            from app.utils.vector_store import VectorStore
            store = VectorStore()

        with pytest.raises(RuntimeError, match="OpenAI client unavailable"):
            await store.generate_embedding("test")


class TestStoreEmbedding:
    @pytest.mark.asyncio
    async def test_store_embedding(self):
        db = MockFirestoreClient()
        mock_openai = AsyncMock()
        # Track what gets set on the document
        set_calls = []
        original_document = db.collection("embeddings").document

        def tracking_document(chunk_id):
            ref = original_document(chunk_id)
            original_set = ref.set
            def tracking_set(data, merge=False):
                set_calls.append(data)
                return original_set(data, merge=merge)
            ref.set = tracking_set
            return ref

        with patch("app.utils.vector_store.get_settings") as mock_settings, \
             patch("app.utils.vector_store.AsyncOpenAI", return_value=mock_openai), \
             patch("app.utils.vector_store.get_firestore_client", return_value=db):
            mock_settings.return_value = MagicMock(OPENAI_API_KEY="test-key")
            # Monkey-patch the document method to track calls
            db.collection("embeddings").document = tracking_document
            from app.utils.vector_store import VectorStore
            store = VectorStore()
            await store.store_embedding(
                chunk_id="chunk_1",
                document_id="doc_1",
                embedding=[0.1, 0.2, 0.3],
                content="test content",
                metadata={"agent_id": "agent_1"},
            )

        assert len(set_calls) == 1
        assert set_calls[0]["content"] == "test content"
        assert set_calls[0]["document_id"] == "doc_1"
        assert set_calls[0]["metadata"] == {"agent_id": "agent_1"}

    @pytest.mark.asyncio
    async def test_store_embedding_no_metadata(self):
        db = MockFirestoreClient()
        mock_openai = AsyncMock()
        set_calls = []
        original_document = db.collection("embeddings").document

        def tracking_document(chunk_id):
            ref = original_document(chunk_id)
            original_set = ref.set
            def tracking_set(data, merge=False):
                set_calls.append(data)
                return original_set(data, merge=merge)
            ref.set = tracking_set
            return ref

        with patch("app.utils.vector_store.get_settings") as mock_settings, \
             patch("app.utils.vector_store.AsyncOpenAI", return_value=mock_openai), \
             patch("app.utils.vector_store.get_firestore_client", return_value=db):
            mock_settings.return_value = MagicMock(OPENAI_API_KEY="test-key")
            db.collection("embeddings").document = tracking_document
            from app.utils.vector_store import VectorStore
            store = VectorStore()
            await store.store_embedding(
                chunk_id="chunk_2",
                document_id="doc_1",
                embedding=[0.1],
                content="text",
            )

        assert len(set_calls) == 1
        assert set_calls[0]["metadata"] == {}


class TestSearch:
    @pytest.mark.asyncio
    async def test_search_returns_ranked_results(self):
        db = MockFirestoreClient()
        db.set_collection("embeddings", [
            MockDocumentSnapshot("e1", {
                "chunk_id": "e1",
                "document_id": "doc_1",
                "embedding": [1.0, 0.0, 0.0],
                "content": "relevant content",
                "metadata": {},
            }),
            MockDocumentSnapshot("e2", {
                "chunk_id": "e2",
                "document_id": "doc_1",
                "embedding": [0.0, 1.0, 0.0],
                "content": "less relevant",
                "metadata": {},
            }),
        ])

        mock_openai = AsyncMock()

        with patch("app.utils.vector_store.get_settings") as mock_settings, \
             patch("app.utils.vector_store.AsyncOpenAI", return_value=mock_openai), \
             patch("app.utils.vector_store.get_firestore_client", return_value=db):
            mock_settings.return_value = MagicMock(OPENAI_API_KEY="test-key")
            from app.utils.vector_store import VectorStore
            store = VectorStore()

            # Mock generate_embedding to return a vector close to e1
            store.generate_embedding = AsyncMock(return_value=[0.9, 0.1, 0.0])
            results = await store.search("test query", top_k=5)

        assert len(results) == 2
        # First result should be e1 (more similar to query)
        assert results[0]["chunk_id"] == "e1"
        assert results[0]["score"] > results[1]["score"]

    @pytest.mark.asyncio
    async def test_search_empty_collection(self):
        db = MockFirestoreClient()

        mock_openai = AsyncMock()

        with patch("app.utils.vector_store.get_settings") as mock_settings, \
             patch("app.utils.vector_store.AsyncOpenAI", return_value=mock_openai), \
             patch("app.utils.vector_store.get_firestore_client", return_value=db):
            mock_settings.return_value = MagicMock(OPENAI_API_KEY="test-key")
            from app.utils.vector_store import VectorStore
            store = VectorStore()
            store.generate_embedding = AsyncMock(return_value=[1.0, 0.0])
            results = await store.search("test", top_k=5)

        assert results == []

    @pytest.mark.asyncio
    async def test_search_top_k_limit(self):
        db = MockFirestoreClient()
        docs = []
        for i in range(10):
            vec = [0.0] * 3
            vec[i % 3] = 1.0
            docs.append(MockDocumentSnapshot(f"e{i}", {
                "chunk_id": f"e{i}",
                "document_id": "doc_1",
                "embedding": vec,
                "content": f"content {i}",
                "metadata": {},
            }))
        db.set_collection("embeddings", docs)

        mock_openai = AsyncMock()

        with patch("app.utils.vector_store.get_settings") as mock_settings, \
             patch("app.utils.vector_store.AsyncOpenAI", return_value=mock_openai), \
             patch("app.utils.vector_store.get_firestore_client", return_value=db):
            mock_settings.return_value = MagicMock(OPENAI_API_KEY="test-key")
            from app.utils.vector_store import VectorStore
            store = VectorStore()
            store.generate_embedding = AsyncMock(return_value=[1.0, 0.0, 0.0])
            results = await store.search("test", top_k=3)

        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_search_skips_empty_embeddings(self):
        db = MockFirestoreClient()
        db.set_collection("embeddings", [
            MockDocumentSnapshot("e1", {
                "chunk_id": "e1",
                "document_id": "doc_1",
                "embedding": None,  # Missing embedding
                "content": "no embedding",
                "metadata": {},
            }),
            MockDocumentSnapshot("e2", {
                "chunk_id": "e2",
                "document_id": "doc_1",
                "embedding": [1.0, 0.0],
                "content": "has embedding",
                "metadata": {},
            }),
        ])

        mock_openai = AsyncMock()

        with patch("app.utils.vector_store.get_settings") as mock_settings, \
             patch("app.utils.vector_store.AsyncOpenAI", return_value=mock_openai), \
             patch("app.utils.vector_store.get_firestore_client", return_value=db):
            mock_settings.return_value = MagicMock(OPENAI_API_KEY="test-key")
            from app.utils.vector_store import VectorStore
            store = VectorStore()
            store.generate_embedding = AsyncMock(return_value=[1.0, 0.0])
            results = await store.search("test", top_k=5)

        assert len(results) == 1
        assert results[0]["chunk_id"] == "e2"


class TestIndexDocumentChunks:
    @pytest.mark.asyncio
    async def test_index_document_chunks(self):
        db = MockFirestoreClient()
        mock_openai = AsyncMock()

        with patch("app.utils.vector_store.get_settings") as mock_settings, \
             patch("app.utils.vector_store.AsyncOpenAI", return_value=mock_openai), \
             patch("app.utils.vector_store.get_firestore_client", return_value=db):
            mock_settings.return_value = MagicMock(OPENAI_API_KEY="test-key")
            from app.utils.vector_store import VectorStore
            store = VectorStore()
            store.generate_embedding = AsyncMock(return_value=[0.1, 0.2, 0.3])
            store.store_embedding = AsyncMock()

            chunks = [
                {"id": "c1", "content": "chunk 1", "metadata": {"page": 1}},
                {"id": "c2", "content": "chunk 2", "metadata": {"page": 2}},
            ]
            await store.index_document_chunks("doc_1", chunks)

        assert store.generate_embedding.call_count == 2
        assert store.store_embedding.call_count == 2

    @pytest.mark.asyncio
    async def test_index_continues_on_error(self):
        db = MockFirestoreClient()
        mock_openai = AsyncMock()

        with patch("app.utils.vector_store.get_settings") as mock_settings, \
             patch("app.utils.vector_store.AsyncOpenAI", return_value=mock_openai), \
             patch("app.utils.vector_store.get_firestore_client", return_value=db):
            mock_settings.return_value = MagicMock(OPENAI_API_KEY="test-key")
            from app.utils.vector_store import VectorStore
            store = VectorStore()
            # First call succeeds, second raises
            store.generate_embedding = AsyncMock(
                side_effect=[([0.1, 0.2]), Exception("API Error")]
            )
            store.store_embedding = AsyncMock()

            chunks = [
                {"id": "c1", "content": "chunk 1"},
                {"id": "c2", "content": "chunk 2"},
            ]
            # Should not raise, just log the error
            await store.index_document_chunks("doc_1", chunks)

        # First chunk should have been stored
        assert store.store_embedding.call_count == 1
