import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, X, Paperclip, MessageSquare, Clock } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Select,
  Modal,
  Badge,
  Spinner,
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

interface TimeLogResponse {
  id: string;
  date: string;
  description: string | null;
  duration_minutes: number | null;
  client_id: string;
  task_id: string | null;
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

/* -------------------------------------------------------------------------- */
/*  Status transition definitions                                              */
/* -------------------------------------------------------------------------- */

interface StatusTransition {
  label: string;
  target: TaskStatus;
  variant: 'primary' | 'secondary' | 'danger';
}

const STATUS_TRANSITIONS: Record<TaskStatus, StatusTransition[]> = {
  todo: [
    { label: 'Start', target: 'in_progress', variant: 'primary' },
  ],
  in_progress: [
    { label: 'Submit for Review', target: 'in_review', variant: 'primary' },
    { label: 'Block', target: 'blocked', variant: 'danger' },
  ],
  in_review: [
    { label: 'Approve', target: 'done', variant: 'primary' },
    { label: 'Return', target: 'in_progress', variant: 'secondary' },
  ],
  blocked: [
    { label: 'Unblock', target: 'todo', variant: 'secondary' },
  ],
  done: [
    { label: 'Reopen', target: 'todo', variant: 'secondary' },
  ],
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isOverdue(dateStr: string | null, status: TaskStatus): boolean {
  if (!dateStr || status === 'done') return false;
  return new Date(dateStr) < new Date();
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  return formatDate(dateStr);
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  // Task data
  const [task, setTask] = useState<TaskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client data
  const [clientName, setClientName] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientResponse[]>([]);

  // Status transition loading
  const [transitionLoading, setTransitionLoading] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    client_id: '',
    priority: 'medium' as TaskPriority,
    due_date: '',
    assigned_to: '',
  });

  // Delete confirmation
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Comments
  const [commentContent, setCommentContent] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  // Attachments
  const [attachFilename, setAttachFilename] = useState('');
  const [attachUrl, setAttachUrl] = useState('');
  const [attachLoading, setAttachLoading] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);

  // Time logs
  const [timeLogs, setTimeLogs] = useState<TimeLogResponse[]>([]);

  /* ---- Data fetching ---- */

  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: TaskResponse }>(`/tasks/${taskId}`);
      setTask(res.data);
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
        setError('Task not found');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load task');
      }
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const fetchClients = useCallback(async () => {
    try {
      const res = await apiClient.get<{ success: boolean; data: ClientResponse[] }>('/clients');
      setClients(res.data);
    } catch {
      // Non-critical
    }
  }, []);

  const fetchTimeLogs = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await apiClient.get<{ success: boolean; data: TimeLogResponse[] }>(`/time-logs?task_id=${taskId}`);
      setTimeLogs(res.data);
    } catch {
      // Time logs may not support task_id filter yet
      setTimeLogs([]);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
    fetchClients();
    fetchTimeLogs();
  }, [fetchTask, fetchClients, fetchTimeLogs]);

  // Resolve client name when task or clients load
  useEffect(() => {
    if (task && clients.length > 0) {
      const client = clients.find((c) => c.id === task.client_id);
      setClientName(client ? client.name : null);
    }
  }, [task, clients]);

  /* ---- Status transition ---- */

  async function handleStatusTransition(newStatus: TaskStatus) {
    if (!taskId) return;
    setTransitionLoading(true);
    try {
      await apiClient.put(`/tasks/${taskId}`, { status: newStatus });
      await fetchTask();
    } catch {
      // Error swallowed; user can retry
    } finally {
      setTransitionLoading(false);
    }
  }

  /* ---- Edit task ---- */

  function openEditModal() {
    if (!task) return;
    setEditForm({
      title: task.title,
      description: task.description || '',
      client_id: task.client_id,
      priority: task.priority,
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      assigned_to: task.assigned_to || '',
    });
    setEditError(null);
    setEditOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!taskId) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const body: Record<string, unknown> = {
        title: editForm.title,
        client_id: editForm.client_id,
        priority: editForm.priority,
      };
      // Include description even if empty (to allow clearing it)
      body.description = editForm.description || null;
      if (editForm.due_date) body.due_date = editForm.due_date;
      if (editForm.assigned_to) body.assigned_to = editForm.assigned_to;

      await apiClient.put(`/tasks/${taskId}`, body);
      setEditOpen(false);
      await fetchTask();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setEditLoading(false);
    }
  }

  /* ---- Delete task ---- */

  async function handleDeleteTask() {
    if (!taskId) return;
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/tasks/${taskId}`);
      navigate('/tasks');
    } catch {
      // Error swallowed; user can retry
    } finally {
      setDeleteLoading(false);
    }
  }

  /* ---- Comments ---- */

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!taskId || !commentContent.trim()) return;
    setCommentLoading(true);
    try {
      await apiClient.post(`/tasks/${taskId}/comments`, { content: commentContent.trim() });
      setCommentContent('');
      await fetchTask();
    } catch {
      // Error swallowed
    } finally {
      setCommentLoading(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!taskId) return;
    setDeletingCommentId(commentId);
    try {
      await apiClient.delete(`/tasks/${taskId}/comments/${commentId}`);
      await fetchTask();
    } catch {
      // Error swallowed
    } finally {
      setDeletingCommentId(null);
    }
  }

  /* ---- Attachments ---- */

  async function handleAddAttachment(e: React.FormEvent) {
    e.preventDefault();
    if (!taskId || !attachFilename.trim() || !attachUrl.trim()) return;
    setAttachLoading(true);
    try {
      await apiClient.post(`/tasks/${taskId}/attachments`, {
        filename: attachFilename.trim(),
        url: attachUrl.trim(),
      });
      setAttachFilename('');
      setAttachUrl('');
      await fetchTask();
    } catch {
      // Error swallowed
    } finally {
      setAttachLoading(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!taskId) return;
    setDeletingAttachmentId(attachmentId);
    try {
      await apiClient.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
      await fetchTask();
    } catch {
      // Error swallowed
    } finally {
      setDeletingAttachmentId(null);
    }
  }

  /* ---- Loading / Error / 404 states ---- */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/tasks" className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-primary-600 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Tasks
        </Link>
        <Card className="border-danger-200 bg-danger-50 p-6">
          <p className="text-danger-700 font-medium">{error}</p>
        </Card>
      </div>
    );
  }

  if (!task) return null;

  const transitions = STATUS_TRANSITIONS[task.status];

  /* ---- Render ---- */

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/tasks"
        className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-primary-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Tasks
      </Link>

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-surface-900">{task.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={STATUS_BADGE_VARIANT[task.status]} dot size="md">
              {STATUS_LABELS[task.status]}
            </Badge>
            <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]} size="md">
              {PRIORITY_LABELS[task.priority]}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status transition buttons */}
          {transitions.map((t) => (
            <Button
              key={t.target}
              variant={t.variant}
              size="sm"
              loading={transitionLoading}
              onClick={() => handleStatusTransition(t.target)}
            >
              {t.label}
            </Button>
          ))}

          {/* Edit button */}
          <Button
            variant="secondary"
            size="sm"
            icon={<Pencil className="h-4 w-4" />}
            onClick={openEditModal}
          >
            Edit
          </Button>

          {/* Delete button */}
          {!deleteConfirming ? (
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setDeleteConfirming(true)}
            >
              Delete
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-1.5">
              <span className="text-sm text-danger-700">Are you sure?</span>
              <Button
                variant="danger"
                size="sm"
                loading={deleteLoading}
                onClick={handleDeleteTask}
              >
                Confirm
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeleteConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Task info card */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column -- primary fields */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Description</p>
              <p className="text-sm text-surface-700">
                {task.description || 'No description'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Client</p>
              {clientName ? (
                <Link to={`/clients/${task.client_id}`} className="text-sm text-primary-600 hover:text-primary-700 transition-colors">
                  {clientName}
                </Link>
              ) : (
                <span className="text-sm text-surface-500">{task.client_id}</span>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Priority</p>
              <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>
                {PRIORITY_LABELS[task.priority]}
              </Badge>
            </div>

            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Due Date</p>
              <span className={`text-sm ${isOverdue(task.due_date, task.status) ? 'text-danger-600 font-medium' : 'text-surface-700'}`}>
                {formatDate(task.due_date)}
              </span>
            </div>

            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Assigned To</p>
              <span className="text-sm text-surface-700">
                {task.assigned_to || 'Unassigned'}
              </span>
            </div>
          </div>

          {/* Right column -- metadata */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Created By</p>
              <span className="text-sm text-surface-700">{task.created_by}</span>
            </div>

            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Created At</p>
              <span className="text-sm text-surface-700">{formatDateTime(task.created_at)}</span>
            </div>

            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Last Updated</p>
              <span className="text-sm text-surface-700">{formatDateTime(task.updated_at)}</span>
            </div>

            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Comments</p>
              <span className="text-sm text-surface-700">{task.comments.length}</span>
            </div>

            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Attachments</p>
              <span className="text-sm text-surface-700">{task.attachments.length}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Comments & Attachments -- side by side on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Comments section */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-surface-100 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-surface-400" />
            <h2 className="text-base font-semibold text-surface-900">Comments</h2>
            <Badge variant="default" size="sm">{task.comments.length}</Badge>
          </div>

          <div className="px-6 py-4 space-y-4">
            {/* Existing comments */}
            {task.comments.length === 0 ? (
              <p className="text-sm text-surface-400">No comments yet.</p>
            ) : (
              <div className="space-y-3">
                {task.comments.map((comment) => (
                  <div key={comment.id} className="flex items-start justify-between gap-2 rounded-lg bg-surface-50 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-surface-800">
                          {comment.author_name || comment.author_uid}
                        </span>
                        <span className="text-xs text-surface-400">
                          {relativeTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-surface-700">{comment.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(comment.id)}
                      disabled={deletingCommentId === comment.id}
                      className="shrink-0 rounded p-1 text-surface-400 hover:text-danger-600 hover:bg-danger-50 transition-colors disabled:opacity-50"
                      title="Delete comment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add comment form */}
            <form onSubmit={handleAddComment} className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Write a comment..."
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={commentLoading}
                disabled={!commentContent.trim()}
              >
                Post
              </Button>
            </form>
          </div>
        </Card>

        {/* Attachments section */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-surface-100 flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-surface-400" />
            <h2 className="text-base font-semibold text-surface-900">Attachments</h2>
            <Badge variant="default" size="sm">{task.attachments.length}</Badge>
          </div>

          <div className="px-6 py-4 space-y-4">
            {/* Existing attachments */}
            {task.attachments.length === 0 ? (
              <p className="text-sm text-surface-400">No attachments yet.</p>
            ) : (
              <div className="space-y-2">
                {task.attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-50 p-3">
                    <div className="min-w-0 flex-1">
                      {attachment.url ? (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors truncate block"
                        >
                          {attachment.filename}
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-surface-800 truncate block">
                          {attachment.filename}
                        </span>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        {attachment.content_type && (
                          <span className="text-xs text-surface-400">{attachment.content_type}</span>
                        )}
                        <span className="text-xs text-surface-400">
                          {formatDate(attachment.uploaded_at)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(attachment.id)}
                      disabled={deletingAttachmentId === attachment.id}
                      className="shrink-0 rounded p-1 text-surface-400 hover:text-danger-600 hover:bg-danger-50 transition-colors disabled:opacity-50"
                      title="Delete attachment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add attachment form */}
            <form onSubmit={handleAddAttachment} className="space-y-2">
              <Input
                placeholder="Filename"
                value={attachFilename}
                onChange={(e) => setAttachFilename(e.target.value)}
              />
              <Input
                placeholder="URL"
                value={attachUrl}
                onChange={(e) => setAttachUrl(e.target.value)}
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={attachLoading}
                disabled={!attachFilename.trim() || !attachUrl.trim()}
              >
                Attach
              </Button>
            </form>
          </div>
        </Card>
      </div>

      {/* Time Logs section */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-surface-100 flex items-center gap-2">
          <Clock className="h-4 w-4 text-surface-400" />
          <h2 className="text-base font-semibold text-surface-900">Time Logs</h2>
        </div>

        <div className="px-6 py-4">
          {timeLogs.length === 0 ? (
            <p className="text-sm text-surface-400">
              No time logs recorded. Time tracking available in Phase 5.
            </p>
          ) : (
            <div className="space-y-2">
              {timeLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg bg-surface-50 p-3">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-surface-700">{formatDate(log.date)}</span>
                    <span className="text-sm text-surface-600">{log.description || 'No description'}</span>
                  </div>
                  <span className="text-sm font-medium text-surface-800">
                    {formatDuration(log.duration_minutes)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Edit Task Modal */}
      <Modal
        isOpen={editOpen}
        onClose={() => { setEditOpen(false); setEditError(null); }}
        title="Edit Task"
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Title"
            required
            value={editForm.title}
            onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Task title"
          />

          <div className="w-full">
            <label className="block text-label mb-1.5">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
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
            value={editForm.client_id}
            onChange={(e) => setEditForm((prev) => ({ ...prev, client_id: e.target.value }))}
          />

          <Select
            label="Priority"
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ] as SelectOption[]}
            value={editForm.priority}
            onChange={(e) => setEditForm((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}
          />

          <Input
            label="Due Date"
            type="date"
            value={editForm.due_date}
            onChange={(e) => setEditForm((prev) => ({ ...prev, due_date: e.target.value }))}
          />

          <Input
            label="Assigned To"
            value={editForm.assigned_to}
            onChange={(e) => setEditForm((prev) => ({ ...prev, assigned_to: e.target.value }))}
            placeholder="User ID (optional)"
          />

          {editError && (
            <p className="text-sm text-danger-600">{editError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setEditOpen(false); setEditError(null); }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={editLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
