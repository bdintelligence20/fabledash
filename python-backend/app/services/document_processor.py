"""
Document processor service - placeholder.

Will be rebuilt with Firebase/Firestore in Phase 2.
Text extraction utilities (PDF, DOCX, TXT) and chunking logic
will be restored when the document pipeline is rebuilt.
"""

import logging

logger = logging.getLogger(__name__)


async def process_document(document_id: str, file_path: str, file_type: str) -> None:
    """Placeholder - will be rebuilt with Firebase in Phase 2."""
    logger.info(f"Document processing not yet implemented (pending Firebase rebuild)")


async def retrieve_relevant_chunks(agent_id: str, query: str, limit: int = 5,
                                    include_parent_docs: bool = False,
                                    include_child_agent_context: bool = False):
    """Placeholder - will be rebuilt with Firebase in Phase 2."""
    return []


def format_chunks_as_context(chunks) -> str:
    """Placeholder - will be rebuilt with Firebase in Phase 2."""
    return ""


async def retrieve_child_agent_chat_history(agent_id: str, limit: int = 10) -> str:
    """Placeholder - will be rebuilt with Firebase in Phase 2."""
    return ""


def format_chat_history_as_context(chat_history: str) -> str:
    """Placeholder - will be rebuilt with Firebase in Phase 2."""
    return ""
