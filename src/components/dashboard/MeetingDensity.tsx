import { BarChart3, Calendar } from 'lucide-react';
import { Card } from '../ui';

interface DensityData {
  configured: boolean;
  total_meetings?: number;
  meetings_per_day?: number;
  total_meeting_hours?: number;
  busiest_day?: { date: string; meetings: number } | string | null;
}

interface MeetingDensityProps {
  density: DensityData | null;
  loading?: boolean;
}

function getDensityColor(mpd: number): string {
  if (mpd < 2) return 'text-success-600';
  if (mpd <= 4) return 'text-warning-600';
  return 'text-danger-600';
}

function getDensityBg(mpd: number): string {
  if (mpd < 2) return 'bg-success-50';
  if (mpd <= 4) return 'bg-warning-50';
  return 'bg-danger-50';
}

export function MeetingDensity({ density, loading = false }: MeetingDensityProps) {
  const mpd = density?.meetings_per_day ?? 0;

  return (
    <Card padding="none">
      <Card.Header>
        <h3 className="text-heading text-base">Meeting Load</h3>
      </Card.Header>
      <Card.Body>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-5 w-5 rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : !density?.configured ? (
          <div className="py-4 text-center">
            <Calendar className="h-6 w-6 text-surface-300 mx-auto mb-2" />
            <p className="text-sm text-surface-400">Calendar not connected</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`rounded-lg px-3 py-2 ${getDensityBg(mpd)}`}>
              <div className="flex items-center gap-2">
                <BarChart3 className={`h-5 w-5 ${getDensityColor(mpd)}`} />
                <span className={`text-2xl font-bold ${getDensityColor(mpd)}`}>
                  {mpd.toFixed(1)}
                </span>
                <span className="text-xs text-surface-500">meetings/day</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-surface-400">This Week</p>
                <p className="text-sm font-semibold text-surface-700">{density.total_meetings ?? 0} meetings</p>
              </div>
              <div>
                <p className="text-xs text-surface-400">Hours</p>
                <p className="text-sm font-semibold text-surface-700">
                  {density.total_meeting_hours?.toFixed(1) ?? '0'}h
                </p>
              </div>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
