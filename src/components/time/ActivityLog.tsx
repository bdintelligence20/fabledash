import { Badge, Spinner } from '../ui';

export interface TimeLogEntry {
  id: string;
  date: string;
  client_id: string;
  task_id: string | null;
  description: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  is_billable: boolean;
}

interface ActivityLogProps {
  entries: TimeLogEntry[];
  clients: Map<string, string>;
  tasks: Map<string, string>;
  loading: boolean;
}

function formatTimeRange(start: string, end: string): string {
  // start/end come as "HH:MM:SS" or "HH:MM" from API
  const fmt = (t: string) => t.slice(0, 5);
  return `${fmt(start)} \u2013 ${fmt(end)}`;
}

function formatDurationMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatTodayHeader(): string {
  const now = new Date();
  return now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function totalHours(entries: TimeLogEntry[]): string {
  const total = entries.reduce((sum, e) => sum + e.duration_minutes, 0);
  return formatDurationMinutes(total);
}

export function ActivityLog({ entries, clients, tasks, loading }: ActivityLogProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  // Sort entries by start_time ascending (chronological)
  const sorted = [...entries].sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div>
      {/* Day header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-surface-700">
          Today &mdash; {formatTodayHeader()}
        </h3>
        {sorted.length > 0 && (
          <Badge variant="primary" size="sm">
            {totalHours(sorted)}
          </Badge>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-surface-400 py-8 text-center">
          No activity logged today. Start the timer or add a manual entry.
        </p>
      ) : (
        <div className="relative pl-6">
          {/* Vertical timeline line */}
          <div className="absolute left-2 top-1 bottom-1 w-px bg-surface-200" />

          <div className="space-y-4">
            {sorted.map((entry) => (
              <div key={entry.id} className="relative">
                {/* Timeline dot */}
                <span className="absolute -left-[17px] top-2 h-2 w-2 rounded-full bg-primary-400 ring-2 ring-white" />

                <div className="rounded-lg border border-surface-100 bg-white p-3">
                  {/* Time range + duration */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-surface-500">
                      {formatTimeRange(entry.start_time, entry.end_time)}
                    </span>
                    <Badge variant="default" size="sm">
                      {formatDurationMinutes(entry.duration_minutes)}
                    </Badge>
                  </div>

                  {/* Client name */}
                  <p className="text-sm font-medium text-surface-800">
                    {clients.get(entry.client_id) || 'Unknown client'}
                    {entry.task_id && tasks.get(entry.task_id) && (
                      <span className="text-surface-400"> / {tasks.get(entry.task_id)}</span>
                    )}
                  </p>

                  {/* Description */}
                  {entry.description && (
                    <p className="text-sm text-surface-500 mt-0.5">{entry.description}</p>
                  )}

                  {/* Billable badge */}
                  <div className="mt-2">
                    {entry.is_billable ? (
                      <Badge variant="success" size="sm">Billable</Badge>
                    ) : (
                      <Badge variant="default" size="sm">Non-billable</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
