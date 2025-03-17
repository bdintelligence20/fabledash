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
  status_id: number;
  due_date: string | null;
  client_id: number;
  priority?: string;
  start_date?: string | null;
  created_at?: string;
}

export interface TaskStatus {
  id: number;
  name: string;
  color: string;
}
