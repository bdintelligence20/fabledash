import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { BarChart2, AlertTriangle, Sparkles } from 'lucide-react';
import { Card, Tabs } from '../components/ui';
import { MetricRow, RecentActivity, AlertsPanel, QuickActions } from '../components/dashboard';
import { apiClient } from '../lib/api';
import type { ProactiveAlert } from '../components/dashboard/AlertsPanel';

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface FinancialSummary {
  snapshot: {
    total_revenue: number;
    cash_on_hand: number;
    accounts_receivable: number;
    accounts_payable: number;
    [key: string]: unknown;
  } | null;
  invoice_stats: {
    total_invoiced: number;
    count: number;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

interface UtilizationData {
  utilization_pct: number;
  total_hours: number;
  billable_hours: number;
  [key: string]: unknown;
}

interface TimeLogEntry {
  id: string;
  description: string;
  date: string;
  duration_minutes: number;
  client_id?: string;
  [key: string]: unknown;
}

interface ClientEntry {
  id: string;
  name: string;
  is_active?: boolean;
  [key: string]: unknown;
}

interface AlertsApiResponse {
  alerts: ProactiveAlert[];
  summary: { total: number; high: number; medium: number };
  [key: string]: unknown;
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

  // API state
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);

  const [revenue, setRevenue] = useState<number | null>(null);
  const [cashPosition, setCashPosition] = useState<number | null>(null);
  const [activeClients, setActiveClients] = useState<number | null>(null);
  const [utilization, setUtilization] = useState<number | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const [recentLogs, setRecentLogs] = useState<
    { id: string; description: string; date: string; duration_minutes: number; client_name?: string }[]
  >([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Fetch alerts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<{ success: boolean; data: AlertsApiResponse }>('/opsai/alerts');
        if (!cancelled && res.success) {
          setAlerts(res.data.alerts || []);
        }
      } catch {
        // Alerts are non-critical — silently show empty
      } finally {
        if (!cancelled) setAlertsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch metric data (financial summary + utilization + client count)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [finRes, utilRes, clientRes] = await Promise.allSettled([
          apiClient.get<{ success: boolean; data: FinancialSummary }>('/financial-data/summary'),
          apiClient.get<{ success: boolean; data: UtilizationData }>('/time-logs/utilization'),
          apiClient.get<{ success: boolean; data: ClientEntry[] }>('/clients'),
        ]);

        if (cancelled) return;

        // Financial summary -> revenue + cash
        if (finRes.status === 'fulfilled' && finRes.value.success) {
          const snap = finRes.value.data.snapshot;
          if (snap) {
            setRevenue(snap.total_revenue ?? null);
            setCashPosition(snap.cash_on_hand ?? null);
          }
        }

        // Utilization
        if (utilRes.status === 'fulfilled' && utilRes.value.success) {
          setUtilization(utilRes.value.data.utilization_pct ?? null);
        }

        // Active clients
        if (clientRes.status === 'fulfilled' && clientRes.value.success) {
          const all = clientRes.value.data || [];
          const active = all.filter((c) => c.is_active !== false);
          setActiveClients(active.length);
        }
      } catch {
        // Best-effort — leave nulls
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch recent time logs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch recent time logs and clients for name resolution
        const [logsRes, clientRes] = await Promise.allSettled([
          apiClient.get<{ success: boolean; data: TimeLogEntry[] }>('/time-logs/'),
          apiClient.get<{ success: boolean; data: ClientEntry[] }>('/clients'),
        ]);

        if (cancelled) return;

        // Build client name map
        const clientMap = new Map<string, string>();
        if (clientRes.status === 'fulfilled' && clientRes.value.success) {
          for (const c of clientRes.value.data || []) {
            clientMap.set(c.id, c.name);
          }
        }

        if (logsRes.status === 'fulfilled' && logsRes.value.success) {
          const logs = (logsRes.value.data || []).slice(0, 5).map((tl) => ({
            id: tl.id,
            description: tl.description || '',
            date: typeof tl.date === 'string' ? tl.date : String(tl.date),
            duration_minutes: tl.duration_minutes || 0,
            client_name: tl.client_id ? clientMap.get(tl.client_id) : undefined,
          }));
          setRecentLogs(logs);
        }
      } catch {
        // Best-effort
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Alert severity breakdown
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
            revenue,
            utilization,
            activeClients,
            cashPosition,
          }}
          loading={metricsLoading}
        />
      </div>

      {/* Main content grid */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 animate-up"
        style={{ animationDelay: '200ms' }}
      >
        {/* Left column — recent activity */}
        <div className="lg:col-span-2">
          <RecentActivity timeLogs={recentLogs} loading={activityLoading} />
        </div>

        {/* Right column — alerts + OpsAI summary + quick actions */}
        <div className="lg:col-span-1 space-y-6">
          <AlertsPanel alerts={alerts} loading={alertsLoading} />

          {/* OpsAI alert summary widget */}
          {!alertsLoading && alerts.length > 0 && (
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
