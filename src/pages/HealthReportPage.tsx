import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  DollarSign,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button, Card, Spinner, StatCard, Table, Badge } from '../components/ui';
import apiClient from '../lib/api';
import { currency, colors } from '../styles/tokens';

/* -------------------------------------------------------------------------- */
/*  Types — mirrors backend full_health_report response                        */
/* -------------------------------------------------------------------------- */

interface OperationalEfficiency {
  total_hours: number;
  billable_hours: number;
  utilization_rate: number;
  time_allocation_by_group: Record<string, { hours: number; percentage: number }>;
  saturation_top5_clients: { client_name: string; hours: number; percentage: number }[];
  saturation_top5_tasks: { task_name: string; client_name: string; hours: number; percentage: number }[];
  avg_task_completion_days: number | null;
  productivity_score: number;
  completion_rate: number;
}

interface FinancialPerformance {
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  profit_margin: number;
  cash_position: number;
  invoice_count: number;
  collection_rate: number;
  cost_benefit_rankings: { client_name: string; revenue: number; hours: number; zar_per_hour: number }[];
}

interface ProcessQuality {
  total_tasks_created: number;
  tasks_completed: number;
  completion_rate: number;
  overdue_tasks: number;
  overdue_rate: number;
  time_entry_consistency: number;
  weekdays_in_period: number;
  days_with_entries: number;
  meeting_count: number;
  meeting_to_action_ratio: number | null;
  total_time_entries: number;
}

interface HealthReportData {
  period: { start: string; end: string };
  operational_efficiency: OperationalEfficiency;
  financial_performance: FinancialPerformance;
  process_quality: ProcessQuality;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                   */
/* -------------------------------------------------------------------------- */

const QUARTERS = [
  { label: 'Q1', value: 1 },
  { label: 'Q2', value: 2 },
  { label: 'Q3', value: 3 },
  { label: 'Q4', value: 4 },
] as const;

const PARTNER_GROUP_LABELS: Record<string, string> = {
  collab_consulting: 'Collab Consulting',
  edcp: 'EDCP',
  direct_clients: 'Direct Clients',
  separate_businesses: 'Separate Businesses',
};

const PARTNER_GROUP_COLORS: Record<string, string> = {
  collab_consulting: colors.primary[500],
  edcp: colors.success[500],
  direct_clients: colors.accent[500],
  separate_businesses: colors.warning[500],
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getQuarterDates(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0); // last day of quarter
  return { start: toISODate(start), end: toISODate(end) };
}

function getYTDDates(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: toISODate(new Date()) };
}

function healthScoreColor(score: number): string {
  if (score > 75) return 'text-success-600';
  if (score >= 50) return 'text-warning-600';
  return 'text-danger-600';
}

function healthScoreBg(score: number): string {
  if (score > 75) return 'bg-success-50 border-success-200';
  if (score >= 50) return 'bg-warning-50 border-warning-200';
  return 'bg-danger-50 border-danger-200';
}

function healthScoreLabel(score: number): string {
  if (score > 75) return 'Healthy';
  if (score >= 50) return 'Needs Attention';
  return 'Critical';
}

function rateColor(rate: number): string {
  if (rate >= 75) return '#22c55e';
  if (rate >= 50) return '#f59e0b';
  return '#ef4444';
}

function rateTextClass(rate: number): string {
  if (rate >= 75) return 'text-success-600';
  if (rate >= 50) return 'text-warning-600';
  return 'text-danger-600';
}

function calculateHealthScore(data: HealthReportData): number {
  const op = data.operational_efficiency;
  const fin = data.financial_performance;
  const proc = data.process_quality;

  // Weighted composite: 40% operational, 35% financial, 25% process
  const opScore = op.productivity_score; // already 0-100
  const finScore = Math.min(fin.profit_margin + fin.collection_rate, 100); // capped
  const procScore = (proc.completion_rate * 0.4 + (100 - proc.overdue_rate) * 0.3 + proc.time_entry_consistency * 0.3);

  const composite = opScore * 0.4 + finScore * 0.35 + procScore * 0.25;
  return Math.round(Math.min(Math.max(composite, 0), 100));
}

/* -------------------------------------------------------------------------- */
/*  HealthReportPage                                                           */
/* -------------------------------------------------------------------------- */

export default function HealthReportPage() {
  const [searchParams] = useSearchParams();

  /* ---- Period state ---- */
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;

  const [year, setYear] = useState(() => {
    const paramYear = searchParams.get('period_start')?.split('-')[0];
    return paramYear ? parseInt(paramYear, 10) : currentYear;
  });
  const [quarter, setQuarter] = useState(() => {
    const paramStart = searchParams.get('period_start');
    if (paramStart) {
      const month = parseInt(paramStart.split('-')[1], 10);
      return Math.floor((month - 1) / 3) + 1;
    }
    return currentQuarter;
  });
  const [isYTD, setIsYTD] = useState(() => {
    const paramStart = searchParams.get('period_start');
    const paramEnd = searchParams.get('period_end');
    if (paramStart && paramEnd) {
      return paramStart.endsWith('-01-01') && paramEnd === toISODate(new Date());
    }
    return false;
  });

  /* ---- Data state ---- */
  const [data, setData] = useState<HealthReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- Accordion state ---- */
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['operational', 'financial', 'process'])
  );

  const toggleSection = (section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  /* ---- Fetch data ---- */
  const fetchReport = useCallback(async (periodStart: string, periodEnd: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: HealthReportData }>(
        `/reports/health?period_start=${periodStart}&period_end=${periodEnd}`
      );
      if (res.success) {
        setData(res.data);
      } else {
        setError('Failed to load health report data.');
      }
    } catch {
      setError('Failed to load health report. The API may be unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Initial + period change fetch ---- */
  useEffect(() => {
    const range = isYTD ? getYTDDates(year) : getQuarterDates(year, quarter);
    fetchReport(range.start, range.end);
  }, [year, quarter, isYTD, fetchReport]);

  /* ---- Health score ---- */
  const healthScore = useMemo(() => {
    if (!data) return 0;
    return calculateHealthScore(data);
  }, [data]);

  /* ---- Gauge style for utilization ---- */
  const utilizationGaugeStyle = useMemo(() => {
    if (!data) return {};
    const rate = data.operational_efficiency.utilization_rate;
    const color = rateColor(rate);
    const deg = (rate / 100) * 360;
    return {
      background: `conic-gradient(${color} ${deg}deg, #e5e7eb ${deg}deg 360deg)`,
    };
  }, [data]);

  /* ---- Year options ---- */
  const yearOptions = [currentYear - 1, currentYear];

  /* ---- Period display ---- */
  const periodLabel = isYTD
    ? `Year to Date ${year}`
    : `Q${quarter} ${year}`;

  return (
    <div>
      {/* Page header */}
      <div className="animate-up">
        <h1 className="text-2xl font-bold text-heading">Health &amp; Vitality Report</h1>
        <p className="text-body mt-1">
          Comprehensive business health assessment for {periodLabel}.
        </p>
      </div>

      {/* Period Selector */}
      <div className="mt-6 animate-up" style={{ animationDelay: '100ms' }}>
        <Card padding="md">
          <div className="flex flex-wrap items-end gap-4">
            {/* Year selector */}
            <div>
              <p className="text-xs font-medium text-surface-500 mb-1.5">Year</p>
              <div className="flex gap-1">
                {yearOptions.map((y) => (
                  <Button
                    key={y}
                    variant={year === y && !isYTD ? 'primary' : year === y && isYTD ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => { setYear(y); setIsYTD(false); }}
                  >
                    {y}
                  </Button>
                ))}
              </div>
            </div>

            {/* Quarter selector */}
            <div>
              <p className="text-xs font-medium text-surface-500 mb-1.5">Quarter</p>
              <div className="flex gap-1">
                {QUARTERS.map((q) => (
                  <Button
                    key={q.value}
                    variant={quarter === q.value && !isYTD ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => { setQuarter(q.value); setIsYTD(false); }}
                  >
                    {q.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* YTD toggle */}
            <div>
              <p className="text-xs font-medium text-surface-500 mb-1.5">Range</p>
              <Button
                variant={isYTD ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setIsYTD(true)}
              >
                YTD
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-10 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="mt-6 rounded-lg bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      {/* Report content */}
      {!loading && !error && data && (
        <>
          {/* Overall Health Score */}
          <div className="mt-6 animate-up" style={{ animationDelay: '200ms' }}>
            <div className={`rounded-xl border-2 p-6 text-center ${healthScoreBg(healthScore)}`}>
              <p className="text-sm font-medium text-surface-600 mb-2">Overall Health Score</p>
              <p className={`text-5xl font-bold ${healthScoreColor(healthScore)}`}>
                {healthScore}
              </p>
              <p className={`mt-1 text-sm font-semibold ${healthScoreColor(healthScore)}`}>
                {healthScoreLabel(healthScore)}
              </p>
              <p className="mt-2 text-xs text-surface-500">
                {periodLabel} &middot; Weighted composite of operational, financial, and process metrics
              </p>
            </div>
          </div>

          {/* Summary stat cards */}
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4 animate-up" style={{ animationDelay: '250ms' }}>
            <StatCard
              title="Utilization Rate"
              value={`${data.operational_efficiency.utilization_rate}%`}
              icon={<Activity className="h-5 w-5" />}
            />
            <StatCard
              title="Net Profit"
              value={currency.format(data.financial_performance.net_profit)}
              icon={<DollarSign className="h-5 w-5" />}
            />
            <StatCard
              title="Task Completion"
              value={`${data.process_quality.completion_rate}%`}
              icon={<ClipboardCheck className="h-5 w-5" />}
            />
            <StatCard
              title="Productivity"
              value={`${data.operational_efficiency.productivity_score}`}
              icon={<Activity className="h-5 w-5" />}
            />
          </div>

          {/* ================================================================ */}
          {/*  Section: Operational Efficiency                                   */}
          {/* ================================================================ */}
          <div className="mt-6 animate-up" style={{ animationDelay: '300ms' }}>
            <SectionAccordion
              id="operational"
              title="Operational Efficiency"
              icon={<Activity className="h-5 w-5" />}
              color={colors.primary[500]}
              isOpen={openSections.has('operational')}
              onToggle={() => toggleSection('operational')}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Utilization gauge */}
                <Card padding="md" className="flex flex-col items-center justify-center">
                  <p className="text-sm font-semibold text-surface-600 mb-4">Utilization Rate</p>
                  <div
                    className="relative w-28 h-28 rounded-full flex items-center justify-center"
                    style={utilizationGaugeStyle}
                  >
                    <div className="absolute w-20 h-20 rounded-full bg-white flex items-center justify-center">
                      <span className={`text-2xl font-bold ${rateTextClass(data.operational_efficiency.utilization_rate)}`}>
                        {data.operational_efficiency.utilization_rate}%
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-surface-400">
                    {data.operational_efficiency.billable_hours} / {data.operational_efficiency.total_hours} hrs billable
                  </p>
                </Card>

                {/* Time allocation stacked bar */}
                <Card padding="md" className="lg:col-span-2">
                  <p className="text-sm font-semibold text-surface-600 mb-4">Time Allocation by Partner Group</p>
                  <div className="space-y-3">
                    {Object.entries(data.operational_efficiency.time_allocation_by_group).map(([group, stats]) => (
                      <div key={group}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-surface-700">
                            {PARTNER_GROUP_LABELS[group] || group}
                          </span>
                          <span className="text-xs text-surface-500">
                            {stats.hours} hrs ({stats.percentage}%)
                          </span>
                        </div>
                        <div className="h-4 rounded bg-surface-100 overflow-hidden">
                          <div
                            className="h-full rounded transition-all"
                            style={{
                              width: `${Math.max(stats.percentage, 1)}%`,
                              backgroundColor: PARTNER_GROUP_COLORS[group] || colors.surface[400],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mt-4">
                    {Object.entries(PARTNER_GROUP_LABELS).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-1.5 text-xs text-surface-600">
                        <span
                          className="inline-block w-3 h-3 rounded-sm"
                          style={{ backgroundColor: PARTNER_GROUP_COLORS[key] }}
                        />
                        {label}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Saturation top 5 + Productivity */}
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card padding="none">
                  <div className="px-4 py-3 border-b border-surface-200">
                    <p className="text-sm font-semibold text-surface-700">Top 5 Clients (Saturation)</p>
                  </div>
                  {data.operational_efficiency.saturation_top5_clients.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-surface-400">No data</div>
                  ) : (
                    <Table>
                      <Table.Head>
                        <Table.Row>
                          <Table.HeaderCell className="w-10">#</Table.HeaderCell>
                          <Table.HeaderCell>Client</Table.HeaderCell>
                          <Table.HeaderCell className="text-right">Hours</Table.HeaderCell>
                          <Table.HeaderCell className="text-right">%</Table.HeaderCell>
                        </Table.Row>
                      </Table.Head>
                      <Table.Body>
                        {data.operational_efficiency.saturation_top5_clients.map((item, idx) => (
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
                            <Table.Cell className="text-right tabular-nums">{item.hours}</Table.Cell>
                            <Table.Cell className="text-right tabular-nums">{item.percentage}%</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  )}
                </Card>

                <Card padding="md">
                  <p className="text-sm font-semibold text-surface-600 mb-4">Productivity Score</p>
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-bold text-surface-900">
                      {data.operational_efficiency.productivity_score}
                    </div>
                    <div className="text-sm text-surface-500 leading-relaxed">
                      <p>60% utilization + 40% completion</p>
                      <p className="mt-1">
                        Completion rate: {data.operational_efficiency.completion_rate}%
                      </p>
                      {data.operational_efficiency.avg_task_completion_days !== null && (
                        <p className="mt-1">
                          Avg task completion: {data.operational_efficiency.avg_task_completion_days} days
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </SectionAccordion>
          </div>

          {/* ================================================================ */}
          {/*  Section: Financial Performance                                    */}
          {/* ================================================================ */}
          <div className="mt-4 animate-up" style={{ animationDelay: '350ms' }}>
            <SectionAccordion
              id="financial"
              title="Financial Performance"
              icon={<DollarSign className="h-5 w-5" />}
              color={colors.success[500]}
              isOpen={openSections.has('financial')}
              onToggle={() => toggleSection('financial')}
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Revenue"
                  value={currency.format(data.financial_performance.total_revenue)}
                />
                <StatCard
                  title="Total Expenses"
                  value={currency.format(data.financial_performance.total_expenses)}
                />
                <StatCard
                  title="Net Profit"
                  value={currency.format(data.financial_performance.net_profit)}
                  change={{
                    value: data.financial_performance.profit_margin,
                    direction: data.financial_performance.net_profit >= 0 ? 'up' : 'down',
                  }}
                />
                <StatCard
                  title="Cash Position"
                  value={currency.format(data.financial_performance.cash_position)}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Cost-benefit top 5 */}
                <Card padding="none">
                  <div className="px-4 py-3 border-b border-surface-200">
                    <p className="text-sm font-semibold text-surface-700">Cost-Benefit Top 5 Clients</p>
                  </div>
                  {data.financial_performance.cost_benefit_rankings.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-surface-400">No data</div>
                  ) : (
                    <Table>
                      <Table.Head>
                        <Table.Row>
                          <Table.HeaderCell className="w-10">#</Table.HeaderCell>
                          <Table.HeaderCell>Client</Table.HeaderCell>
                          <Table.HeaderCell className="text-right">Revenue</Table.HeaderCell>
                          <Table.HeaderCell className="text-right">ZAR/Hr</Table.HeaderCell>
                        </Table.Row>
                      </Table.Head>
                      <Table.Body>
                        {data.financial_performance.cost_benefit_rankings.map((item, idx) => (
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
                            <Table.Cell className="text-right tabular-nums">{currency.format(item.revenue)}</Table.Cell>
                            <Table.Cell className="text-right tabular-nums">{currency.format(item.zar_per_hour)}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  )}
                </Card>

                {/* Pass-through / Collection summary */}
                <Card padding="md">
                  <p className="text-sm font-semibold text-surface-600 mb-4">Collection Summary</p>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-surface-500">Collection Rate</p>
                      <div className="flex items-end gap-2 mt-1">
                        <span className={`text-3xl font-bold ${rateTextClass(data.financial_performance.collection_rate)}`}>
                          {data.financial_performance.collection_rate}%
                        </span>
                        <span className="text-sm text-surface-500 pb-1">
                          of {data.financial_performance.invoice_count} invoices paid
                        </span>
                      </div>
                      <div className="mt-2 h-3 rounded bg-surface-100 overflow-hidden">
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${data.financial_performance.collection_rate}%`,
                            backgroundColor: rateColor(data.financial_performance.collection_rate),
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-surface-500">Profit Margin</p>
                      <p className={`text-2xl font-bold mt-1 ${data.financial_performance.profit_margin >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                        {data.financial_performance.profit_margin}%
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </SectionAccordion>
          </div>

          {/* ================================================================ */}
          {/*  Section: Process Quality                                          */}
          {/* ================================================================ */}
          <div className="mt-4 animate-up" style={{ animationDelay: '400ms' }}>
            <SectionAccordion
              id="process"
              title="Process Quality"
              icon={<ClipboardCheck className="h-5 w-5" />}
              color={colors.accent[500]}
              isOpen={openSections.has('process')}
              onToggle={() => toggleSection('process')}
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Task Completion Rate"
                  value={`${data.process_quality.completion_rate}%`}
                  detail={`${data.process_quality.tasks_completed} of ${data.process_quality.total_tasks_created} tasks`}
                  color={rateColor(data.process_quality.completion_rate)}
                />
                <MetricCard
                  label="Overdue Rate"
                  value={`${data.process_quality.overdue_rate}%`}
                  detail={`${data.process_quality.overdue_tasks} tasks overdue`}
                  color={rateColor(100 - data.process_quality.overdue_rate)}
                />
                <MetricCard
                  label="Meeting-to-Action"
                  value={data.process_quality.meeting_to_action_ratio !== null
                    ? `${data.process_quality.meeting_to_action_ratio}`
                    : '\u2014'}
                  detail={`${data.process_quality.meeting_count} meetings`}
                  color={colors.primary[500]}
                />
                <MetricCard
                  label="Time Entry Consistency"
                  value={`${data.process_quality.time_entry_consistency}%`}
                  detail={`${data.process_quality.days_with_entries} of ${data.process_quality.weekdays_in_period} weekdays`}
                  color={rateColor(data.process_quality.time_entry_consistency)}
                />
              </div>

              {/* Process quality progress bars */}
              <div className="mt-4">
                <Card padding="md">
                  <p className="text-sm font-semibold text-surface-600 mb-4">Quality Indicators</p>
                  <div className="space-y-4">
                    <ProgressMetric
                      label="Task Completion"
                      value={data.process_quality.completion_rate}
                      target={80}
                    />
                    <ProgressMetric
                      label="Time Entry Coverage"
                      value={data.process_quality.time_entry_consistency}
                      target={90}
                    />
                    <ProgressMetric
                      label="On-Time Delivery"
                      value={Math.max(100 - data.process_quality.overdue_rate, 0)}
                      target={85}
                    />
                  </div>
                </Card>
              </div>
            </SectionAccordion>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function SectionAccordion({
  id,
  title,
  icon,
  color,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-surface-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 bg-white hover:bg-surface-50 transition-colors text-left"
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>
        <h2 className="flex-1 text-lg font-semibold text-surface-900">{title}</h2>
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-surface-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-surface-400" />
        )}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 bg-surface-50/50">
          {children}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <Card padding="md">
      <p className="text-xs font-medium text-surface-500">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>
        {value}
      </p>
      <p className="text-xs text-surface-400 mt-1">{detail}</p>
    </Card>
  );
}

function ProgressMetric({
  label,
  value,
  target,
}: {
  label: string;
  value: number;
  target: number;
}) {
  const isOnTarget = value >= target;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-surface-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${isOnTarget ? 'text-success-600' : 'text-warning-600'}`}>
            {value}%
          </span>
          <span className="text-xs text-surface-400">/ {target}% target</span>
        </div>
      </div>
      <div className="relative h-3 rounded bg-surface-100 overflow-hidden">
        <div
          className="h-full rounded transition-all"
          style={{
            width: `${Math.min(value, 100)}%`,
            backgroundColor: isOnTarget ? colors.success[500] : colors.warning[500],
          }}
        />
        {/* Target marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-surface-600"
          style={{ left: `${target}%` }}
          title={`Target: ${target}%`}
        />
      </div>
    </div>
  );
}
