# Chat History Feature

This document describes the chat history feature for parent and child agents in the FableDash application.

## Overview

The chat history feature allows users to:

1. View chat history for both parent and child agents
2. Create new chats for any agent
3. Create child chats linked to parent chats
4. Navigate between parent and child chats

## Database Schema

The feature uses a parent-child relationship between chats, implemented with a `parent_chat_id` column in the `chats` table:

```sql
ALTER TABLE chats ADD COLUMN parent_chat_id INTEGER REFERENCES chats(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_chats_parent_chat_id ON chats(parent_chat_id);
```

## API Endpoints

The following API endpoints support the chat history feature:

### Create a Chat

```
POST /api/chats
```

**Request Body:**
```json
{
  "agent_id": 123,
  "title": "Optional chat title",
  "parent_chat_id": 456  // Optional, links this chat to a parent chat
}
```

### Get Linked Chats

```
GET /api/chats/:id/linked-chats
```

Returns the specified chat along with its parent chat (if any) and child chats.

### Get Agent Chat History

```
GET /api/chats/agent/:agentId/chat-history
```

Returns all chats for the specified agent, along with related chats from parent or child agents.

## Frontend Components

### ChatHistory Component

The `ChatHistory` component displays:
- The agent's own chats
- Parent agent chats (if this is a child agent)
- Child agent chats (if this is a parent agent)

It also provides buttons to:
- Create a new chat for the current agent
- Create a child chat linked to an existing chat (for parent agents)

### Usage in AIAgentsPage

The `AIAgentsPage` component integrates the chat history feature by:
1. Fetching chat history when an agent is selected
2. Passing the chat history data to the `ChatHistory` component
3. Handling chat selection and creation

## How to Use

1. **View Chat History**: Select an agent to view its chat history
2. **Create a New Chat**: Click the "New Chat" button in the chat history panel
3. **Create a Child Chat**: For parent agents, click the "Create Child Chat" button next to a chat
4. **Navigate Between Chats**: Click on any chat in the history to view its messages

## Implementation Details

- Parent-child relationships between agents are mirrored in the chat structure
- Child chats can access context from parent chats
- Parent agents can access context from all their child agents
- The UI visually distinguishes between an agent's own chats, parent chats, and child chats

## Context Sharing

The system implements bidirectional context sharing between parent and child agents:

1. **Child to Parent**: 
   - Parent agents can access and recall information that was worked through on child agents
   - Parent agents can view the complete chat history of all their child agents
   - Parent agents can use context from child agent conversations when responding to queries
   - This allows the parent agent to have an overarching view of all work done by its child agents

2. **Parent to Child**: 
   - Child agents can access context from their parent agent
   - Child agents can view the chat history of their parent agent
   - This ensures child agents have the necessary background information

This bidirectional context sharing ensures that:
- Parent agents serve as coordinators with full visibility into all child agent activities
- Child agents benefit from the broader context established by the parent agent
- Knowledge flows seamlessly between parent and child agents

## Implementation Notes

### Avoiding Circular References

When creating child chats from parent chats, care must be taken to avoid circular references in the data being sent to the server:

1. In the `ChatHistory` component, the event object from button clicks should not be passed directly to the `onCreateChat` function.
2. In the `AIAgentsPage` component, the `createChat` function should use a properly typed object with only primitive values to avoid serialization issues.

```typescript
// Example of proper chat data structure
const chatData: { agent_id: number; parent_chat_id?: number } = {
  agent_id: selectedAgent.id,
};

// Safely add parent_chat_id only if it's a valid number
if (parentChatId && typeof parentChatId === 'number') {
  chatData.parent_chat_id = parentChatId;
}
```

This prevents the "Converting circular structure to JSON" error that can occur when DOM elements or React components are accidentally included in the data being sent to the server.

### CORS Configuration

To ensure proper communication between the frontend and backend, especially when deployed to production environments like Vercel, the backend server must be configured with appropriate CORS (Cross-Origin Resource Sharing) settings:

```javascript
// CORS configuration
app.use(cors({
  origin: ['https://fabledash.vercel.app', 'http://localhost:3000', 'http://localhost:5173'], // Allow specific origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Add CORS headers to all responses as a fallback
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://fabledash.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});
```

This configuration:
1. Explicitly allows requests from the frontend domain (`https://fabledash.vercel.app`)
2. Handles preflight OPTIONS requests properly
3. Includes necessary headers for cross-origin requests with credentials
4. Provides a fallback mechanism for browsers that don't fully support the CORS specification

Without proper CORS configuration, you may encounter errors like:
```
Access to fetch at 'https://fabledash-backend1.vercel.app/api/documents' from origin 'https://fabledash.vercel.app' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### Large File Upload Configuration

To support uploading large documents (up to 1GB) to agents, we've implemented a dedicated serverless function approach:

1. **Dedicated Serverless Function**:
   ```javascript
   // api/upload-document.js - Serverless function for handling large document uploads
   const supabase = require('../supabase');
   const documentProcessor = require('../routes/supabase/document-processor');
   const { v4: uuidv4 } = require('uuid');

   // Maximum request size (1GB)
   const MAX_SIZE = 1024 * 1024 * 1024;

   // Helper function to parse JSON with size limit
   const parseJSON = async (req) => {
     return new Promise((resolve, reject) => {
       let body = '';
       let size = 0;
       
       req.on('data', (chunk) => {
         size += chunk.length;
         if (size > MAX_SIZE) {
           reject(new Error('Request body too large'));
           req.destroy();
           return;
         }
         body += chunk.toString();
       });
       
       req.on('end', () => {
         try {
           const data = JSON.parse(body);
           resolve(data);
         } catch (error) {
           reject(new Error('Invalid JSON'));
         }
       });
       
       req.on('error', reject);
     });
   };

   // Main handler function
   module.exports = async (req, res) => {
     // Set CORS headers
     res.setHeader('Access-Control-Allow-Origin', 'https://fabledash.vercel.app');
     // ... rest of the function
   };
   ```

2. **Frontend Integration**:
   ```typescript
   // Upload document to an agent
   const uploadDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
     // ...
     
     reader.onload = async (e) => {
       try {
         const base64Data = e.target?.result as string;
         
         // Use the dedicated upload-document endpoint for large files
         const uploadUrl = `${apiUrl.replace('/api', '')}/api/upload-document`;
         console.log('Using upload endpoint:', uploadUrl);
         
         // Send to API
         const response = await fetch(uploadUrl, {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             agent_id: selectedAgent.id,
             file_data: base64Data,
             file_name: file.name,
             content_type: file.type
           }),
         });
         
         // ...
       }
     };
   };
   ```

3. **Vercel Configuration**:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "server.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "/server.js"
       }
     ],
     "functions": {
       "server.js": {
         "memory": 1024,
         "maxDuration": 60
       }
     }
   }
   ```

This serverless function approach provides several advantages:
1. **Direct Handling**: The function directly handles the HTTP request without going through Express middleware
2. **Custom Size Limits**: Implements custom streaming JSON parsing with size limits
3. **Explicit CORS Headers**: Sets CORS headers directly on the response
4. **Dedicated Resource Allocation**: Gets its own memory and execution time allocation in Vercel
5. **Simplified Deployment**: Can be deployed independently of the main application

Without these configurations, you may encounter errors like:
```
POST https://fabledash-backend1.vercel.app/api/documents net::ERR_FAILED 413 (Request Entity Too Large)
```

This setup allows for:
1. Uploading large documents (up to 1GB) to both parent and child agents
2. Increased memory allocation for processing large files
3. Extended function duration to handle time-consuming file processing
4. Proper CORS handling for cross-origin requests
