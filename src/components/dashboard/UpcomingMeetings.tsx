import { Calendar, Users } from 'lucide-react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { Card, Badge } from '../ui';

interface CalendarMeeting {
  id?: string;
  summary: string;
  start: string;
  end: string;
  status?: string;
  attendee_count?: number;
}

interface UpcomingMeetingsProps {
  meetings: CalendarMeeting[];
  loading?: boolean;
  configured?: boolean;
}

function formatMeetingTime(isoStr: string): string {
  try {
    const dt = parseISO(isoStr);
    const prefix = isToday(dt) ? 'Today' : isTomorrow(dt) ? 'Tomorrow' : format(dt, 'EEE');
    return `${prefix} ${format(dt, 'h:mm a')}`;
  } catch {
    return isoStr;
  }
}

export function UpcomingMeetings({ meetings, loading = false, configured = true }: UpcomingMeetingsProps) {
  const displayed = meetings.slice(0, 5);

  return (
    <Card padding="none">
      <Card.Header className="flex items-center justify-between">
        <h3 className="text-heading text-base">Upcoming Meetings</h3>
        {!loading && meetings.length > 0 && (
          <Badge variant="primary" dot>{meetings.length}</Badge>
        )}
      </Card.Header>
      <Card.Body>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-5 w-5 rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : !configured ? (
          <p className="py-6 text-center text-sm text-surface-400">
            Calendar not connected
          </p>
        ) : displayed.length === 0 ? (
          <p className="py-6 text-center text-sm text-surface-400">No upcoming meetings</p>
        ) : (
          <div className="space-y-0">
            {displayed.map((meeting, idx) => (
              <div
                key={meeting.id || idx}
                className="flex items-center gap-3 py-3 border-b border-surface-100 last:border-0"
              >
                <span className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 bg-primary-50">
                  <Calendar className="h-4 w-4 text-primary-600" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-700 leading-snug truncate">
                    {meeting.summary || 'Untitled meeting'}
                  </p>
                  <p className="text-xs text-surface-400 mt-0.5">
                    {formatMeetingTime(meeting.start)}
                  </p>
                </div>
                {meeting.attendee_count != null && meeting.attendee_count > 0 && (
                  <div className="flex items-center gap-1 text-xs text-surface-400 flex-shrink-0">
                    <Users className="h-3 w-3" />
                    {meeting.attendee_count}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
