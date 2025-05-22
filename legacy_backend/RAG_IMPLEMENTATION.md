# RAG Implementation for Agent System

This document explains how the Retrieval-Augmented Generation (RAG) system is implemented for the agent system, with partitioning for parent and child agents.

## Supported Document Types

The system supports the following document types:

1. **PDF Files** (`.pdf`): Uses pdf-parse to extract text from PDF documents.
2. **Word Documents**:
   - **DOCX Files** (`.docx`): Uses mammoth to extract text from modern Word documents.
   - **DOC Files** (`.doc`): Limited support via mammoth for legacy Word documents.
3. **Plain Text Files** (`.txt`): Directly reads the text content.
4. **CSV Files** (`.csv`): Parses the CSV structure and converts it to a text representation.
5. **JSON Files** (`.json`): Parses the JSON structure and formats it as readable text.
6. **HTML Files** (`.html`, `.htm`): Extracts the text content (without parsing the HTML structure).
7. **Markdown Files** (`.md`): Reads the markdown content as text.
8. **Other Text-Based Files**: Attempts to read as plain text.

## Overview

The RAG system consists of three main components:

1. **Document Processing**: When a document is uploaded, it is processed to extract text, chunk it into smaller pieces, and generate embeddings for each chunk.
2. **Document Chunking**: The extracted text is split into smaller chunks to make it easier to retrieve relevant information.
3. **Retrieval**: When a user sends a message, the system retrieves the most relevant chunks based on the message content and uses them to augment the AI's response.

## Document Processing

Document processing happens in the `document-processor.js` file. When a document is uploaded, the following steps occur:

1. The document is uploaded to Supabase Storage
2. The document metadata is stored in the `documents` table
3. If extracted text is provided, it is processed in the background:
   - The text is chunked into smaller pieces
   - Embeddings are generated for each chunk using OpenAI's embedding API
   - The chunks and embeddings are stored in the `chunks` table

```javascript
// Process a document
async function processDocument(document, extractedText) {
  // Update the document with the extracted text
  await supabase.from('documents').update({ extracted_text: extractedText }).eq('id', document.id);
  
  // Chunk the text
  const chunks = chunkText(extractedText, 1000);
  
  // Generate embeddings and store chunks
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk);
    await supabase.from('chunks').insert({
      document_id: document.id,
      agent_id: document.agent_id,
      content: chunk,
      source: document.file_name,
      embedding: embedding
    });
  }
}
```

## Document Chunking

The chunking algorithm splits the text into smaller pieces based on paragraphs, ensuring that each chunk is not too large:

```javascript
function chunkText(text, maxChunkSize = 1000) {
  // Split text into paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  
  const chunks = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the max chunk size, start a new chunk
    if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    
    // Add paragraph to current chunk
    currentChunk += paragraph + '\n\n';
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}
```

## Retrieval

When a user sends a message, the system retrieves the most relevant chunks based on the message content:

1. Generate an embedding for the user's message
2. Determine if the agent is a child agent and whether to include parent documents
3. Retrieve chunks from the database for the agent (and parent if applicable)
4. Sort the chunks by relevance (using vector similarity)
5. Format the top chunks as context for the AI

```javascript
async function retrieveRelevantChunks(agentId, query, limit = 5, includeParentDocs = false) {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);
  
  // Get the agent to check if it has a parent
  const { data: agent } = await supabase.from('agents').select('parent_id').eq('id', agentId).single();
  
  // Determine which agent IDs to include in the search
  let agentIds = [agentId];
  
  // If this is a child agent and includeParentDocs is true, include the parent's documents
  if (includeParentDocs && agent.parent_id) {
    agentIds.push(agent.parent_id);
  }
  
  // Retrieve chunks for the agent(s)
  const { data: chunks } = await supabase.from('chunks').select('*, documents(file_name)').in('agent_id', agentIds);
  
  // Sort chunks by relevance and take the top 'limit' chunks
  const topChunks = sortChunksByRelevance(chunks, queryEmbedding).slice(0, limit);
  
  return topChunks;
}
```

## Parent-Child Document Sharing

The system supports parent-child document sharing:

1. When a user sends a message to a child agent, the system checks if it has a parent
2. If it does, it includes the parent's documents in the retrieval process
3. This allows child agents to access their parent's knowledge while maintaining their own specialized knowledge

```javascript
// Determine if this is a child agent and if we should include parent documents
let includeParentDocs = false;
if (chat.agents) {
  const { data: agent } = await supabase
    .from('agents')
    .select('parent_id, is_parent')
    .eq('id', chat.agents.id)
    .single();
  
  if (agent && agent.parent_id) {
    // This is a child agent, so we'll include parent documents
    includeParentDocs = true;
  }
}

// Retrieve relevant chunks for the query
const relevantChunks = await documentProcessor.retrieveRelevantChunks(
  chat.agents.id,
  message,
  5, // Limit to 5 most relevant chunks
  includeParentDocs // Include parent documents if this is a child agent
);
```

## Implementation Notes

- The current implementation uses a simplified approach to vector similarity since Supabase's pgvector extension is not used. In a production environment, you would use a vector database or Supabase's pgvector extension for more efficient similarity search.
- The document processing happens asynchronously in the background, so the user doesn't have to wait for it to complete.
- The system is designed to be modular, so you can easily replace components (e.g., the embedding generation, chunking algorithm, or retrieval method) without affecting the rest of the system.
