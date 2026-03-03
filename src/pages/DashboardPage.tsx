import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { BarChart2, AlertTriangle, Sparkles } from 'lucide-react';
import { Card, Tabs } from '../components/ui';
import {
  MetricRow,
  RecentActivity,
  AlertsPanel,
  QuickActions,
  UpcomingMeetings,
  EmailSummary,
  MeetingDensity,
  RecentMeetings,
} from '../components/dashboard';
import { apiClient } from '../lib/api';
import type { ProactiveAlert } from '../components/dashboard/AlertsPanel';

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface DashboardMetrics {
  revenue: number | null;
  cash_position: number | null;
  accounts_receivable: number | null;
  accounts_payable: number | null;
  utilization_pct: number | null;
  total_hours: number | null;
  billable_hours: number | null;
  active_clients: number | null;
}

interface CalendarMeeting {
  id?: string;
  summary: string;
  start: string;
  end: string;
  status?: string;
  attendee_count?: number;
}

interface RecentEmail {
  id?: string;
  subject: string;
  date: string;
  direction: 'sent' | 'received';
  from_addr?: string;
  to_addr?: string;
  snippet?: string;
}

interface EmailStatsData {
  configured: boolean;
  sent_count?: number;
  received_count?: number;
  total_count?: number;
  top_correspondents?: { email: string; count: number }[];
  recent_emails?: RecentEmail[];
}

interface MeetingDensityData {
  configured: boolean;
  total_meetings?: number;
  meetings_per_day?: number;
  total_meeting_hours?: number;
  busiest_day?: { date: string; meetings: number } | string | null;
}

interface InternalMeeting {
  id: string;
  title: string;
  date: string;
  client_name?: string;
  source?: string;
  action_items?: string[];
  summary?: string;
}

interface AlertsData {
  alerts: ProactiveAlert[];
  summary: { total: number; high: number; medium: number; low: number };
}

interface CalendarMeetingsData {
  configured: boolean;
  meetings: CalendarMeeting[];
  count: number;
}

interface DashboardSummary {
  metrics: DashboardMetrics;
  recent_logs: {
    id: string;
    description: string;
    date: string;
    duration_minutes: number;
    client_name?: string;
  }[];
  calendar_meetings: CalendarMeetingsData;
  email_stats: EmailStatsData;
  meeting_density: MeetingDensityData;
  internal_meetings: InternalMeeting[];
  alerts: AlertsData;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const revenueTabs = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'ytd', label: 'YTD' },
];

export default function DashboardPage() {
  const [activeRevenueTab, setActiveRevenueTab] = useState('monthly');
  const today = format(new Date(), 'EEEE, d MMM yyyy');

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<{ success: boolean; data: DashboardSummary }>('/dashboard/summary');
        if (!cancelled && res.success) {
          setSummary(res.data);
        }
      } catch {
        // Best-effort — leave nulls
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const metrics = summary?.metrics ?? null;
  const alerts = summary?.alerts?.alerts ?? [];
  const highAlerts = alerts.filter((a) => a.severity === 'high');
  const mediumAlerts = alerts.filter((a) => a.severity === 'medium');
  const lowAlerts = alerts.filter((a) => a.severity === 'low');

  return (
    <div>
      {/* High-severity alert banner */}
      {highAlerts.length > 0 && (
        <div className="mb-4 animate-up flex items-center gap-3 rounded-lg bg-danger-50 border border-danger-200 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-danger-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-danger-800">
              {highAlerts.length} high-severity alert{highAlerts.length !== 1 ? 's' : ''} require attention
            </p>
            <p className="text-xs text-danger-600 mt-0.5">
              {highAlerts[0].message}
              {highAlerts.length > 1 && ` (+${highAlerts.length - 1} more)`}
            </p>
          </div>
          <Link
            to="/opsai"
            className="flex items-center gap-1.5 text-xs font-medium text-danger-700 hover:text-danger-900 bg-danger-100 hover:bg-danger-200 px-3 py-1.5 rounded-md transition-default flex-shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ask OpsAI
          </Link>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-start justify-between animate-up">
        <div>
          <h1 className="text-2xl font-bold text-heading">Dashboard</h1>
          <p className="text-body mt-1">
            Welcome back. Here's your business at a glance.
          </p>
        </div>
        <p className="text-sm text-surface-500 hidden sm:block">{today}</p>
      </div>

      {/* Metric row */}
      <div className="mt-6 animate-up" style={{ animationDelay: '100ms' }}>
        <MetricRow
          data={{
            revenue: metrics?.revenue ?? null,
            utilization: metrics?.utilization_pct ?? null,
            activeClients: metrics?.active_clients ?? null,
            cashPosition: metrics?.cash_position ?? null,
          }}
          loading={loading}
        />
      </div>

      {/* Main content grid */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 animate-up"
        style={{ animationDelay: '200ms' }}
      >
        {/* Left column — upcoming meetings + recent activity */}
        <div className="lg:col-span-2 space-y-6">
          <UpcomingMeetings
            meetings={summary?.calendar_meetings?.meetings ?? []}
            loading={loading}
            configured={summary?.calendar_meetings?.configured !== false}
          />
          <RecentActivity timeLogs={summary?.recent_logs ?? []} loading={loading} />
        </div>

        {/* Right column — density + email + alerts + OpsAI + quick actions */}
        <div className="lg:col-span-1 space-y-6">
          <MeetingDensity density={summary?.meeting_density ?? null} loading={loading} />
          <EmailSummary stats={summary?.email_stats ?? null} loading={loading} />
          <AlertsPanel alerts={alerts} loading={loading} />

          {/* OpsAI alert summary widget */}
          {!loading && alerts.length > 0 && (
            <Card padding="none">
              <Card.Body>
                <Link
                  to="/opsai"
                  className="flex items-center gap-3 group"
                >
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-accent-100 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-accent-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-800 group-hover:text-accent-700 transition-default">
                      OpsAI Insights
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {highAlerts.length > 0 && (
                        <span className="text-xs text-danger-600 font-medium">{highAlerts.length} high</span>
                      )}
                      {mediumAlerts.length > 0 && (
                        <span className="text-xs text-warning-600 font-medium">{mediumAlerts.length} med</span>
                      )}
                      {lowAlerts.length > 0 && (
                        <span className="text-xs text-primary-600 font-medium">{lowAlerts.length} low</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-accent-600 font-medium group-hover:text-accent-800 transition-default">
                    Analyze &rarr;
                  </span>
                </Link>
              </Card.Body>
            </Card>
          )}

          <QuickActions />
        </div>
      </div>

      {/* Recent meetings (full width) */}
      {(loading || (summary?.internal_meetings ?? []).length > 0) && (
        <div className="mt-6 animate-up" style={{ animationDelay: '250ms' }}>
          <RecentMeetings meetings={summary?.internal_meetings ?? []} loading={loading} />
        </div>
      )}

      {/* Bottom section — revenue chart placeholder */}
      <div className="mt-6 animate-up" style={{ animationDelay: '300ms' }}>
        <Card padding="none">
          <Card.Header className="flex items-center justify-between">
            <h3 className="text-heading text-base">Revenue Overview</h3>
            <Tabs
              tabs={revenueTabs}
              activeTab={activeRevenueTab}
              onChange={setActiveRevenueTab}
              variant="pills"
            />
          </Card.Header>
          <Card.Body className="flex flex-col items-center justify-center min-h-[300px]">
            <BarChart2 className="h-16 w-16 text-surface-300" />
            <p className="mt-4 text-surface-400 text-sm">
              Chart visualization coming in Phase 7
            </p>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
