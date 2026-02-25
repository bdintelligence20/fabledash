import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui';

/* -------------------------------------------------------------------------- */
/*  Types (matching TasksPage / KanbanBoard definitions)                       */
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

interface CalendarViewProps {
  tasks: TaskResponse[];
  clientMap: Record<string, string>;
  onTaskClick: (taskId: string) => void;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_PILL_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-surface-300 text-surface-800',
  in_progress: 'bg-primary-200 text-primary-800',
  in_review: 'bg-warning-200 text-warning-800',
  done: 'bg-success-200 text-success-800',
  blocked: 'bg-danger-200 text-danger-800',
};

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-surface-400',
  in_progress: 'bg-primary-500',
  in_review: 'bg-warning-500',
  done: 'bg-success-500',
  blocked: 'bg-danger-500',
};

const MAX_VISIBLE_TASKS = 3;

/* -------------------------------------------------------------------------- */
/*  Calendar helpers                                                           */
/* -------------------------------------------------------------------------- */

/** Get the first day of the month */
function getFirstOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

/** Get total days in a month */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Get the day-of-week index (0 = Monday, 6 = Sunday) for a Date */
function getMondayBasedDay(date: Date): number {
  const day = date.getDay(); // 0 = Sunday
  return day === 0 ? 6 : day - 1;
}

/** Build 6-row x 7-col calendar grid for a given month */
function buildCalendarGrid(year: number, month: number): Array<{ date: Date; inMonth: boolean }> {
  const firstDay = getFirstOfMonth(year, month);
  const startOffset = getMondayBasedDay(firstDay);
  const daysInMonth = getDaysInMonth(year, month);

  const cells: Array<{ date: Date; inMonth: boolean }> = [];

  // Days from previous month
  const prevMonthDays = getDaysInMonth(year, month - 1);
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      inMonth: false,
    });
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: new Date(year, month, d),
      inMonth: true,
    });
  }

  // Fill remaining cells to complete 6 rows (42 cells)
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({
      date: new Date(year, month + 1, d),
      inMonth: false,
    });
  }

  return cells;
}

/** Format a date as YYYY-MM-DD for lookup key */
function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Check if two dates are the same day */
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function CalendarView({ tasks, clientMap: _clientMap, onTaskClick }: CalendarViewProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 0) {
        setCurrentYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 11) {
        setCurrentYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  }, []);

  // Build calendar grid
  const grid = useMemo(() => buildCalendarGrid(currentYear, currentMonth), [currentYear, currentMonth]);

  // Index tasks by due date key
  const tasksByDate = useMemo(() => {
    const map: Record<string, TaskResponse[]> = {};
    for (const task of tasks) {
      if (!task.due_date) continue;
      // Parse the due_date and build a key from its local date parts
      const d = new Date(task.due_date);
      const key = dateKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }
    return map;
  }, [tasks]);

  return (
    <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
      {/* Calendar header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={goToPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <h2 className="text-lg font-semibold text-surface-900">
          {MONTH_NAMES[currentMonth]} {currentYear}
        </h2>
        <div className="w-[120px]" /> {/* Spacer for balance */}
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-surface-200">
        {DAY_NAMES.map((name) => (
          <div key={name} className="px-2 py-2 text-center text-xs font-medium text-surface-500 uppercase tracking-wider">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid: 6 rows of 7 */}
      <div className="grid grid-cols-7">
        {grid.map((cell, idx) => {
          const key = dateKey(cell.date);
          const dayTasks = tasksByDate[key] || [];
          const isToday = isSameDay(cell.date, today);
          const visibleTasks = dayTasks.slice(0, MAX_VISIBLE_TASKS);
          const overflowCount = dayTasks.length - MAX_VISIBLE_TASKS;

          return (
            <div
              key={idx}
              className={`min-h-[100px] border-b border-r border-surface-100 p-1.5 ${
                cell.inMonth ? 'bg-white' : 'bg-surface-50'
              }`}
            >
              {/* Day number */}
              <div className="flex justify-end mb-1">
                <span
                  className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium ${
                    isToday
                      ? 'bg-primary-600 text-white'
                      : cell.inMonth
                        ? 'text-surface-900'
                        : 'text-surface-400'
                  }`}
                >
                  {cell.date.getDate()}
                </span>
              </div>

              {/* Task pills - desktop */}
              <div className="hidden md:block space-y-0.5">
                {visibleTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onTaskClick(task.id)}
                    className={`block w-full text-left rounded px-1.5 py-0.5 text-xs truncate ${STATUS_PILL_COLORS[task.status]} hover:opacity-80 transition-opacity`}
                    title={task.title}
                  >
                    {task.title}
                  </button>
                ))}
                {overflowCount > 0 && (
                  <p className="text-xs text-surface-500 px-1.5">+{overflowCount} more</p>
                )}
              </div>

              {/* Task dots - mobile */}
              <div className="flex flex-wrap gap-0.5 md:hidden">
                {dayTasks.map((task) => (
                  <span
                    key={task.id}
                    className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[task.status]}`}
                    title={task.title}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { CalendarViewProps };
