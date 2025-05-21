# RAG (Retrieval-Augmented Generation) Implementation

This document explains the implementation of the RAG (Retrieval-Augmented Generation) system in the FableDash application, focusing on how documents are processed, stored, and used to enhance AI responses.

## Overview

The RAG system allows agents to:

1. Upload and process documents (PDF, DOCX, TXT)
2. Extract text and split it into manageable chunks
3. Generate embeddings for each chunk
4. Store chunks and embeddings in a vector database
5. Retrieve relevant chunks based on user queries
6. Enhance AI responses with context from retrieved chunks

This enables agents to provide more accurate and contextually relevant responses based on the documents they have access to.

## Implementation

### Backend (Python FastAPI)

The backend implementation is detailed in [python-backend/RAG_IMPLEMENTATION.md](python-backend/RAG_IMPLEMENTATION.md).

Key components:
- Document processing pipeline
- Embedding generation using OpenAI's API
- Vector storage in Supabase
- Semantic search for relevant chunks
- Context formatting for AI prompts

### Frontend (React)

The frontend implementation includes:

#### Components

- `AgentDetails.tsx`: Shows agent details and manages document uploads
- `AgentChat.tsx`: Chat interface that displays AI responses enhanced with document context
- Document upload and management UI

#### Document Upload

The document upload process is handled in the `AgentDetails.tsx` component:

```tsx
// Example from AgentDetails.tsx
const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  setUploading(true);
  
  try {
    const formData = new FormData();
    formData.append('agent_id', agentId.toString());
    formData.append('document', files[0]);
    
    const response = await fetch(`${API_URL}/api/documents`, {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update documents list
      fetchDocuments();
      showNotification('Document uploaded successfully');
    } else {
      console.error('Error uploading document:', data.error);
      showNotification('Error uploading document', 'error');
    }
  } catch (error) {
    console.error('Error uploading document:', error);
    showNotification('Error uploading document', 'error');
  } finally {
    setUploading(false);
  }
};
```

#### Chat Interface with RAG

The chat interface in `AgentChat.tsx` displays AI responses that are enhanced with document context:

```tsx
// Example from AgentChat.tsx
const sendMessage = async (message: string) => {
  try {
    setLoading(true);
    
    // Add user message to chat
    const newMessages = [...messages, { role: 'user', content: message }];
    setMessages(newMessages);
    
    // Send message to API
    const response = await fetch(`${API_URL}/api/chats/${chatId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Add AI response to chat
      setMessages([...newMessages, { role: 'assistant', content: data.message.content }]);
      
      // If the response includes document references, display them
      if (data.documentReferences && data.documentReferences.length > 0) {
        setDocumentReferences(data.documentReferences);
      }
    } else {
      console.error('Error sending message:', data.error);
      showNotification('Error sending message', 'error');
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showNotification('Error sending message', 'error');
  } finally {
    setLoading(false);
  }
};
```

#### Document References Display

When the AI response includes document references, they are displayed to the user:

```tsx
// Example from AgentChat.tsx
const DocumentReferences = ({ references }) => {
  if (!references || references.length === 0) return null;
  
  return (
    <div className="document-references">
      <h4>Document References:</h4>
      <ul>
        {references.map((ref, index) => (
          <li key={index}>
            <span className="document-name">{ref.document.filename}</span>
            <span className="document-relevance">Relevance: {(ref.similarity * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

## User Experience

### Uploading Documents

1. Navigate to the AI Agents page
2. Select an agent to view its details
3. Click on the "Documents" tab
4. Click "Upload Document" and select a file
5. The document is processed in the background
6. Once processing is complete, the document appears in the list

### Chatting with Document Context

1. Navigate to an agent's details page
2. Click "New Chat" or select an existing chat
3. Ask a question related to the uploaded documents
4. The AI response will include relevant information from the documents
5. Document references are displayed below the response

## Benefits

### Enhanced AI Responses

The RAG system enhances AI responses by:
- Providing specific information from documents
- Reducing hallucinations by grounding responses in factual content
- Enabling precise answers to domain-specific questions

### Knowledge Base Creation

Organizations can create a knowledge base by:
- Uploading company documents, manuals, and guides
- Organizing documents by agent specialization
- Building a hierarchical knowledge structure with parent-child agents

### Contextual Understanding

The system improves contextual understanding by:
- Retrieving the most relevant document chunks for each query
- Considering the semantic meaning of queries, not just keywords
- Providing context from multiple documents when needed

## Parent-Child Agent Document Sharing

The RAG system supports document sharing between parent and child agents:

1. When retrieving relevant chunks for a child agent, documents from the parent agent can be included
2. When retrieving relevant chunks for a parent agent, documents from child agents can be included

This enables knowledge sharing between related agents.

## Future Enhancements

1. **Improved Chunking**: More sophisticated chunking strategies based on semantic boundaries
2. **Hybrid Search**: Combine vector search with keyword search for better results
3. **Metadata Filtering**: Allow filtering chunks based on metadata (e.g., document type, date)
4. **Reranking**: Implement a reranking step to improve retrieval quality
5. **Streaming Responses**: Support streaming responses for better user experience
6. **Multi-modal Support**: Extend the system to handle images and other media types
7. **Chunk Caching**: Implement caching of frequently accessed chunks for better performance
