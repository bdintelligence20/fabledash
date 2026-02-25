import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Input, Spinner, StatCard, Table } from '../components/ui';
import apiClient from '../lib/api';
import { currency, chartColors } from '../styles/tokens';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface CostBenefitClient {
  client_id: string;
  client_name: string;
  partner_group: string;
  total_revenue: number;
  total_hours: number;
  zar_per_hour: number;
  invoice_count: number;
  is_pass_through: boolean;
}

interface CostBenefitSummary {
  total_revenue: number;
  total_hours: number;
  average_zar_per_hour: number;
  pass_through_count: number;
  pass_through_revenue: number;
}

interface CostBenefitData {
  clients: CostBenefitClient[];
  summary: CostBenefitSummary;
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

const PARTNER_GROUP_LABELS: Record<string, string> = {
  collab: 'Collab',
  edcp: 'EDCP',
  direct_clients: 'Direct',
  separate_businesses: 'Separate',
};

const PARTNER_GROUP_BADGE: Record<string, 'primary' | 'default' | 'success' | 'warning'> = {
  collab: 'primary',
  edcp: 'default',
  direct_clients: 'success',
  separate_businesses: 'warning',
};

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

function getToday(): string {
  return toISODate(new Date());
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

function clientInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function CostBenefitPage() {
  /* ---- Period state ---- */
  const [preset, setPreset] = useState<PresetKey>('quarter');
  const [dateFrom, setDateFrom] = useState(() => presetRange('quarter').from);
  const [dateTo, setDateTo] = useState(() => presetRange('quarter').to);

  /* ---- Data state ---- */
  const [data, setData] = useState<CostBenefitData | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---- Fetch cost-benefit data ---- */
  const fetchCostBenefit = useCallback(async (from: string, to: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('date_from', from);
      if (to) params.set('date_to', to);
      const qs = params.toString();
      const url = `/financial-data/cost-benefit${qs ? `?${qs}` : ''}`;
      const res = await apiClient.get<{ success: boolean; data: CostBenefitData }>(url);
      if (res.success) setData(res.data);
    } catch (err) {
      console.error('Failed to fetch cost-benefit data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Initial fetch ---- */
  useEffect(() => {
    fetchCostBenefit(dateFrom, dateTo);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Handle preset change ---- */
  const handlePreset = (p: PresetKey) => {
    setPreset(p);
    if (p !== 'custom') {
      const range = presetRange(p);
      setDateFrom(range.from);
      setDateTo(range.to);
      fetchCostBenefit(range.from, range.to);
    }
  };

  /* ---- Handle custom date apply ---- */
  const handleApplyCustom = () => {
    fetchCostBenefit(dateFrom, dateTo);
  };

  /* ---- Row tinting logic ---- */
  const rowTint = useMemo(() => {
    if (!data) return (_idx: number) => '';
    const nonPassThrough = data.clients.filter((c) => !c.is_pass_through);
    const len = nonPassThrough.length;
    return (idx: number) => {
      const client = data.clients[idx];
      if (client.is_pass_through) return '';
      const rank = nonPassThrough.indexOf(client);
      if (rank < 3) return 'bg-success-50/60';
      if (rank >= len - 3 && len > 3) return 'bg-danger-50/60';
      return '';
    };
  }, [data]);

  /* ---- Value distribution bar segments ---- */
  const barSegments = useMemo(() => {
    if (!data || data.summary.total_revenue === 0) return [];
    return data.clients
      .filter((c) => c.total_revenue > 0)
      .map((c, idx) => ({
        clientName: c.client_name,
        initials: clientInitials(c.client_name),
        revenue: c.total_revenue,
        percentage: (c.total_revenue / data.summary.total_revenue) * 100,
        color: chartColors.categorical[idx % chartColors.categorical.length],
      }));
  }, [data]);

  /* ---- Has data to show ---- */
  const hasData = data && data.clients.length > 0;

  return (
    <div>
      {/* Page header */}
      <div className="animate-up">
        <h1 className="text-2xl font-bold text-heading">Cost-Benefit Analysis</h1>
        <p className="text-body mt-1">
          Client value rankings by ZAR per hour worked.
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
            No cost-benefit data for this period
          </p>
          <p className="mt-1 text-sm text-surface-400">
            Try selecting a different date range or ensure there are invoices and time logs.
          </p>
        </div>
      )}

      {/* Data content */}
      {!loading && hasData && data && (
        <>
          {/* Summary stat cards */}
          <div
            className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-up"
            style={{ animationDelay: '200ms' }}
          >
            <StatCard
              title="Total Revenue"
              value={currency.format(data.summary.total_revenue)}
            />
            <StatCard
              title="Total Hours"
              value={`${data.summary.total_hours} hrs`}
            />
            <StatCard
              title="Avg ZAR/Hr"
              value={currency.format(data.summary.average_zar_per_hour)}
            />
            <StatCard
              title="Pass-Through Revenue"
              value={currency.format(data.summary.pass_through_revenue)}
              icon={
                data.summary.pass_through_count > 0 ? (
                  <Badge variant="warning" size="sm">
                    {data.summary.pass_through_count}
                  </Badge>
                ) : undefined
              }
            />
          </div>

          {/* Value distribution bar */}
          {barSegments.length > 0 && (
            <div className="mt-6 animate-up" style={{ animationDelay: '300ms' }}>
              <Card padding="md">
                <p className="text-sm font-semibold text-surface-600 mb-3">
                  Revenue Distribution by Client
                </p>
                <div className="flex w-full h-10 rounded-lg overflow-hidden">
                  {barSegments.map((seg) => (
                    <div
                      key={seg.clientName}
                      className="flex items-center justify-center text-xs font-medium text-white transition-all"
                      style={{
                        width: `${seg.percentage}%`,
                        backgroundColor: seg.color,
                        minWidth: seg.percentage > 0 ? '1.5rem' : 0,
                      }}
                      title={`${seg.clientName}: ${currency.format(seg.revenue)} (${seg.percentage.toFixed(1)}%)`}
                    >
                      {seg.percentage >= 8 ? seg.initials : ''}
                    </div>
                  ))}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-3">
                  {barSegments.map((seg) => (
                    <div key={seg.clientName} className="flex items-center gap-2 text-xs text-surface-600">
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ backgroundColor: seg.color }}
                      />
                      {seg.clientName}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Client Value Table */}
          <div className="mt-6 animate-up" style={{ animationDelay: '400ms' }}>
            <Card padding="none">
              <div className="px-4 py-3 border-b border-surface-200">
                <p className="text-sm font-semibold text-surface-700">
                  Client Value Rankings
                </p>
              </div>
              <Table>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell className="w-14">Rank</Table.HeaderCell>
                    <Table.HeaderCell>Client</Table.HeaderCell>
                    <Table.HeaderCell>Partner Group</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Revenue</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Hours</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">ZAR/Hr</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Invoices</Table.HeaderCell>
                    <Table.HeaderCell>Type</Table.HeaderCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {data.clients.map((client, idx) => (
                    <Table.Row key={client.client_id} className={rowTint(idx)}>
                      <Table.Cell>
                        <span className="text-sm font-medium text-surface-500">
                          {idx + 1}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="font-medium">
                        {client.client_name}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          variant={PARTNER_GROUP_BADGE[client.partner_group] ?? 'default'}
                          size="sm"
                        >
                          {PARTNER_GROUP_LABELS[client.partner_group] ?? client.partner_group}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {currency.format(client.total_revenue)}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {client.total_hours}
                      </Table.Cell>
                      <Table.Cell className="text-right font-medium">
                        {client.is_pass_through ? (
                          <Badge variant="warning" size="sm">Pass-through</Badge>
                        ) : (
                          currency.format(client.zar_per_hour)
                        )}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {client.invoice_count}
                      </Table.Cell>
                      <Table.Cell>
                        {client.is_pass_through ? (
                          <Badge variant="warning" size="sm" dot>Pass-through</Badge>
                        ) : (
                          <Badge variant="success" size="sm" dot>Billable</Badge>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
                {/* Footer totals */}
                <tfoot className="bg-surface-50 border-t border-surface-200">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-surface-900 text-sm" colSpan={3}>
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-surface-900 text-sm">
                      {currency.format(data.summary.total_revenue)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-surface-900 text-sm">
                      {data.summary.total_hours}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-surface-900 text-sm">
                      {currency.format(data.summary.average_zar_per_hour)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-surface-700">
                      {data.clients.reduce((s, c) => s + c.invoice_count, 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-500">
                      {data.summary.pass_through_count} pass-through
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
