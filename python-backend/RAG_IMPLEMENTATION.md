# RAG (Retrieval-Augmented Generation) Implementation

This document outlines the implementation of the RAG (Retrieval-Augmented Generation) system in the FableDash AI Agent System, focusing on how documents are processed, stored, and used to enhance AI responses.

## Overview

The RAG system allows agents to:

1. Upload and process documents (PDF, DOCX, TXT)
2. Extract text and split it into manageable chunks
3. Generate embeddings for each chunk
4. Store chunks and embeddings in a vector database
5. Retrieve relevant chunks based on user queries
6. Enhance AI responses with context from retrieved chunks

This enables agents to provide more accurate and contextually relevant responses based on the documents they have access to.

## Architecture

The RAG system consists of the following components:

1. **Document Processor**: Extracts text from documents and splits it into chunks
2. **Embedding Generator**: Generates vector embeddings for text chunks
3. **Vector Database**: Stores chunks and their embeddings for efficient retrieval
4. **Retrieval Engine**: Finds relevant chunks based on query similarity
5. **Context Formatter**: Formats retrieved chunks as context for the AI
6. **Chat System**: Incorporates context into AI prompts

## Implementation Details

### Document Processing

The document processing pipeline is implemented in `app/services/document_processor.py`:

1. **Text Extraction**: Extract text from various document formats
   ```python
   def extract_text_from_pdf(file_path: str) -> str:
       """Extract text from a PDF file."""
       reader = PdfReader(file_path)
       text = ""
       for page in reader.pages:
           text += page.extract_text() + "\n"
       return text
   ```

2. **Text Chunking**: Split text into manageable chunks with overlap
   ```python
   def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
       """Split text into chunks of specified size with overlap."""
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
   ```

### Embedding Generation

Embeddings are generated using OpenAI's embedding API:

```python
async def generate_embedding(text: str) -> List[float]:
    """Generate embedding for a text using OpenAI API."""
    response = await openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding
```

### Document Processing Pipeline

The complete document processing pipeline:

```python
async def process_document(document_id: int, file_path: str, file_type: str) -> None:
    """Process a document by extracting text, chunking it, generating embeddings, and storing in the database."""
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
```

### Retrieval Engine

The retrieval engine finds relevant chunks based on query similarity:

```python
async def retrieve_relevant_chunks(
    agent_id: int,
    query: str,
    limit: int = 5,
    include_parent_docs: bool = False,
    include_child_agent_context: bool = False
) -> List[RelevantChunk]:
    """Retrieve relevant document chunks for a query."""
    # Generate embedding for query
    query_embedding = await generate_embedding(query)
    
    # Get document IDs for this agent
    document_ids = []
    
    # Get documents for this agent
    document_result = supabase.table("documents").select("id").eq("agent_id", agent_id).execute()
    document_ids.extend([doc["id"] for doc in document_result.data])
    
    # Include parent documents if requested
    if include_parent_docs and agent.get("parent_id"):
        parent_document_result = supabase.table("documents").select("id").eq("agent_id", agent["parent_id"]).execute()
        document_ids.extend([doc["id"] for doc in parent_document_result.data])
    
    # Include child agent documents if requested
    if include_child_agent_context and agent.get("is_parent"):
        child_agents_result = supabase.table("agents").select("id").eq("parent_id", agent_id).execute()
        for child_agent in child_agents_result.data:
            child_document_result = supabase.table("documents").select("id").eq("agent_id", child_agent["id"]).execute()
            document_ids.extend([doc["id"] for doc in child_document_result.data])
    
    # Get all chunks for these documents
    chunks_result = supabase.table("document_chunks").select("*").in_("document_id", document_ids).execute()
    chunks = chunks_result.data
    
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
        document = document_result.data[0] if document_result.data else None
        
        relevant_chunk = RelevantChunk(
            chunk=DocumentChunk(**chunk),
            similarity=float(similarity),
            document=document
        )
        
        relevant_chunks.append(relevant_chunk)
    
    return relevant_chunks
```

### Context Formatting

Retrieved chunks are formatted as context for the AI:

```python
def format_chunks_as_context(chunks: List[RelevantChunk]) -> str:
    """Format chunks as context for the AI."""
    if not chunks:
        return ""
    
    context = "Here is some relevant information from my knowledge base:\n\n"
    
    for i, chunk in enumerate(chunks):
        document_info = f"[Document: {chunk.document.filename}]" if chunk.document else "[Unknown Document]"
        context += f"--- {document_info} ---\n{chunk.chunk.content}\n\n"
    
    return context
```

### Integration with Chat System

The RAG system is integrated with the chat system in `app/api/chats.py`:

```python
@router.post("/{chat_id}/message", response_model=MessagesResponse)
async def send_message(
    message: str = Body(..., embed=True),
    chat_id: int = Path(..., description="The ID of the chat to send a message to")
):
    """Send a message in a chat."""
    # ... (other code)
    
    # Retrieve relevant chunks for the query
    relevant_chunks = await retrieve_relevant_chunks(
        chat["agents"]["id"],
        message,
        5,  # Limit to 5 most relevant chunks
        include_parent_docs,
        include_child_agent_context
    )
    
    # Format chunks as context
    document_context = format_chunks_as_context(relevant_chunks)
    
    # If we have relevant chunks, add them to the context
    if document_context:
        # Find the system message
        system_message_index = next((i for i, msg in enumerate(openai_messages) if msg["role"] == "system"), None)
        
        if system_message_index is not None:
            # Add document context to system message
            openai_messages[system_message_index]["content"] += "\n\n" + document_context
        else:
            # If no system message exists, add one with the document context
            openai_messages.insert(0, {
                "role": "system",
                "content": f"You are an AI assistant. {document_context}"
            })
    
    # Use the OpenAI API to generate a response
    completion = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=openai_messages,
        temperature=0.7,
        max_tokens=4000,
    )
    
    # ... (other code)
```

## Database Schema

The RAG system relies on the following database tables:

### Documents Table

```sql
CREATE TABLE IF NOT EXISTS documents (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    content_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Document Chunks Table

```sql
CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Vector Index

```sql
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

## API Endpoints

### Upload Document

```
POST /api/documents
```

This endpoint allows users to upload documents and associate them with an agent. The document is processed asynchronously.

### Get Documents

```
GET /api/documents?agent_id={agent_id}
```

This endpoint retrieves all documents for a specific agent.

## Parent-Child Agent Document Sharing

The RAG system supports document sharing between parent and child agents:

1. When retrieving relevant chunks for a child agent, documents from the parent agent can be included
2. When retrieving relevant chunks for a parent agent, documents from child agents can be included

This enables knowledge sharing between related agents.

## Performance Considerations

1. **Chunking Strategy**: The chunking strategy balances chunk size and overlap to ensure context is preserved while keeping chunks manageable
2. **Embedding Model**: The system uses OpenAI's text-embedding-3-small model for efficient and accurate embeddings
3. **Vector Search**: The system uses cosine similarity for efficient vector search
4. **Caching**: Embeddings are stored in the database to avoid regenerating them for each query
5. **Asynchronous Processing**: Document processing is done asynchronously to avoid blocking the API

## Future Enhancements

1. **Improved Chunking**: More sophisticated chunking strategies based on semantic boundaries
2. **Hybrid Search**: Combine vector search with keyword search for better results
3. **Metadata Filtering**: Allow filtering chunks based on metadata (e.g., document type, date)
4. **Reranking**: Implement a reranking step to improve retrieval quality
5. **Streaming Responses**: Support streaming responses for better user experience
6. **Multi-modal Support**: Extend the system to handle images and other media types
7. **Chunk Caching**: Implement caching of frequently accessed chunks for better performance
