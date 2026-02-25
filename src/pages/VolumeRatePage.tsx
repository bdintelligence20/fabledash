import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Input, Spinner, Table } from '../components/ui';
import apiClient from '../lib/api';
import { colors, currency } from '../styles/tokens';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface VolumeRateClient {
  client_id: string;
  client_name: string;
  total_hours: number;
  zar_per_hour: number;
  total_revenue: number;
  classification: Classification;
}

type Classification =
  | 'high_volume_high_rate'
  | 'high_volume_low_rate'
  | 'low_volume_high_rate'
  | 'low_volume_low_rate';

interface VolumeRateData {
  clients: VolumeRateClient[];
  medians: { hours: number; zar_per_hour: number };
  quadrant_counts: Record<Classification, number>;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                   */
/* -------------------------------------------------------------------------- */

type PresetKey = 'month' | 'quarter' | 'ytd' | 'custom';

const PRESET_LABELS: Record<PresetKey, string> = {
  month: 'This Month',
  quarter: 'This Quarter',
  ytd: 'Year to Date',
  custom: 'Custom',
};

const QUADRANT_META: Record<
  Classification,
  { label: string; color: string; borderColor: string; badgeVariant: 'success' | 'danger' | 'primary' | 'warning' }
> = {
  high_volume_high_rate: {
    label: 'Stars',
    color: colors.success[500],
    borderColor: colors.success[300],
    badgeVariant: 'success',
  },
  high_volume_low_rate: {
    label: 'Compression Risk',
    color: colors.danger[500],
    borderColor: colors.danger[300],
    badgeVariant: 'danger',
  },
  low_volume_high_rate: {
    label: 'Efficient',
    color: colors.primary[500],
    borderColor: colors.primary[300],
    badgeVariant: 'primary',
  },
  low_volume_low_rate: {
    label: 'Review Needed',
    color: colors.warning[500],
    borderColor: colors.warning[300],
    badgeVariant: 'warning',
  },
};

const QUADRANT_ORDER: Classification[] = [
  'high_volume_high_rate',
  'high_volume_low_rate',
  'low_volume_high_rate',
  'low_volume_low_rate',
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

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

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getToday(): string {
  return toISODate(new Date());
}

function presetRange(preset: PresetKey): { from: string; to: string } {
  const to = getToday();
  switch (preset) {
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

export default function VolumeRatePage() {
  /* ---- Period state ---- */
  const [preset, setPreset] = useState<PresetKey>('quarter');
  const [dateFrom, setDateFrom] = useState(() => presetRange('quarter').from);
  const [dateTo, setDateTo] = useState(() => presetRange('quarter').to);

  /* ---- Data state ---- */
  const [data, setData] = useState<VolumeRateData | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---- Fetch volume-rate data ---- */
  const fetchVolumeRate = useCallback(async (from: string, to: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('date_from', from);
      if (to) params.set('date_to', to);
      const qs = params.toString();
      const url = `/financial-data/volume-rate${qs ? `?${qs}` : ''}`;
      const res = await apiClient.get<{ success: boolean; data: VolumeRateData }>(url);
      if (res.success) setData(res.data);
    } catch (err) {
      console.error('Failed to fetch volume-rate data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Initial fetch ---- */
  useEffect(() => {
    fetchVolumeRate(dateFrom, dateTo);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Handle preset change ---- */
  const handlePreset = (p: PresetKey) => {
    setPreset(p);
    if (p !== 'custom') {
      const range = presetRange(p);
      setDateFrom(range.from);
      setDateTo(range.to);
      fetchVolumeRate(range.from, range.to);
    }
  };

  /* ---- Handle custom date apply ---- */
  const handleApplyCustom = () => {
    fetchVolumeRate(dateFrom, dateTo);
  };

  /* ---- Clients grouped by quadrant ---- */
  const clientsByQuadrant = useMemo(() => {
    if (!data) return {} as Record<Classification, VolumeRateClient[]>;
    const groups: Record<Classification, VolumeRateClient[]> = {
      high_volume_high_rate: [],
      high_volume_low_rate: [],
      low_volume_high_rate: [],
      low_volume_low_rate: [],
    };
    for (const c of data.clients) {
      groups[c.classification].push(c);
    }
    return groups;
  }, [data]);

  /* ---- Scatter plot positioning helpers ---- */
  const scatterBounds = useMemo(() => {
    if (!data || data.clients.length === 0) return { maxHours: 1, maxRate: 1 };
    const maxHours = Math.max(...data.clients.map((c) => c.total_hours));
    const maxRate = Math.max(...data.clients.map((c) => c.zar_per_hour));
    return {
      maxHours: maxHours * 1.15 || 1,
      maxRate: maxRate * 1.15 || 1,
    };
  }, [data]);

  const maxRevenue = useMemo(() => {
    if (!data || data.clients.length === 0) return 1;
    return Math.max(...data.clients.map((c) => c.total_revenue)) || 1;
  }, [data]);

  /* ---- Has data to show ---- */
  const hasData = data && data.clients.length > 0;

  return (
    <div>
      {/* Page header */}
      <div className="animate-up">
        <h1 className="text-2xl font-bold text-heading">Volume vs Rate Analysis</h1>
        <p className="text-body mt-1">
          Evaluate client profitability by comparing hours worked against ZAR per hour.
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
            No volume-rate data for this period
          </p>
          <p className="mt-1 text-sm text-surface-400">
            Try selecting a different date range or ensure there are invoices and time logs.
          </p>
        </div>
      )}

      {/* Data content */}
      {!loading && hasData && data && (
        <>
          {/* Quadrant summary cards — 2x2 grid */}
          <div
            className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-up"
            style={{ animationDelay: '200ms' }}
          >
            {QUADRANT_ORDER.map((q) => {
              const meta = QUADRANT_META[q];
              const clients = clientsByQuadrant[q] ?? [];
              return (
                <Card key={q} padding="md">
                  <div
                    className="rounded-lg border-l-4 pl-4 py-2"
                    style={{ borderColor: meta.borderColor }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-surface-700">
                        {meta.label}
                      </p>
                      <Badge variant={meta.badgeVariant} size="sm">
                        {data.quadrant_counts[q]}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {clients.length > 0 ? (
                        clients.map((c) => (
                          <span
                            key={c.client_id}
                            className="inline-block rounded-md px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: meta.borderColor + '30',
                              color: meta.color,
                            }}
                          >
                            {c.client_name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-surface-400">None</span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Scatter Plot */}
          <div className="mt-6 animate-up" style={{ animationDelay: '300ms' }}>
            <Card padding="md">
              <p className="text-sm font-semibold text-surface-600 mb-4">
                Client Quadrant Map
              </p>
              <div className="relative w-full" style={{ height: '380px' }}>
                {/* Quadrant background labels */}
                <span
                  className="absolute text-xs font-medium pointer-events-none"
                  style={{
                    top: '8px',
                    right: '8px',
                    color: colors.success[400],
                    opacity: 0.7,
                  }}
                >
                  Stars
                </span>
                <span
                  className="absolute text-xs font-medium pointer-events-none"
                  style={{
                    top: '8px',
                    left: '8px',
                    color: colors.primary[400],
                    opacity: 0.7,
                  }}
                >
                  Efficient
                </span>
                <span
                  className="absolute text-xs font-medium pointer-events-none"
                  style={{
                    bottom: '24px',
                    right: '8px',
                    color: colors.danger[400],
                    opacity: 0.7,
                  }}
                >
                  Compression Risk
                </span>
                <span
                  className="absolute text-xs font-medium pointer-events-none"
                  style={{
                    bottom: '24px',
                    left: '8px',
                    color: colors.warning[400],
                    opacity: 0.7,
                  }}
                >
                  Review Needed
                </span>

                {/* Median lines */}
                {/* Vertical line — median hours */}
                <div
                  className="absolute top-0 bottom-5"
                  style={{
                    left: `${(data.medians.hours / scatterBounds.maxHours) * 100}%`,
                    width: '1px',
                    borderLeft: `2px dashed ${colors.surface[300]}`,
                  }}
                />
                {/* Horizontal line — median rate */}
                <div
                  className="absolute left-0 right-0"
                  style={{
                    bottom: `${20 + (data.medians.zar_per_hour / scatterBounds.maxRate) * 80}%`,
                    height: '1px',
                    borderTop: `2px dashed ${colors.surface[300]}`,
                  }}
                />

                {/* Client dots */}
                {data.clients.map((client) => {
                  const meta = QUADRANT_META[client.classification];
                  const leftPct = (client.total_hours / scatterBounds.maxHours) * 100;
                  const bottomPct =
                    20 + (client.zar_per_hour / scatterBounds.maxRate) * 80;
                  const minSize = 12;
                  const maxSize = 40;
                  const size =
                    minSize +
                    (client.total_revenue / maxRevenue) * (maxSize - minSize);

                  return (
                    <div
                      key={client.client_id}
                      className="absolute rounded-full cursor-pointer transition-transform hover:scale-125"
                      style={{
                        left: `${leftPct}%`,
                        bottom: `${bottomPct}%`,
                        width: `${size}px`,
                        height: `${size}px`,
                        backgroundColor: meta.color,
                        opacity: 0.85,
                        transform: 'translate(-50%, 50%)',
                        zIndex: 10,
                      }}
                      title={`${client.client_name}\nHours: ${client.total_hours}\nZAR/Hr: ${currency.format(client.zar_per_hour)}\nRevenue: ${currency.format(client.total_revenue)}`}
                    />
                  );
                })}

                {/* X-axis label */}
                <div className="absolute bottom-0 left-0 right-0 text-center">
                  <span className="text-xs text-surface-500">
                    Hours (Volume) →
                  </span>
                </div>
                {/* Y-axis label */}
                <div
                  className="absolute top-1/2 -left-2"
                  style={{
                    transform: 'rotate(-90deg) translateX(-50%)',
                    transformOrigin: 'left center',
                  }}
                >
                  <span className="text-xs text-surface-500 whitespace-nowrap">
                    ZAR/Hr (Rate) →
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-surface-200">
                {QUADRANT_ORDER.map((q) => {
                  const meta = QUADRANT_META[q];
                  return (
                    <div key={q} className="flex items-center gap-2 text-xs text-surface-600">
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      {meta.label}
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 text-xs text-surface-400 ml-auto">
                  Dot size = revenue
                </div>
              </div>
            </Card>
          </div>

          {/* Client Detail Table */}
          <div className="mt-6 animate-up" style={{ animationDelay: '400ms' }}>
            <Card padding="none">
              <div className="px-4 py-3 border-b border-surface-200">
                <p className="text-sm font-semibold text-surface-700">
                  Client Detail
                </p>
              </div>
              <Table>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>Client</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Hours</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">ZAR/Hr</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Revenue</Table.HeaderCell>
                    <Table.HeaderCell>Classification</Table.HeaderCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {data.clients.map((client) => {
                    const meta = QUADRANT_META[client.classification];
                    return (
                      <Table.Row key={client.client_id}>
                        <Table.Cell className="font-medium">
                          {client.client_name}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {client.total_hours}
                        </Table.Cell>
                        <Table.Cell className="text-right font-medium">
                          {currency.format(client.zar_per_hour)}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {currency.format(client.total_revenue)}
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant={meta.badgeVariant} size="sm" dot>
                            {meta.label}
                          </Badge>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
                {/* Footer — medians */}
                <tfoot className="bg-surface-50 border-t border-surface-200">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-surface-900 text-sm">
                      Median
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-surface-900 text-sm">
                      {data.medians.hours} hrs
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-surface-900 text-sm">
                      {currency.format(data.medians.zar_per_hour)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-surface-500" colSpan={2}>
                      {data.clients.length} clients
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
