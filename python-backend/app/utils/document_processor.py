"""Document text extraction and chunking processor."""

import logging
from io import BytesIO

from app.models.document import CHUNKS_COLLECTION, COLLECTION_NAME, DocumentStatus
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """Extract text from uploaded files and split into searchable chunks."""

    @staticmethod
    def extract_text(file_content: bytes, filename: str) -> str:
        """Extract plain text from a file based on its extension.

        Supports PDF (via PyPDF2), DOCX (via python-docx), and plain text files.
        """
        lower = filename.lower()

        if lower.endswith(".pdf"):
            return DocumentProcessor._extract_pdf(file_content)
        elif lower.endswith(".docx"):
            return DocumentProcessor._extract_docx(file_content)
        elif lower.endswith(".txt"):
            return file_content.decode("utf-8", errors="replace")
        else:
            # Fallback: attempt to decode as text
            return file_content.decode("utf-8", errors="replace")

    @staticmethod
    def _extract_pdf(file_content: bytes) -> str:
        """Extract text from all pages of a PDF."""
        from PyPDF2 import PdfReader

        reader = PdfReader(BytesIO(file_content))
        pages: list[str] = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
        return "\n\n".join(pages)

    @staticmethod
    def _extract_docx(file_content: bytes) -> str:
        """Extract text from all paragraphs of a DOCX file."""
        from docx import Document

        doc = Document(BytesIO(file_content))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
        """Split text into overlapping chunks for downstream retrieval.

        Args:
            text: The full extracted text.
            chunk_size: Maximum character count per chunk.
            overlap: Number of overlapping characters between consecutive chunks.

        Returns:
            List of text chunks.
        """
        if not text or not text.strip():
            return []

        chunks: list[str] = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            start += chunk_size - overlap

        return chunks

    @staticmethod
    async def process_document(
        doc_id: str,
        file_content: bytes,
        filename: str,
    ) -> dict:
        """Extract text, chunk it, store chunks in Firestore, and update the document.

        Args:
            doc_id: Firestore document ID of the parent document.
            file_content: Raw bytes of the uploaded file.
            filename: Original filename (used to determine extraction method).

        Returns:
            dict with chunk_count and word_count.
        """
        db = get_firestore_client()
        doc_ref = db.collection(COLLECTION_NAME).document(doc_id)

        try:
            # Extract text
            text = DocumentProcessor.extract_text(file_content, filename)
            if not text.strip():
                doc_ref.update({
                    "status": DocumentStatus.READY.value,
                    "chunk_count": 0,
                    "error_message": None,
                })
                return {"chunk_count": 0, "word_count": 0}

            # Chunk text
            chunks = DocumentProcessor.chunk_text(text)
            word_count = len(text.split())

            # Store chunks in Firestore
            batch = db.batch()
            for idx, content in enumerate(chunks):
                chunk_ref = db.collection(CHUNKS_COLLECTION).document()
                batch.set(chunk_ref, {
                    "document_id": doc_id,
                    "content": content,
                    "chunk_index": idx,
                    "metadata": {},
                })
            batch.commit()

            # Update document status
            doc_ref.update({
                "status": DocumentStatus.READY.value,
                "chunk_count": len(chunks),
                "error_message": None,
            })

            logger.info(
                "Processed document %s: %d chunks, %d words",
                doc_id,
                len(chunks),
                word_count,
            )
            return {"chunk_count": len(chunks), "word_count": word_count}

        except Exception as e:
            logger.exception("Failed to process document %s", doc_id)
            doc_ref.update({
                "status": DocumentStatus.ERROR.value,
                "error_message": str(e),
            })
            raise
