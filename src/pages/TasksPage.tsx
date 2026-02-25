import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, Pencil, X } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Select,
  Modal,
  Table,
  Badge,
  StatCard,
} from '../components/ui';
import type { SelectOption } from '../components/ui';
import { apiClient } from '../lib/api';

/* -------------------------------------------------------------------------- */
/*  Types (matching backend models)                                            */
/* -------------------------------------------------------------------------- */

type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface TaskComment {
  id: string;
  content: string;
  author_uid: string;
  author_name: string | null;
  created_at: string;
}

interface TaskAttachment {
  id: string;
  filename: string;
  url: string;
  content_type: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

interface TaskResponse {
  id: string;
  title: string;
  description: string | null;
  client_id: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  comments: TaskComment[];
  attachments: TaskAttachment[];
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface ClientResponse {
  id: string;
  name: string;
  partner_group: string;
  contact_email: string | null;
  contact_phone: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const STATUS_BADGE_VARIANT: Record<TaskStatus, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  todo: 'default',
  in_progress: 'primary',
  in_review: 'warning',
  done: 'success',
  blocked: 'danger',
};

const PRIORITY_BADGE_VARIANT: Record<TaskPriority, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  low: 'default',
  medium: 'primary',
  high: 'warning',
  urgent: 'danger',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  blocked: 'Blocked',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Statuses' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const BULK_STATUS_OPTIONS: SelectOption[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return 'No date';
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isOverdue(dateStr: string | null, status: TaskStatus): boolean {
  if (!dateStr || status === 'done') return false;
  return new Date(dateStr) < new Date();
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function TasksPage() {
  // Data state
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [clients, setClients] = useState<ClientResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>('todo');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    client_id: '',
    priority: 'medium' as TaskPriority,
    due_date: '',
    assigned_to: '',
  });

  // Delete confirmation state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Client map for resolving names
  const clientMap: Record<string, string> = {};
  for (const c of clients) {
    clientMap[c.id] = c.name;
  }

  // Client filter options
  const clientOptions: SelectOption[] = [
    { value: '', label: 'All Clients' },
    ...clients.map((c) => ({ value: c.id, label: c.name })),
  ];

  /* ---- Data fetching ---- */

  const fetchClients = useCallback(async () => {
    try {
      const res = await apiClient.get<{ success: boolean; data: ClientResponse[] }>('/clients');
      setClients(res.data);
    } catch {
      // Clients are non-critical for page render
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (clientFilter) params.set('client_id', clientFilter);

      const qs = params.toString();
      const endpoint = qs ? `/tasks?${qs}` : '/tasks';
      const res = await apiClient.get<{ success: boolean; data: TaskResponse[] }>(endpoint);
      setTasks(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, clientFilter]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  /* ---- Filtered list (client-side search) ---- */

  const displayedTasks = searchQuery
    ? tasks.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : tasks;

  /* ---- Stat computations ---- */

  const totalCount = displayedTasks.length;
  const inProgressCount = displayedTasks.filter((t) => t.status === 'in_progress').length;
  const overdueCount = displayedTasks.filter((t) => isOverdue(t.due_date, t.status)).length;
  const completedCount = displayedTasks.filter((t) => t.status === 'done').length;

  /* ---- Bulk select ---- */

  const allSelected = displayedTasks.length > 0 && displayedTasks.every((t) => selectedIds.has(t.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedTasks.map((t) => t.id)));
    }
  }

  async function applyBulkStatus() {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const updates = Array.from(selectedIds).map((id) =>
        apiClient.put(`/tasks/${id}`, { status: bulkStatus }),
      );
      await Promise.all(updates);
      setSelectedIds(new Set());
      await fetchTasks();
    } catch {
      // Individual failures are swallowed; list refresh will show actual state
    } finally {
      setBulkLoading(false);
    }
  }

  /* ---- Clear filters ---- */

  function clearFilters() {
    setStatusFilter('');
    setPriorityFilter('');
    setClientFilter('');
    setSearchQuery('');
  }

  const hasActiveFilters = statusFilter || priorityFilter || clientFilter || searchQuery;

  /* ---- Create task ---- */

  function resetCreateForm() {
    setNewTask({
      title: '',
      description: '',
      client_id: '',
      priority: 'medium',
      due_date: '',
      assigned_to: '',
    });
    setCreateError(null);
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    try {
      const body: Record<string, unknown> = {
        title: newTask.title,
        client_id: newTask.client_id,
        priority: newTask.priority,
        status: 'todo',
      };
      if (newTask.description) body.description = newTask.description;
      if (newTask.due_date) body.due_date = newTask.due_date;
      if (newTask.assigned_to) body.assigned_to = newTask.assigned_to;

      await apiClient.post('/tasks', body);
      setCreateOpen(false);
      resetCreateForm();
      await fetchTasks();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setCreateLoading(false);
    }
  }

  /* ---- Delete task ---- */

  async function handleDeleteTask() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/tasks/${deleteId}`);
      setDeleteId(null);
      await fetchTasks();
    } catch {
      // Error swallowed; user can retry
    } finally {
      setDeleteLoading(false);
    }
  }

  /* ---- Render ---- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-900">Tasks</h1>
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          New Task
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-44">
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Select
            options={PRIORITY_OPTIONS}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            options={clientOptions}
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          />
        </div>
        {hasActiveFilters && (
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Tasks" value={totalCount} loading={loading} />
        <StatCard title="In Progress" value={inProgressCount} loading={loading} />
        <StatCard title="Overdue" value={overdueCount} loading={loading} />
        <StatCard title="Completed" value={completedCount} loading={loading} />
      </div>

      {/* Error display */}
      {error && (
        <Card className="border-danger-200 bg-danger-50 p-4">
          <p className="text-sm text-danger-700">{error}</p>
        </Card>
      )}

      {/* Data table */}
      <Card padding="none">
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                />
              </Table.HeaderCell>
              <Table.HeaderCell>Title</Table.HeaderCell>
              <Table.HeaderCell>Client</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Priority</Table.HeaderCell>
              <Table.HeaderCell>Due Date</Table.HeaderCell>
              <Table.HeaderCell className="w-24">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={7} className="text-center py-12 text-surface-400">
                  Loading tasks...
                </Table.Cell>
              </Table.Row>
            ) : displayedTasks.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={7} className="text-center py-12 text-surface-400">
                  No tasks found.
                </Table.Cell>
              </Table.Row>
            ) : (
              displayedTasks.map((task) => (
                <Table.Row key={task.id}>
                  <Table.Cell>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(task.id)}
                      onChange={() => toggleSelect(task.id)}
                      className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Link
                      to={`/tasks/${task.id}`}
                      className="font-medium text-surface-900 hover:text-primary-600 transition-colors"
                    >
                      {task.title}
                    </Link>
                  </Table.Cell>
                  <Table.Cell>{clientMap[task.client_id] || 'Unknown'}</Table.Cell>
                  <Table.Cell>
                    <Badge variant={STATUS_BADGE_VARIANT[task.status]} dot>
                      {STATUS_LABELS[task.status]}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>
                      {PRIORITY_LABELS[task.priority]}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className={isOverdue(task.due_date, task.status) ? 'text-danger-600 font-medium' : ''}>
                      {formatDueDate(task.due_date)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded p-1.5 text-surface-400 hover:text-primary-600 hover:bg-surface-100 transition-colors"
                        title="Edit task"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(task.id)}
                        className="rounded p-1.5 text-surface-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Card>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-surface-900 text-white rounded-xl px-5 py-3 shadow-strong z-30">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="w-40">
            <Select
              options={BULK_STATUS_OPTIONS}
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="bg-surface-800 border-surface-700 text-white text-sm py-1.5"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            loading={bulkLoading}
            onClick={applyBulkStatus}
          >
            Apply
          </Button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="ml-1 rounded p-1 hover:bg-surface-700 transition-colors"
            title="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Create Task Modal */}
      <Modal isOpen={createOpen} onClose={() => { setCreateOpen(false); resetCreateForm(); }} title="New Task" size="lg">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input
            label="Title"
            required
            value={newTask.title}
            onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Task title"
          />

          <div className="w-full">
            <label className="block text-label mb-1.5">Description</label>
            <textarea
              value={newTask.description}
              onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Task description (optional)"
              rows={3}
              className="w-full rounded-lg border border-surface-200 bg-white px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:ring-focus focus:border-primary-500 transition-default"
            />
          </div>

          <Select
            label="Client"
            required
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Select a client"
            value={newTask.client_id}
            onChange={(e) => setNewTask((prev) => ({ ...prev, client_id: e.target.value }))}
          />

          <Select
            label="Priority"
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
            value={newTask.priority}
            onChange={(e) => setNewTask((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}
          />

          <Input
            label="Due Date"
            type="date"
            value={newTask.due_date}
            onChange={(e) => setNewTask((prev) => ({ ...prev, due_date: e.target.value }))}
          />

          <Input
            label="Assigned To"
            value={newTask.assigned_to}
            onChange={(e) => setNewTask((prev) => ({ ...prev, assigned_to: e.target.value }))}
            placeholder="User ID (optional)"
          />

          {createError && (
            <p className="text-sm text-danger-600">{createError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setCreateOpen(false); resetCreateForm(); }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={createLoading}>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteId !== null} onClose={() => setDeleteId(null)} title="Delete Task" size="sm">
        <p className="text-sm text-surface-600">
          Are you sure you want to delete this task? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleteLoading} onClick={handleDeleteTask}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
