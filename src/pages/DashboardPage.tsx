import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { BarChart2 } from 'lucide-react';
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

  return (
    <div>
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

        {/* Right column — alerts + quick actions */}
        <div className="lg:col-span-1 space-y-6">
          <AlertsPanel alerts={alerts} loading={alertsLoading} />
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
