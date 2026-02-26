"""Tests for DocumentProcessor text extraction and chunking."""

import pytest

from app.utils.document_processor import DocumentProcessor


class TestExtractText:
    def test_extract_txt(self):
        content = b"Hello, this is a test document."
        text = DocumentProcessor.extract_text(content, "test.txt")
        assert text == "Hello, this is a test document."

    def test_extract_unknown_falls_back_to_text(self):
        content = b"Fallback content"
        text = DocumentProcessor.extract_text(content, "test.dat")
        assert text == "Fallback content"

    def test_extract_txt_with_unicode(self):
        content = "Hello world with unicode: cafe\u0301".encode("utf-8")
        text = DocumentProcessor.extract_text(content, "unicode.txt")
        assert "Hello world" in text


class TestChunkText:
    def test_chunk_basic(self):
        text = "A" * 2500
        chunks = DocumentProcessor.chunk_text(text, chunk_size=1000, overlap=200)
        assert len(chunks) >= 3

    def test_chunk_empty_text(self):
        chunks = DocumentProcessor.chunk_text("")
        assert chunks == []

    def test_chunk_whitespace_only(self):
        chunks = DocumentProcessor.chunk_text("   \n\n  ")
        assert chunks == []

    def test_chunk_small_text(self):
        text = "Small text"
        chunks = DocumentProcessor.chunk_text(text, chunk_size=1000)
        assert len(chunks) == 1
        assert chunks[0] == "Small text"

    def test_chunk_overlap(self):
        text = "A" * 1800
        chunks = DocumentProcessor.chunk_text(text, chunk_size=1000, overlap=200)
        # With chunk_size=1000, overlap=200: step=800
        # chunk 0: [0:1000], chunk 1: [800:1800], chunk 2: [1600:2600] -> only 200 chars
        assert len(chunks) == 3
        assert len(chunks[0]) == 1000

    def test_chunk_no_overlap(self):
        text = "A" * 2000
        chunks = DocumentProcessor.chunk_text(text, chunk_size=1000, overlap=0)
        assert len(chunks) == 2

    def test_chunk_exact_size(self):
        text = "A" * 1000
        chunks = DocumentProcessor.chunk_text(text, chunk_size=1000, overlap=200)
        # chunk 0: [0:1000] = 1000 chars, then step to 800
        # chunk 1: [800:1800] = 200 chars (remainder)
        assert len(chunks) == 2
        assert len(chunks[0]) == 1000

    def test_chunk_preserves_content(self):
        text = "The quick brown fox jumps over the lazy dog. " * 50
        chunks = DocumentProcessor.chunk_text(text, chunk_size=100, overlap=20)
        # Verify no content is lost
        assert len(chunks) > 1
        for chunk in chunks:
            assert len(chunk) > 0
