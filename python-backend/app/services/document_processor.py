import os
import logging
import numpy as np
from typing import List, Dict, Any, Optional
from PyPDF2 import PdfReader
import docx
import re
from sklearn.metrics.pairwise import cosine_similarity
from openai import OpenAI

from app.utils.supabase_client import get_supabase_client
from app.utils.openai_client import get_openai_client
from app.models.document import DocumentChunk, RelevantChunk

# Configure logging
logger = logging.getLogger(__name__)

# Get OpenAI client
openai_client = get_openai_client()

# Get Supabase client
supabase = get_supabase_client()

def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text from a PDF file.
    
    Args:
        file_path: Path to the PDF file.
        
    Returns:
        str: Extracted text from the PDF.
    """
    try:
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        raise

def extract_text_from_docx(file_path: str) -> str:
    """
    Extract text from a DOCX file.
    
    Args:
        file_path: Path to the DOCX file.
        
    Returns:
        str: Extracted text from the DOCX.
    """
    try:
        doc = docx.Document(file_path)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text
    except Exception as e:
        logger.error(f"Error extracting text from DOCX: {e}")
        raise

def extract_text_from_txt(file_path: str) -> str:
    """
    Extract text from a TXT file.
    
    Args:
        file_path: Path to the TXT file.
        
    Returns:
        str: Extracted text from the TXT.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()
    except Exception as e:
        logger.error(f"Error extracting text from TXT: {e}")
        raise

def extract_text(file_path: str, file_type: str) -> str:
    """
    Extract text from a file based on its type.
    
    Args:
        file_path: Path to the file.
        file_type: Type of the file (pdf, docx, txt).
        
    Returns:
        str: Extracted text from the file.
    """
    if file_type.lower() == 'pdf':
        return extract_text_from_pdf(file_path)
    elif file_type.lower() == 'docx':
        return extract_text_from_docx(file_path)
    elif file_type.lower() == 'txt':
        return extract_text_from_txt(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """
    Split text into chunks of specified size with overlap.
    
    Args:
        text: Text to split into chunks.
        chunk_size: Size of each chunk in characters.
        overlap: Overlap between chunks in characters.
        
    Returns:
        List[str]: List of text chunks.
    """
    chunks = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = min(start + chunk_size, text_length)
        if end < text_length and end - start == chunk_size:
            # Find the last period or newline to avoid cutting sentences
            last_period = text.rfind('.', start, end)
            last_newline = text.rfind('\n', start, end)
            if last_period != -1 and (last_newline == -1 or last_period > last_newline):
                end = last_period + 1
            elif last_newline != -1:
                end = last_newline + 1
        
        chunks.append(text[start:end])
        start = end - overlap if end < text_length else text_length
    
    return chunks

async def generate_embedding(text: str) -> List[float]:
    """
    Generate embedding for a text using OpenAI API.
    
    Args:
        text: Text to generate embedding for.
        
    Returns:
        List[float]: Embedding vector.
    """
    try:
        # Use async OpenAI client
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        raise

async def process_document(document_id: int, file_path: str, file_type: str) -> None:
    """
    Process a document by extracting text, chunking it, generating embeddings, and storing in the database.
    
    Args:
        document_id: ID of the document in the database.
        file_path: Path to the document file.
        file_type: Type of the document file.
    """
    try:
        # Check if document_chunks table exists first
        try:
            test_result = supabase.table("document_chunks").select("id").limit(1).execute()
            if hasattr(test_result, 'error') and test_result.error:
                if 'does not exist' in str(test_result.error):
                    logger.warning(f"document_chunks table does not exist. Document {document_id} uploaded but not processed for RAG.")
                    return
                else:
                    logger.error(f"Error testing document_chunks table: {test_result.error}")
                    return
        except Exception as table_check_error:
            logger.warning(f"Could not check document_chunks table existence: {table_check_error}. Document {document_id} uploaded but not processed for RAG.")
            return
        
        # Extract text from document
        text = extract_text(file_path, file_type)
        
        # Chunk text
        chunks = chunk_text(text)
        
        # Process each chunk
        for i, chunk in enumerate(chunks):
            # Generate embedding
            embedding = await generate_embedding(chunk)
            
            # Create metadata
            metadata = {
                "chunk_index": i,
                "total_chunks": len(chunks)
            }
            
            # Store chunk and embedding in database
            chunk_data = {
                "document_id": document_id,
                "content": chunk,
                "embedding": embedding,
                "metadata": metadata
            }
            
            # Insert into database
            result = supabase.table("document_chunks").insert(chunk_data).execute()
            
            if hasattr(result, 'error') and result.error:
                logger.error(f"Error storing document chunk: {result.error}")
                # If the table doesn't exist, log warning but don't raise exception
                if 'does not exist' in str(result.error):
                    logger.warning(f"document_chunks table does not exist. Document {document_id} uploaded but not processed for RAG.")
                    return
                raise Exception(f"Error storing document chunk: {result.error}")
            
        logger.info(f"Document {document_id} processed successfully")
    except Exception as e:
        logger.error(f"Error processing document {document_id}: {e}")
        # Don't raise the exception to prevent upload failure
        logger.warning(f"Document {document_id} uploaded but processing failed: {e}")

async def retrieve_relevant_chunks(
    agent_id: int,
    query: str,
    limit: int = 5,
    include_parent_docs: bool = False,
    include_child_agent_context: bool = False
) -> List[RelevantChunk]:
    """
    Retrieve relevant document chunks for a query.
    
    Args:
        agent_id: ID of the agent.
        query: Query to search for.
        limit: Maximum number of chunks to return.
        include_parent_docs: Whether to include documents from parent agent.
        include_child_agent_context: Whether to include context from child agents.
        
    Returns:
        List[RelevantChunk]: List of relevant document chunks with similarity scores.
    """
    try:
        # Check if document_chunks table exists by trying to query it
        try:
            test_result = supabase.table("document_chunks").select("id").limit(1).execute()
            if hasattr(test_result, 'error') and test_result.error:
                # Check if the error is about the table not existing
                if 'does not exist' in str(test_result.error):
                    logger.warning(f"document_chunks table does not exist. Returning empty chunks list.")
                    return []
                else:
                    logger.error(f"Error testing document_chunks table: {test_result.error}")
                    return []
        except Exception as table_check_error:
            logger.warning(f"Could not check document_chunks table existence: {table_check_error}. Returning empty chunks list.")
            return []
        
        # Generate embedding for query
        query_embedding = await generate_embedding(query)
        
        # Get agent information
        agent_result = supabase.table("agents").select("*").eq("id", agent_id).execute()
        
        if hasattr(agent_result, 'error') and agent_result.error:
            logger.error(f"Error retrieving agent: {agent_result.error}")
            raise Exception(f"Error retrieving agent: {agent_result.error}")
        
        if not agent_result.data:
            logger.error(f"Agent {agent_id} not found")
            raise Exception(f"Agent {agent_id} not found")
        
        agent = agent_result.data[0]
        
        # Get document IDs for this agent
        document_ids = []
        
        # Get documents for this agent
        document_result = supabase.table("documents").select("id").eq("agent_id", agent_id).execute()
        
        if hasattr(document_result, 'error') and document_result.error:
            logger.error(f"Error retrieving documents: {document_result.error}")
            raise Exception(f"Error retrieving documents: {document_result.error}")
        
        document_ids.extend([doc["id"] for doc in document_result.data])
        
        # If include_parent_docs is True and agent has a parent, include parent's documents
        if include_parent_docs and agent.get("parent_id"):
            parent_id = agent["parent_id"]
            parent_document_result = supabase.table("documents").select("id").eq("agent_id", parent_id).execute()
            
            if hasattr(parent_document_result, 'error') and parent_document_result.error:
                logger.error(f"Error retrieving parent documents: {parent_document_result.error}")
                raise Exception(f"Error retrieving parent documents: {parent_document_result.error}")
            
            document_ids.extend([doc["id"] for doc in parent_document_result.data])
        
        # If include_child_agent_context is True and agent is a parent, include child agents' documents
        if include_child_agent_context and agent.get("is_parent"):
            child_agents_result = supabase.table("agents").select("id").eq("parent_id", agent_id).execute()
            
            if hasattr(child_agents_result, 'error') and child_agents_result.error:
                logger.error(f"Error retrieving child agents: {child_agents_result.error}")
                raise Exception(f"Error retrieving child agents: {child_agents_result.error}")
            
            for child_agent in child_agents_result.data:
                child_document_result = supabase.table("documents").select("id").eq("agent_id", child_agent["id"]).execute()
                
                if hasattr(child_document_result, 'error') and child_document_result.error:
                    logger.error(f"Error retrieving child documents: {child_document_result.error}")
                    raise Exception(f"Error retrieving child documents: {child_document_result.error}")
                
                document_ids.extend([doc["id"] for doc in child_document_result.data])
        
        # If no documents found, return empty list
        if not document_ids:
            logger.info(f"No documents found for agent {agent_id}")
            return []
        
        # Get all chunks for these documents
        chunks_result = supabase.table("document_chunks").select("*").in_("document_id", document_ids).execute()
        
        if hasattr(chunks_result, 'error') and chunks_result.error:
            logger.error(f"Error retrieving chunks: {chunks_result.error}")
            # If the table doesn't exist, return empty list instead of raising exception
            if 'does not exist' in str(chunks_result.error):
                logger.warning(f"document_chunks table does not exist. Returning empty chunks list.")
                return []
            raise Exception(f"Error retrieving chunks: {chunks_result.error}")
        
        chunks = chunks_result.data
        
        # If no chunks found, return empty list
        if not chunks:
            logger.info(f"No chunks found for documents {document_ids}")
            return []
        
        # Calculate similarity scores
        chunk_embeddings = [chunk["embedding"] for chunk in chunks]
        similarities = cosine_similarity([query_embedding], chunk_embeddings)[0]
        
        # Sort chunks by similarity score
        chunk_similarities = list(zip(chunks, similarities))
        chunk_similarities.sort(key=lambda x: x[1], reverse=True)
        
        # Get top chunks
        top_chunks = chunk_similarities[:limit]
        
        # Get document details for each chunk
        relevant_chunks = []
        for chunk, similarity in top_chunks:
            document_result = supabase.table("documents").select("*").eq("id", chunk["document_id"]).execute()
            
            if hasattr(document_result, 'error') and document_result.error:
                logger.error(f"Error retrieving document: {document_result.error}")
                raise Exception(f"Error retrieving document: {document_result.error}")
            
            document = document_result.data[0] if document_result.data else None
            
            relevant_chunk = RelevantChunk(
                chunk=DocumentChunk(**chunk),
                similarity=float(similarity),
                document=document
            )
            
            relevant_chunks.append(relevant_chunk)
        
        return relevant_chunks
    except Exception as e:
        logger.error(f"Error retrieving relevant chunks: {e}")
        # Instead of raising the exception, return empty list to allow chat to continue
        logger.warning(f"Returning empty chunks list due to error: {e}")
        return []

def format_chunks_as_context(chunks: List[RelevantChunk]) -> str:
    """
    Format chunks as context for the AI.
    
    Args:
        chunks: List of relevant chunks.
        
    Returns:
        str: Formatted context.
    """
    if not chunks:
        return ""
    
    context = "Here is some relevant information from my knowledge base:\n\n"
    
    for i, chunk in enumerate(chunks):
        document_info = f"[Document: {chunk.document.filename}]" if chunk.document else "[Unknown Document]"
        context += f"--- {document_info} ---\n{chunk.chunk.content}\n\n"
    
    return context

async def retrieve_child_agent_chat_history(agent_id: int, limit: int = 10) -> str:
    """
    Retrieve recent chat history from child agents for parent agent context.
    
    Args:
        agent_id: ID of the parent agent.
        limit: Maximum number of recent messages to retrieve per child agent.
        
    Returns:
        str: Formatted chat history context.
    """
    try:
        # Get all child agents
        child_agents_result = supabase.table("agents").select("id, name").eq("parent_id", agent_id).execute()
        
        if hasattr(child_agents_result, 'error') and child_agents_result.error:
            logger.error(f"Error retrieving child agents: {child_agents_result.error}")
            return ""
        
        child_agents = child_agents_result.data
        if not child_agents:
            return ""
        
        context = "Here are recent conversations from my specialized child agents:\n\n"
        
        for child_agent in child_agents:
            child_agent_id = child_agent["id"]
            child_agent_name = child_agent["name"]
            
            # Get recent chats for this child agent
            chats_result = supabase.table("chats").select("id").eq("agent_id", child_agent_id).order("created_at", desc=True).limit(3).execute()
            
            if hasattr(chats_result, 'error') and chats_result.error:
                logger.warning(f"Error retrieving chats for child agent {child_agent_id}: {chats_result.error}")
                continue
            
            chats = chats_result.data
            if not chats:
                continue
            
            # Get recent messages from these chats
            chat_ids = [chat["id"] for chat in chats]
            messages_result = supabase.table("messages").select("role, content, created_at").in_("chat_id", chat_ids).neq("role", "system").order("created_at", desc=True).limit(limit).execute()
            
            if hasattr(messages_result, 'error') and messages_result.error:
                logger.warning(f"Error retrieving messages for child agent {child_agent_id}: {messages_result.error}")
                continue
            
            messages = messages_result.data
            if not messages:
                continue
            
            context += f"--- {child_agent_name} (Child Agent) ---\n"
            
            # Group messages into Q&A pairs
            for i in range(0, len(messages), 2):
                if i + 1 < len(messages):
                    user_msg = messages[i] if messages[i]["role"] == "user" else messages[i + 1]
                    assistant_msg = messages[i + 1] if messages[i + 1]["role"] == "assistant" else messages[i]
                    
                    if user_msg["role"] == "user" and assistant_msg["role"] == "assistant":
                        context += f"Q: {user_msg['content']}\n"
                        context += f"A: {assistant_msg['content']}\n\n"
            
            context += "\n"
        
        return context
    except Exception as e:
        logger.error(f"Error retrieving child agent chat history: {e}")
        return ""

def format_chat_history_as_context(chat_history: str) -> str:
    """
    Format chat history as context for the AI.
    
    Args:
        chat_history: Raw chat history string.
        
    Returns:
        str: Formatted context.
    """
    if not chat_history:
        return ""
    
    return f"\n\n{chat_history}"
