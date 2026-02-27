import { Link } from 'react-router-dom';
import { Video } from 'lucide-react';
import { Card, Badge } from '../ui';

interface InternalMeeting {
  id: string;
  title: string;
  date: string;
  client_name?: string;
  source?: string;
  action_items?: string[];
  summary?: string;
}

interface RecentMeetingsProps {
  meetings: InternalMeeting[];
  loading?: boolean;
}

const sourceColors: Record<string, 'primary' | 'success' | 'warning' | 'default'> = {
  read_ai: 'primary',
  fireflies: 'success',
  manual: 'default',
};

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  return dateStr.slice(0, 10);
}

export function RecentMeetings({ meetings, loading = false }: RecentMeetingsProps) {
  const displayed = meetings.slice(0, 5);

  return (
    <Card padding="none">
      <Card.Header className="flex items-center justify-between">
        <h3 className="text-heading text-base">Recent Meetings</h3>
        <Link to="/meetings" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
          View all &rarr;
        </Link>
      </Card.Header>
      <Card.Body>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-5 w-5 rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : displayed.length === 0 ? (
          <p className="py-6 text-center text-sm text-surface-400">No recent meetings</p>
        ) : (
          <div className="space-y-0">
            {displayed.map((meeting) => (
              <Link
                key={meeting.id}
                to={`/meetings/${meeting.id}`}
                className="flex items-center gap-3 py-3 border-b border-surface-100 last:border-0 hover:bg-surface-50 -mx-4 px-4 transition-default"
              >
                <span className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 bg-secondary-50">
                  <Video className="h-4 w-4 text-secondary-600" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-700 leading-snug truncate">
                    {meeting.title || 'Untitled meeting'}
                  </p>
                  {meeting.client_name && (
                    <p className="text-xs text-surface-400 mt-0.5">{meeting.client_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {meeting.source && (
                    <Badge
                      variant={sourceColors[meeting.source] || 'default'}
                      size="sm"
                    >
                      {meeting.source === 'read_ai' ? 'Read.AI' : meeting.source === 'fireflies' ? 'Fireflies' : 'Manual'}
                    </Badge>
                  )}
                  <span className="text-xs text-surface-400">{relativeDate(meeting.date)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
