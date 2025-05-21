// Agent Types and Interfaces

// Parent Agent represents a client's main agent
export interface ParentAgent {
  id: number;
  name: string;
  description: string;
  client_id: number;
  created_at: string;
  updated_at?: string;
}

// Child Agent represents a task-specific agent under a parent agent
export interface ChildAgent {
  id: number;
  name: string;
  description: string;
  parent_id: number;
  task_id?: number;
  created_at: string;
  updated_at?: string;
}

// Generic Agent type that can be either parent or child
export interface Agent {
  id: number;
  name: string;
  description: string;
  client_id?: number;
  parent_id?: number;
  is_parent: boolean;
  task_id?: number;
  created_at: string;
  updated_at?: string;
}

// Chat represents a conversation with an agent
export interface Chat {
  id: number;
  agent_id: number;
  title?: string;
  parent_chat_id?: number;
  created_at: string;
  updated_at?: string;
}

// Message represents a single message in a chat
export interface Message {
  id: number;
  chat_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

// Document represents a file uploaded to an agent
export interface Document {
  id: number;
  agent_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

// AgentMemory represents a piece of information stored in an agent's memory
export interface AgentMemory {
  id: number;
  agent_id: number;
  content: string;
  source: 'chat' | 'document' | 'manual';
  importance: number;
  created_at: string;
  updated_at?: string;
}

// AgentTask represents a task assigned to an agent
export interface AgentTask {
  id: number;
  agent_id: number;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
}
