import { Clock } from 'lucide-react';
import { Card } from '../ui';

interface TimeLogEntry {
  id: string;
  description: string;
  date: string;
  duration_minutes: number;
  client_id?: string;
  client_name?: string;
}

interface RecentActivityProps {
  timeLogs: TimeLogEntry[];
  loading?: boolean;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return dateStr;
}

export function RecentActivity({ timeLogs, loading = false }: RecentActivityProps) {
  return (
    <Card padding="none">
      <Card.Header className="flex items-center justify-between">
        <h3 className="text-heading text-base">Recent Activity</h3>
        <span className="text-sm text-surface-400">Time logs</span>
      </Card.Header>
      <Card.Body>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-5 w-5 rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : timeLogs.length === 0 ? (
          <p className="py-6 text-center text-sm text-surface-400">No recent time logs</p>
        ) : (
          <div className="space-y-0">
            {timeLogs.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 py-3 border-b border-surface-100 last:border-0"
              >
                <span className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 bg-accent-50">
                  <Clock className="h-4 w-4 text-accent-600" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-700 leading-snug truncate">
                    {item.description || 'Time logged'}
                    {item.client_name && (
                      <span className="text-surface-400"> — {item.client_name}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs font-medium text-surface-600">
                    {formatDuration(item.duration_minutes)}
                  </span>
                  <span className="text-xs text-surface-400">
                    {relativeDate(item.date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
