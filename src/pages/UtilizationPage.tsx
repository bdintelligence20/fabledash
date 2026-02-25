import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Input, Spinner, StatCard, Table } from '../components/ui';
import apiClient from '../lib/api';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface UtilizationMetrics {
  total_logged_hours: number;
  total_billable_hours: number;
  total_non_billable_hours: number;
  utilization_rate: number;
}

interface SaturationClient {
  client_name: string;
  total_hours: number;
  percentage_of_total: number;
  entry_count: number;
}

interface SaturationTask {
  task_name: string;
  client_name: string;
  total_hours: number;
  percentage_of_total: number;
  entry_count: number;
}

interface DailyTrend {
  date: string;
  total_hours: number;
  billable_hours: number;
}

interface UtilizationData {
  period: { from: string | null; to: string | null };
  utilization: UtilizationMetrics;
  saturation_by_client: SaturationClient[];
  saturation_by_task: SaturationTask[];
  daily_trend: DailyTrend[];
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                   */
/* -------------------------------------------------------------------------- */

type PresetKey = 'week' | 'month' | 'quarter' | 'ytd' | 'custom';

const PRESET_LABELS: Record<PresetKey, string> = {
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
  ytd: 'Year to Date',
  custom: 'Custom',
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function getMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return toISODate(monday);
}

function getFirstDayOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getFirstDayOfQuarter(): string {
  const now = new Date();
  const qMonth = Math.floor(now.getMonth() / 3) * 3;
  return `${now.getFullYear()}-${String(qMonth + 1).padStart(2, '0')}-01`;
}

function getFirstDayOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function getToday(): string {
  return toISODate(new Date());
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function presetRange(preset: PresetKey): { from: string; to: string } {
  const to = getToday();
  switch (preset) {
    case 'week':
      return { from: getMonday(), to };
    case 'month':
      return { from: getFirstDayOfMonth(), to };
    case 'quarter':
      return { from: getFirstDayOfQuarter(), to };
    case 'ytd':
      return { from: getFirstDayOfYear(), to };
    case 'custom':
      return { from: getFirstDayOfMonth(), to };
  }
}

function rateColor(rate: number): string {
  if (rate >= 75) return '#22c55e'; // success-500 green
  if (rate >= 50) return '#f59e0b'; // warning-500 amber
  return '#ef4444'; // danger-500 red
}

function rateTextClass(rate: number): string {
  if (rate >= 75) return 'text-success-600';
  if (rate >= 50) return 'text-warning-600';
  return 'text-danger-600';
}

function formatShortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return dateStr;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function UtilizationPage() {
  /* ---- Period state ---- */
  const [preset, setPreset] = useState<PresetKey>('month');
  const [dateFrom, setDateFrom] = useState(() => presetRange('month').from);
  const [dateTo, setDateTo] = useState(() => presetRange('month').to);

  /* ---- Data state ---- */
  const [data, setData] = useState<UtilizationData | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---- Fetch utilization data ---- */
  const fetchUtilization = useCallback(async (from: string, to: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('date_from', from);
      if (to) params.set('date_to', to);
      const qs = params.toString();
      const url = `/time-logs/utilization${qs ? `?${qs}` : ''}`;
      const res = await apiClient.get<{ success: boolean; data: UtilizationData }>(url);
      if (res.success) setData(res.data);
    } catch (err) {
      console.error('Failed to fetch utilization data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Initial fetch ---- */
  useEffect(() => {
    fetchUtilization(dateFrom, dateTo);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Handle preset change ---- */
  const handlePreset = (p: PresetKey) => {
    setPreset(p);
    if (p !== 'custom') {
      const range = presetRange(p);
      setDateFrom(range.from);
      setDateTo(range.to);
      fetchUtilization(range.from, range.to);
    }
  };

  /* ---- Handle custom date apply ---- */
  const handleApplyCustom = () => {
    fetchUtilization(dateFrom, dateTo);
  };

  /* ---- Daily trend limited to last 14 entries ---- */
  const trendDays = useMemo(() => {
    if (!data) return [];
    return data.daily_trend.slice(-14);
  }, [data]);

  /* ---- Max daily hours for bar scaling ---- */
  const maxDailyHours = useMemo(() => {
    if (trendDays.length === 0) return 1;
    return Math.max(...trendDays.map((d) => d.total_hours), 1);
  }, [trendDays]);

  /* ---- Has data to show ---- */
  const hasData = data && data.utilization.total_logged_hours > 0;

  /* ---- Conic gradient for gauge ---- */
  const gaugeStyle = useMemo(() => {
    if (!data) return {};
    const rate = data.utilization.utilization_rate;
    const color = rateColor(rate);
    const deg = (rate / 100) * 360;
    return {
      background: `conic-gradient(${color} ${deg}deg, #e5e7eb ${deg}deg 360deg)`,
    };
  }, [data]);

  return (
    <div>
      {/* Page header */}
      <div className="animate-up">
        <h1 className="text-2xl font-bold text-heading">Utilization Rate</h1>
        <p className="text-body mt-1">
          Billable vs total hours and saturation leaderboards.
        </p>
      </div>

      {/* Period selector */}
      <div className="mt-6 animate-up" style={{ animationDelay: '100ms' }}>
        <Card padding="md">
          <div className="flex flex-wrap items-end gap-3">
            {(Object.keys(PRESET_LABELS) as PresetKey[]).map((p) => (
              <Button
                key={p}
                variant={preset === p ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handlePreset(p)}
              >
                {PRESET_LABELS[p]}
              </Button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div className="w-44">
                <Input
                  label="From"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="w-44">
                <Input
                  label="To"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={handleApplyCustom}>
                Apply
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-10 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasData && (
        <div className="mt-10 flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium text-surface-600">
            No time entries in this period
          </p>
          <p className="mt-1 text-sm text-surface-400">
            Try selecting a different date range or log some time first.
          </p>
        </div>
      )}

      {/* Data content */}
      {!loading && hasData && data && (
        <>
          {/* Utilization Rate section */}
          <div className="mt-6 animate-up" style={{ animationDelay: '200ms' }}>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Circular gauge */}
              <Card padding="md" className="flex flex-col items-center justify-center">
                <p className="text-sm font-semibold text-surface-600 mb-4">Utilization Rate</p>
                <div
                  className="relative w-32 h-32 rounded-full flex items-center justify-center"
                  style={gaugeStyle}
                >
                  <div className="absolute w-24 h-24 rounded-full bg-white flex items-center justify-center">
                    <span className={`text-3xl font-bold ${rateTextClass(data.utilization.utilization_rate)}`}>
                      {data.utilization.utilization_rate}%
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-surface-400">Billable / Total Hours</p>
              </Card>

              {/* Stat cards */}
              <StatCard
                title="Total Logged"
                value={`${data.utilization.total_logged_hours} hrs`}
              />
              <StatCard
                title="Billable Hours"
                value={`${data.utilization.total_billable_hours} hrs`}
                icon={
                  <span className="inline-block w-3 h-3 rounded-sm bg-success-500" />
                }
              />
              <StatCard
                title="Non-Billable Hours"
                value={`${data.utilization.total_non_billable_hours} hrs`}
                icon={
                  <span className="inline-block w-3 h-3 rounded-sm bg-surface-300" />
                }
              />
            </div>
          </div>

          {/* Daily Trend section */}
          {trendDays.length > 0 && (
            <div className="mt-6 animate-up" style={{ animationDelay: '300ms' }}>
              <Card padding="md">
                <p className="text-sm font-semibold text-surface-600 mb-4">Daily Trend</p>
                <div className="space-y-2">
                  {trendDays.map((day) => {
                    const billablePct = maxDailyHours > 0
                      ? (day.billable_hours / maxDailyHours) * 100
                      : 0;
                    const nonBillablePct = maxDailyHours > 0
                      ? ((day.total_hours - day.billable_hours) / maxDailyHours) * 100
                      : 0;
                    return (
                      <div key={day.date} className="flex items-center gap-3">
                        <span className="text-xs text-surface-500 w-12 shrink-0 text-right">
                          {formatShortDate(day.date)}
                        </span>
                        <div className="flex-1 flex h-5 rounded overflow-hidden bg-surface-100">
                          {billablePct > 0 && (
                            <div
                              className="bg-primary-500 h-full transition-all"
                              style={{ width: `${billablePct}%` }}
                              title={`Billable: ${day.billable_hours} hrs`}
                            />
                          )}
                          {nonBillablePct > 0 && (
                            <div
                              className="bg-surface-300 h-full transition-all"
                              style={{ width: `${nonBillablePct}%` }}
                              title={`Non-billable: ${(day.total_hours - day.billable_hours).toFixed(1)} hrs`}
                            />
                          )}
                        </div>
                        <span className="text-xs font-medium text-surface-700 w-14 shrink-0">
                          {day.total_hours} hrs
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex gap-4 mt-4">
                  <div className="flex items-center gap-2 text-xs text-surface-600">
                    <span className="inline-block w-3 h-3 rounded-sm bg-primary-500" />
                    Billable
                  </div>
                  <div className="flex items-center gap-2 text-xs text-surface-600">
                    <span className="inline-block w-3 h-3 rounded-sm bg-surface-300" />
                    Non-billable
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Saturation Leaderboards */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-up" style={{ animationDelay: '400ms' }}>
            {/* Top 5 Clients */}
            <Card padding="none">
              <div className="px-4 py-3 border-b border-surface-200">
                <p className="text-sm font-semibold text-surface-700">Top 5 Clients by Hours</p>
              </div>
              {data.saturation_by_client.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-surface-400">
                  No client data available
                </div>
              ) : (
                <Table>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell className="w-12">#</Table.HeaderCell>
                      <Table.HeaderCell>Client</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Hours</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">% Total</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Entries</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {data.saturation_by_client.map((item, idx) => (
                      <Table.Row key={idx}>
                        <Table.Cell>
                          <Badge
                            variant={idx === 0 ? 'primary' : idx === 1 ? 'success' : idx === 2 ? 'warning' : 'default'}
                            size="sm"
                          >
                            {idx + 1}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell className="font-medium">{item.client_name}</Table.Cell>
                        <Table.Cell className="text-right">{item.total_hours}</Table.Cell>
                        <Table.Cell className="text-right">{item.percentage_of_total}%</Table.Cell>
                        <Table.Cell className="text-right">{item.entry_count}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Card>

            {/* Top 5 Tasks */}
            <Card padding="none">
              <div className="px-4 py-3 border-b border-surface-200">
                <p className="text-sm font-semibold text-surface-700">Top 5 Tasks by Hours</p>
              </div>
              {data.saturation_by_task.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-surface-400">
                  No task data available
                </div>
              ) : (
                <Table>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell className="w-12">#</Table.HeaderCell>
                      <Table.HeaderCell>Task</Table.HeaderCell>
                      <Table.HeaderCell>Client</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Hours</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">% Total</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Entries</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {data.saturation_by_task.map((item, idx) => (
                      <Table.Row key={idx}>
                        <Table.Cell>
                          <Badge
                            variant={idx === 0 ? 'primary' : idx === 1 ? 'success' : idx === 2 ? 'warning' : 'default'}
                            size="sm"
                          >
                            {idx + 1}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell className="font-medium">{item.task_name}</Table.Cell>
                        <Table.Cell className="text-sm text-surface-500">{item.client_name}</Table.Cell>
                        <Table.Cell className="text-right">{item.total_hours}</Table.Cell>
                        <Table.Cell className="text-right">{item.percentage_of_total}%</Table.Cell>
                        <Table.Cell className="text-right">{item.entry_count}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
