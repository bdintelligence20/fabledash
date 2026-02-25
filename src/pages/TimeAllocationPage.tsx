import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Spinner, StatCard, Table } from '../components/ui';
import apiClient from '../lib/api';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface AllocationGroup {
  partner_group: string;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  entry_count: number;
  percentage: number;
}

interface AllocationData {
  period: { from: string | null; to: string | null };
  total_hours: number;
  groups: AllocationGroup[];
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

const GROUP_LABELS: Record<string, string> = {
  collab: 'Collab',
  edcp: 'EDCP',
  direct_clients: 'Direct Clients',
  separate_businesses: 'Separate Businesses',
};

const GROUP_COLORS: Record<string, string> = {
  collab: '#6571f5',      // primary-500
  edcp: '#22c55e',        // success-500
  direct_clients: '#ffb966', // accent-500
  separate_businesses: '#f59e0b', // warning-500
};

const GROUP_BG_CLASSES: Record<string, string> = {
  collab: 'bg-primary-500',
  edcp: 'bg-success-500',
  direct_clients: 'bg-accent-500',
  separate_businesses: 'bg-warning-500',
};

const GROUP_ORDER = ['collab', 'edcp', 'direct_clients', 'separate_businesses'];

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

/* -------------------------------------------------------------------------- */
/*  Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function TimeAllocationPage() {
  /* ---- Period state ---- */
  const [preset, setPreset] = useState<PresetKey>('month');
  const [dateFrom, setDateFrom] = useState(() => presetRange('month').from);
  const [dateTo, setDateTo] = useState(() => presetRange('month').to);

  /* ---- Data state ---- */
  const [data, setData] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---- Fetch allocation data ---- */
  const fetchAllocation = useCallback(async (from: string, to: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('date_from', from);
      if (to) params.set('date_to', to);
      const qs = params.toString();
      const url = `/time-logs/allocation${qs ? `?${qs}` : ''}`;
      const res = await apiClient.get<{ success: boolean; data: AllocationData }>(url);
      if (res.success) setData(res.data);
    } catch (err) {
      console.error('Failed to fetch time allocation', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Initial fetch ---- */
  useEffect(() => {
    fetchAllocation(dateFrom, dateTo);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Handle preset change ---- */
  const handlePreset = (p: PresetKey) => {
    setPreset(p);
    if (p !== 'custom') {
      const range = presetRange(p);
      setDateFrom(range.from);
      setDateTo(range.to);
      fetchAllocation(range.from, range.to);
    }
  };

  /* ---- Handle custom date apply ---- */
  const handleApplyCustom = () => {
    fetchAllocation(dateFrom, dateTo);
  };

  /* ---- Sorted groups (by total hours descending) for table ---- */
  const sortedGroups = useMemo(() => {
    if (!data) return [];
    return [...data.groups].sort((a, b) => b.total_hours - a.total_hours);
  }, [data]);

  /* ---- Grand totals for footer ---- */
  const totals = useMemo(() => {
    if (!data) return { totalHours: 0, billableHours: 0, nonBillableHours: 0, entries: 0 };
    return {
      totalHours: data.total_hours,
      billableHours: data.groups.reduce((s, g) => s + g.billable_hours, 0),
      nonBillableHours: data.groups.reduce((s, g) => s + g.non_billable_hours, 0),
      entries: data.groups.reduce((s, g) => s + g.entry_count, 0),
    };
  }, [data]);

  /* ---- Build groups lookup for stat cards (keep GROUP_ORDER) ---- */
  const groupMap = useMemo(() => {
    const m = new Map<string, AllocationGroup>();
    if (data) {
      for (const g of data.groups) m.set(g.partner_group, g);
    }
    return m;
  }, [data]);

  /* ---- Has data to show ---- */
  const hasData = data && data.total_hours > 0;

  return (
    <div>
      {/* Page header */}
      <div className="animate-up">
        <h1 className="text-2xl font-bold text-heading">Time Allocation</h1>
        <p className="text-body mt-1">
          See how time is distributed across partner groups.
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
            Try selecting a different date range.
          </p>
        </div>
      )}

      {/* Data content */}
      {!loading && hasData && (
        <>
          {/* Horizontal stacked bar */}
          <div className="mt-6 animate-up" style={{ animationDelay: '200ms' }}>
            <Card padding="md">
              <p className="text-sm font-semibold text-surface-600 mb-3">Distribution</p>
              <div className="flex w-full h-10 rounded-lg overflow-hidden">
                {GROUP_ORDER.map((g) => {
                  const group = groupMap.get(g);
                  if (!group || group.percentage === 0) return null;
                  return (
                    <div
                      key={g}
                      className="flex items-center justify-center text-xs font-medium text-white transition-all"
                      style={{
                        width: `${group.percentage}%`,
                        backgroundColor: GROUP_COLORS[g],
                        minWidth: group.percentage > 0 ? '2rem' : 0,
                      }}
                      title={`${GROUP_LABELS[g]}: ${group.percentage}%`}
                    >
                      {group.percentage >= 10
                        ? `${GROUP_LABELS[g]} ${group.percentage}%`
                        : group.percentage >= 5
                          ? `${group.percentage}%`
                          : ''}
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-3">
                {GROUP_ORDER.map((g) => (
                  <div key={g} className="flex items-center gap-2 text-sm text-surface-600">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ backgroundColor: GROUP_COLORS[g] }}
                    />
                    {GROUP_LABELS[g]}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Stat cards */}
          <div
            className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-up"
            style={{ animationDelay: '300ms' }}
          >
            {GROUP_ORDER.map((g) => {
              const group = groupMap.get(g);
              if (!group) return null;
              return (
                <StatCard
                  key={g}
                  title={GROUP_LABELS[g]}
                  value={`${group.total_hours} hrs`}
                  icon={
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ backgroundColor: GROUP_COLORS[g] }}
                    />
                  }
                  className=""
                />
              );
            })}
          </div>

          {/* Sub-info below cards */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 -mt-1 animate-up"
            style={{ animationDelay: '300ms' }}
          >
            {GROUP_ORDER.map((g) => {
              const group = groupMap.get(g);
              if (!group) return null;
              return (
                <div key={g} className="px-6 pb-4 text-xs text-surface-500">
                  {group.billable_hours} billable / {group.non_billable_hours} non-billable hrs
                  <span className="ml-2 text-surface-400">{group.entry_count} entries</span>
                </div>
              );
            })}
          </div>

          {/* Breakdown table */}
          <div className="mt-6 animate-up" style={{ animationDelay: '400ms' }}>
            <Card padding="none">
              <Table>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>Partner Group</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Total Hours</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Billable Hours</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Non-billable Hours</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Entries</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">% of Total</Table.HeaderCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {sortedGroups.map((g) => (
                    <Table.Row key={g.partner_group}>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-3 h-3 rounded-sm"
                            style={{ backgroundColor: GROUP_COLORS[g.partner_group] }}
                          />
                          {GROUP_LABELS[g.partner_group] || g.partner_group}
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-right font-medium">{g.total_hours}</Table.Cell>
                      <Table.Cell className="text-right">{g.billable_hours}</Table.Cell>
                      <Table.Cell className="text-right">{g.non_billable_hours}</Table.Cell>
                      <Table.Cell className="text-right">{g.entry_count}</Table.Cell>
                      <Table.Cell className="text-right font-medium">{g.percentage}%</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
                {/* Footer totals */}
                <tfoot className="bg-surface-50 border-t border-surface-200">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-surface-900 text-sm">Total</td>
                    <td className="px-4 py-3 text-right font-semibold text-surface-900 text-sm">
                      {totals.totalHours}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-surface-700">
                      {totals.billableHours.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-surface-700">
                      {totals.nonBillableHours.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-surface-700">
                      {totals.entries}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-surface-900 text-sm">
                      100%
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
