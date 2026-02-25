import { useState, useCallback } from 'react';
import { MessageSquare, Clock } from 'lucide-react';
import { Badge } from '../ui';

/* -------------------------------------------------------------------------- */
/*  Types (matching TasksPage definitions)                                     */
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

/* -------------------------------------------------------------------------- */
/*  Props                                                                      */
/* -------------------------------------------------------------------------- */

interface KanbanBoardProps {
  tasks: TaskResponse[];
  clientMap: Record<string, string>;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onTaskClick: (taskId: string) => void;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'in_review', label: 'In Review' },
  { status: 'done', label: 'Done' },
  { status: 'blocked', label: 'Blocked' },
];

const COLUMN_STYLES: Record<TaskStatus, { border: string; bg: string; bgHover: string }> = {
  todo: {
    border: 'border-l-4 border-surface-400',
    bg: 'bg-surface-50',
    bgHover: 'bg-surface-100',
  },
  in_progress: {
    border: 'border-l-4 border-primary-400',
    bg: 'bg-primary-50',
    bgHover: 'bg-primary-100',
  },
  in_review: {
    border: 'border-l-4 border-warning-400',
    bg: 'bg-warning-50',
    bgHover: 'bg-warning-100',
  },
  done: {
    border: 'border-l-4 border-success-400',
    bg: 'bg-success-50',
    bgHover: 'bg-success-100',
  },
  blocked: {
    border: 'border-l-4 border-danger-400',
    bg: 'bg-danger-50',
    bgHover: 'bg-danger-100',
  },
};

const PRIORITY_BADGE_VARIANT: Record<TaskPriority, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  low: 'default',
  medium: 'primary',
  high: 'warning',
  urgent: 'danger',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
  });
}

function isOverdue(dateStr: string | null, status: TaskStatus): boolean {
  if (!dateStr || status === 'done') return false;
  return new Date(dateStr) < new Date();
}

/* -------------------------------------------------------------------------- */
/*  KanbanCard                                                                 */
/* -------------------------------------------------------------------------- */

interface KanbanCardProps {
  task: TaskResponse;
  clientName: string;
  onTaskClick: (taskId: string) => void;
}

function KanbanCard({ task, clientName, onTaskClick }: KanbanCardProps) {
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.setData('application/x-source-status', task.status);
      e.dataTransfer.effectAllowed = 'move';
      // Add a slight delay for visual feedback
      (e.target as HTMLDivElement).style.opacity = '0.5';
    },
    [task.id, task.status],
  );

  const handleDragEnd = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    (e.target as HTMLDivElement).style.opacity = '1';
  }, []);

  const overdue = isOverdue(task.due_date, task.status);
  const commentCount = task.comments.length;

  return (
    <div
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="bg-white rounded-lg border border-surface-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-card-hover transition-shadow"
    >
      {/* Title */}
      <button
        type="button"
        onClick={() => onTaskClick(task.id)}
        className="text-sm font-semibold text-surface-900 hover:text-primary-600 transition-colors text-left w-full"
      >
        {task.title}
      </button>

      {/* Client */}
      <p className="text-sm text-surface-500 mt-1 truncate">{clientName}</p>

      {/* Bottom row: priority, due date, comments */}
      <div className="flex items-center justify-between mt-2 gap-2">
        <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]} size="sm">
          {PRIORITY_LABELS[task.priority]}
        </Badge>

        <div className="flex items-center gap-2">
          {task.due_date && (
            <span className={`flex items-center gap-1 text-xs ${overdue ? 'text-danger-600 font-medium' : 'text-surface-500'}`}>
              <Clock className="h-3 w-3" />
              {formatDueDate(task.due_date)}
            </span>
          )}
          {commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-surface-500">
              <MessageSquare className="h-3 w-3" />
              {commentCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  KanbanColumn                                                               */
/* -------------------------------------------------------------------------- */

interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  tasks: TaskResponse[];
  clientMap: Record<string, string>;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onTaskClick: (taskId: string) => void;
}

function KanbanColumn({ status, label, tasks, clientMap, onStatusChange, onTaskClick }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const styles = COLUMN_STYLES[status];

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only clear if we actually left the column (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      const taskId = e.dataTransfer.getData('text/plain');
      const sourceStatus = e.dataTransfer.getData('application/x-source-status');

      if (taskId && sourceStatus !== status) {
        onStatusChange(taskId, status);
      }
    },
    [status, onStatusChange],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col min-w-[220px] w-full rounded-lg ${styles.border} ${isDragOver ? styles.bgHover + ' border-dashed' : styles.bg} transition-colors`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <h3 className="text-sm font-semibold text-surface-700">{label}</h3>
        <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-white/70 px-1.5 text-xs font-medium text-surface-600">
          {tasks.length}
        </span>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[100px]">
        {tasks.length === 0 ? (
          <p className="text-center text-sm text-surface-400 py-8">No tasks</p>
        ) : (
          tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              clientName={clientMap[task.client_id] || 'Unknown'}
              onTaskClick={onTaskClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  KanbanBoard                                                                */
/* -------------------------------------------------------------------------- */

export default function KanbanBoard({ tasks, clientMap, onStatusChange, onTaskClick }: KanbanBoardProps) {
  // Group tasks by status
  const tasksByStatus: Record<TaskStatus, TaskResponse[]> = {
    todo: [],
    in_progress: [],
    in_review: [],
    done: [],
    blocked: [],
  };

  for (const task of tasks) {
    if (tasksByStatus[task.status]) {
      tasksByStatus[task.status].push(task);
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.status}
          status={col.status}
          label={col.label}
          tasks={tasksByStatus[col.status]}
          clientMap={clientMap}
          onStatusChange={onStatusChange}
          onTaskClick={onTaskClick}
        />
      ))}
    </div>
  );
}

export type { KanbanBoardProps, TaskStatus, TaskPriority, TaskResponse };
