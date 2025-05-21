# Chat History Feature

This document explains the implementation of the chat history feature in the FableDash application, focusing on the parent-child agent relationship and how chat history is managed between them.

## Overview

The chat history feature allows users to:

1. View the chat history of a specific agent
2. View the chat history of child agents for a parent agent
3. View the chat history of the parent agent for a child agent
4. Link chats together in a parent-child relationship

This enables a comprehensive view of all related conversations and facilitates knowledge sharing between agents.

## Implementation

### Backend (Python FastAPI)

The backend implementation is detailed in [python-backend/CHAT_HISTORY_FEATURE.md](python-backend/CHAT_HISTORY_FEATURE.md).

Key components:
- Database schema with parent-child relationships for agents and chats
- API endpoints for retrieving chat history across agents
- Logic for combining and presenting related chats

### Frontend (React)

The frontend implementation includes:

#### Components

- `AgentChat.tsx`: Main chat interface for interacting with an agent
- `ChatHistory.tsx`: Component for displaying chat history with filtering options
- `AgentDetails.tsx`: Shows agent details including parent-child relationships

#### Chat History Display

The `ChatHistory.tsx` component organizes chats into three sections:

1. **Agent's Own Chats**: Chats directly associated with the current agent
2. **Child Agent Chats**: If the current agent is a parent, shows chats from all child agents
3. **Parent Agent Chats**: If the current agent is a child, shows chats from the parent agent

```tsx
// Example structure from ChatHistory.tsx
<div className="chat-history">
  {/* Agent's own chats */}
  <section>
    <h3>Agent Chats</h3>
    {agentChats.map(chat => (
      <ChatItem key={chat.id} chat={chat} />
    ))}
  </section>

  {/* Child agent chats (if this is a parent agent) */}
  {isParentAgent && childAgentChats.length > 0 && (
    <section>
      <h3>Child Agent Chats</h3>
      {childAgentChats.map(chat => (
        <ChatItem key={chat.id} chat={chat} />
      ))}
    </section>
  )}

  {/* Parent agent chats (if this is a child agent) */}
  {hasParentAgent && parentAgentChats.length > 0 && (
    <section>
      <h3>Parent Agent Chats</h3>
      {parentAgentChats.map(chat => (
        <ChatItem key={chat.id} chat={chat} />
      ))}
    </section>
  )}
</div>
```

#### Data Fetching

Chat history data is fetched from the backend API:

```tsx
// Example from AgentChat.tsx
const fetchChatHistory = async (agentId: number) => {
  try {
    setLoading(true);
    const response = await fetch(`${API_URL}/api/chats/agent/${agentId}/chat-history`);
    const data = await response.json();
    
    if (data.success) {
      setAgentChats(data.agentChats || []);
      setChildAgentChats(data.childAgentChats || []);
      setParentAgentChats(data.parentAgentChats || []);
    } else {
      console.error('Error fetching chat history:', data.error);
    }
  } catch (error) {
    console.error('Error fetching chat history:', error);
  } finally {
    setLoading(false);
  }
};
```

## User Experience

### Viewing Chat History

1. Navigate to the AI Agents page
2. Select an agent to view its details
3. Click on the "Chat History" tab
4. Browse through the agent's chats, organized by:
   - Direct chats with this agent
   - Chats from child agents (if applicable)
   - Chats from the parent agent (if applicable)

### Creating New Chats

1. Navigate to an agent's details page
2. Click "New Chat"
3. If this is a child agent, you'll have the option to link this chat to a parent agent chat
4. Start the conversation

### Linking Chats

When creating a new chat with a child agent, you can link it to a parent agent chat:

1. Select the child agent
2. Click "New Chat"
3. In the chat creation dialog, select a parent chat from the dropdown
4. The new chat will be linked to the selected parent chat

## Benefits

### Knowledge Sharing

Parent agents can access the chat history of their child agents, allowing them to:
- Learn from child agent interactions
- Provide context for their own responses
- Ensure consistency across child agents

### Specialized Agents

Child agents can be specialized for specific tasks while still having access to the parent agent's knowledge:
- Parent agent handles general queries
- Child agents handle specialized domains
- All agents share a common knowledge base

### Hierarchical Organization

Organizations can structure their agents in a hierarchical manner:
- Top-level parent agents for company-wide knowledge
- Mid-level parent agents for department-specific knowledge
- Child agents for individual roles or tasks

## Future Enhancements

1. **Multi-level Hierarchies**: Support for grandparent-parent-child relationships
2. **Cross-agent Chat References**: Allow chats to reference chats from other agents
3. **Chat Merging**: Ability to merge related chats into a single conversation
4. **Chat Forking**: Create new child chats from specific points in a parent chat
5. **Selective Sharing**: Control which chats are shared between parent and child agents
