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

1. **Child to Parent**: Parent agents can access and recall information that was worked through on child agents. This allows the parent agent to have an overarching view of all work done by its child agents.

2. **Parent to Child**: Child agents can access context from their parent agent, ensuring they have the necessary background information.

This bidirectional context sharing ensures that:
- Parent agents serve as coordinators with full visibility into all child agent activities
- Child agents benefit from the broader context established by the parent agent
- Knowledge flows seamlessly between parent and child agents
