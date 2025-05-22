// Define shared types for client components
export interface Client {
  id: number;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  priority: string;
  status_id: number;
  client_id: number;
  created_at: string;
}

export interface TaskStatus {
  id: number;
  name: string;
  color: string;
  order: number;
}

export interface Agent {
  id: number;
  name: string;
  description: string;
  client_id: number | null;
  is_parent: boolean;
  parent_id: number | null;
  created_at: string;
}

export interface Chat {
  id: number;
  agent_id: number;
  created_at: string;
}

export interface Message {
  id: number;
  chat_id: number;
  role: string;
  content: string;
  created_at: string;
}

export interface Document {
  id: number;
  agent_id: number;
  file_name: string;
  created_at: string;
}
