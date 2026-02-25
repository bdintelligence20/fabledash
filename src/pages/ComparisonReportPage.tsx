import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Select, Spinner } from '../components/ui';
import apiClient from '../lib/api';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface Delta {
  absolute_change: number | null;
  percentage_change: number | null;
  direction: 'improved' | 'declined' | 'unchanged';
}

interface TrendEntry {
  section: string;
  metric: string;
  absolute_change: number | null;
  percentage_change: number | null;
}

interface Trends {
  improvements: TrendEntry[];
  declines: TrendEntry[];
  unchanged: TrendEntry[];
  summary: { improved: number; declined: number; unchanged: number };
}

interface SectionDeltas {
  [metric: string]: Delta;
}

interface ComparisonData {
  period_a: {
    period: { start: string; end: string };
    operational_efficiency: Record<string, unknown>;
    financial_performance: Record<string, unknown>;
    process_quality: Record<string, unknown>;
  };
  period_b: {
    period: { start: string; end: string };
    operational_efficiency: Record<string, unknown>;
    financial_performance: Record<string, unknown>;
    process_quality: Record<string, unknown>;
  };
  deltas: {
    operational_efficiency: SectionDeltas;
    financial_performance: SectionDeltas;
    process_quality: SectionDeltas;
  };
  trends: Trends;
  labels: { period_a: string; period_b: string };
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                   */
/* -------------------------------------------------------------------------- */

type CompareMode = 'qvq' | 'ytd';

const CURRENT_YEAR = new Date().getFullYear();

const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => ({
  value: String(CURRENT_YEAR - i),
  label: String(CURRENT_YEAR - i),
}));

const QUARTER_OPTIONS = [
  { value: '1', label: 'Q1 (Jan–Mar)' },
  { value: '2', label: 'Q2 (Apr–Jun)' },
  { value: '3', label: 'Q3 (Jul–Sep)' },
  { value: '4', label: 'Q4 (Oct–Dec)' },
];

/** Human-readable labels for metrics */
const METRIC_LABELS: Record<string, string> = {
  // Operational
  utilization_rate: 'Utilization Rate',
  total_hours: 'Total Hours Logged',
  billable_hours: 'Billable Hours',
  productivity_score: 'Productivity Score',
  completion_rate: 'Completion Rate',
  avg_task_completion_days: 'Avg Task Completion (days)',
  // Financial
  total_revenue: 'Total Revenue (ZAR)',
  total_expenses: 'Total Expenses (ZAR)',
  net_profit: 'Net Profit (ZAR)',
  profit_margin: 'Profit Margin',
  cash_position: 'Cash Position (ZAR)',
  invoice_count: 'Invoice Count',
  collection_rate: 'Collection Rate',
  // Process
  total_tasks_created: 'Tasks Created',
  tasks_completed: 'Tasks Completed',
  overdue_tasks: 'Overdue Tasks',
  overdue_rate: 'Overdue Rate',
  time_entry_consistency: 'Time Entry Consistency',
  total_time_entries: 'Time Entries',
};

/** Units/suffixes for display */
const METRIC_UNITS: Record<string, string> = {
  utilization_rate: '%',
  completion_rate: '%',
  profit_margin: '%',
  collection_rate: '%',
  overdue_rate: '%',
  time_entry_consistency: '%',
  avg_task_completion_days: ' days',
  total_hours: ' hrs',
  billable_hours: ' hrs',
  productivity_score: '',
};

/** ZAR-formatted metrics */
const ZAR_METRICS = new Set([
  'total_revenue',
  'total_expenses',
  'net_profit',
  'cash_position',
]);

/** Section display configuration */
const SECTIONS: {
  key: 'operational_efficiency' | 'financial_performance' | 'process_quality';
  title: string;
  metrics: string[];
}[] = [
  {
    key: 'operational_efficiency',
    title: 'Operational',
    metrics: ['utilization_rate', 'total_hours', 'billable_hours'],
  },
  {
    key: 'financial_performance',
    title: 'Financial',
    metrics: ['total_revenue', 'net_profit', 'profit_margin'],
  },
  {
    key: 'process_quality',
    title: 'Process',
    metrics: ['tasks_completed', 'overdue_rate', 'time_entry_consistency'],
  },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function formatZAR(value: number): string {
  return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMetricValue(metric: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  if (ZAR_METRICS.has(metric)) return formatZAR(num);
  const unit = METRIC_UNITS[metric] ?? '';
  return `${num.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}${unit}`;
}

function metricLabel(key: string): string {
  return METRIC_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function sectionLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function TrendArrow({ direction }: { direction: 'improved' | 'declined' | 'unchanged' }) {
  if (direction === 'improved') {
    return (
      <span className="inline-flex items-center text-success-600" title="Improved">
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l5 5a1 1 0 01-1.414 1.414L11 6.414V16a1 1 0 11-2 0V6.414L5.707 9.707a1 1 0 01-1.414-1.414l5-5A1 1 0 0110 3z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  if (direction === 'declined') {
    return (
      <span className="inline-flex items-center text-danger-600" title="Declined">
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 17a1 1 0 01-.707-.293l-5-5a1 1 0 111.414-1.414L9 13.586V4a1 1 0 112 0v9.586l3.293-3.293a1 1 0 111.414 1.414l-5 5A1 1 0 0110 17z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-surface-400" title="Unchanged">
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 10a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    </span>
  );
}

function DeltaBadge({ delta }: { delta: Delta }) {
  if (delta.percentage_change === null) return <span className="text-xs text-surface-400">—</span>;
  const isUp = delta.direction === 'improved';
  const isDown = delta.direction === 'declined';

  const sign = (delta.absolute_change ?? 0) > 0 ? '+' : '';
  const pctText = `${sign}${delta.percentage_change}%`;

  return (
    <Badge
      variant={isUp ? 'success' : isDown ? 'danger' : 'default'}
      size="sm"
    >
      {pctText}
    </Badge>
  );
}

function MetricRow({
  metric,
  valueA,
  valueB,
  delta,
}: {
  metric: string;
  valueA: unknown;
  valueB: unknown;
  delta: Delta;
}) {
  return (
    <div className="grid grid-cols-12 items-center gap-2 py-3 border-b border-surface-100 last:border-b-0">
      <div className="col-span-3 text-sm font-medium text-surface-700">
        {metricLabel(metric)}
      </div>
      <div className="col-span-3 text-sm text-right text-surface-600">
        {formatMetricValue(metric, valueA)}
      </div>
      <div className="col-span-1 flex justify-center">
        <TrendArrow direction={delta.direction} />
      </div>
      <div className="col-span-3 text-sm text-right text-surface-600">
        {formatMetricValue(metric, valueB)}
      </div>
      <div className="col-span-2 flex justify-end">
        <DeltaBadge delta={delta} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function ComparisonReportPage() {
  /* ---- Mode state ---- */
  const [mode, setMode] = useState<CompareMode>('qvq');

  /* ---- QvQ state ---- */
  const [qvqYear, setQvqYear] = useState(String(CURRENT_YEAR));
  const [quarterA, setQuarterA] = useState('1');
  const [quarterB, setQuarterB] = useState('2');

  /* ---- YTD state ---- */
  const [ytdYear, setYtdYear] = useState(String(CURRENT_YEAR));

  /* ---- Data state ---- */
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---- Fetch comparison data ---- */
  const fetchComparison = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url: string;
      if (mode === 'qvq') {
        url = `/reports/quarterly?year=${qvqYear}&quarter_a=${quarterA}&quarter_b=${quarterB}`;
      } else {
        url = `/reports/ytd?year=${ytdYear}`;
      }
      const res = await apiClient.get<{ success: boolean; data: ComparisonData; error?: string }>(url);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error ?? 'Failed to load comparison data');
      }
    } catch (err) {
      console.error('Failed to fetch comparison data', err);
      setError('Failed to load comparison data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [mode, qvqYear, quarterA, quarterB, ytdYear]);

  /* ---- Fetch on mount and mode/param change ---- */
  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  /* ---- Derived: labels ---- */
  const labelA = data?.labels?.period_a ?? 'Period A';
  const labelB = data?.labels?.period_b ?? 'Period B';

  /* ---- Derived: improvements and declines lists ---- */
  const improvements = useMemo(() => {
    if (!data) return [];
    return data.trends.improvements.map((t) => ({
      label: metricLabel(t.metric),
      section: sectionLabel(t.section),
      pct: t.percentage_change,
    }));
  }, [data]);

  const declines = useMemo(() => {
    if (!data) return [];
    return data.trends.declines.map((t) => ({
      label: metricLabel(t.metric),
      section: sectionLabel(t.section),
      pct: t.percentage_change,
    }));
  }, [data]);

  return (
    <div>
      {/* Page header */}
      <div className="animate-up">
        <h1 className="text-2xl font-bold text-heading">Period Comparison</h1>
        <p className="text-body mt-1">
          Side-by-side quarterly and year-to-date comparisons with trend analysis.
        </p>
      </div>

      {/* Mode & Period Selection */}
      <div className="mt-6 animate-up" style={{ animationDelay: '100ms' }}>
        <Card padding="md">
          <div className="flex flex-wrap items-end gap-4">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <Button
                variant={mode === 'qvq' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setMode('qvq')}
              >
                Quarter vs Quarter
              </Button>
              <Button
                variant={mode === 'ytd' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setMode('ytd')}
              >
                Year to Date
              </Button>
            </div>

            {/* QvQ selectors */}
            {mode === 'qvq' && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-28">
                  <Select
                    label="Year"
                    options={YEAR_OPTIONS}
                    value={qvqYear}
                    onChange={(e) => setQvqYear(e.target.value)}
                  />
                </div>
                <div className="w-40">
                  <Select
                    label="Period A"
                    options={QUARTER_OPTIONS}
                    value={quarterA}
                    onChange={(e) => setQuarterA(e.target.value)}
                  />
                </div>
                <div className="w-40">
                  <Select
                    label="Period B"
                    options={QUARTER_OPTIONS}
                    value={quarterB}
                    onChange={(e) => setQuarterB(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* YTD selector */}
            {mode === 'ytd' && (
              <div className="w-28">
                <Select
                  label="Year"
                  options={YEAR_OPTIONS}
                  value={ytdYear}
                  onChange={(e) => setYtdYear(e.target.value)}
                />
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-10 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="mt-10 flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium text-danger-600">{error}</p>
          <Button size="sm" className="mt-4" onClick={fetchComparison}>
            Retry
          </Button>
        </div>
      )}

      {/* Data content */}
      {!loading && !error && data && (
        <>
          {/* Summary stat cards */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-up" style={{ animationDelay: '200ms' }}>
            <Card padding="md" className="text-center">
              <p className="text-sm text-surface-500">Improvements</p>
              <p className="text-3xl font-bold text-success-600 mt-1">
                {data.trends.summary.improved}
              </p>
            </Card>
            <Card padding="md" className="text-center">
              <p className="text-sm text-surface-500">Declines</p>
              <p className="text-3xl font-bold text-danger-600 mt-1">
                {data.trends.summary.declined}
              </p>
            </Card>
            <Card padding="md" className="text-center">
              <p className="text-sm text-surface-500">Unchanged</p>
              <p className="text-3xl font-bold text-surface-400 mt-1">
                {data.trends.summary.unchanged}
              </p>
            </Card>
          </div>

          {/* Side-by-side comparison sections */}
          {SECTIONS.map((section, idx) => (
            <div
              key={section.key}
              className="mt-6 animate-up"
              style={{ animationDelay: `${300 + idx * 100}ms` }}
            >
              <Card padding="none">
                <div className="px-6 py-4 border-b border-surface-200">
                  <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wide">
                    {section.title}
                  </h2>
                </div>
                <div className="px-6 py-2">
                  {/* Column headers */}
                  <div className="grid grid-cols-12 items-center gap-2 pb-2 border-b border-surface-200">
                    <div className="col-span-3 text-xs font-medium text-surface-500 uppercase">
                      Metric
                    </div>
                    <div className="col-span-3 text-xs font-medium text-surface-500 text-right uppercase">
                      {labelA}
                    </div>
                    <div className="col-span-1" />
                    <div className="col-span-3 text-xs font-medium text-surface-500 text-right uppercase">
                      {labelB}
                    </div>
                    <div className="col-span-2 text-xs font-medium text-surface-500 text-right uppercase">
                      Change
                    </div>
                  </div>

                  {/* Metric rows */}
                  {section.metrics.map((metric) => {
                    const sectionData = data.deltas[section.key] ?? {};
                    const delta: Delta = sectionData[metric] ?? {
                      absolute_change: null,
                      percentage_change: null,
                      direction: 'unchanged',
                    };
                    const valueA = (data.period_a[section.key] as Record<string, unknown>)?.[metric];
                    const valueB = (data.period_b[section.key] as Record<string, unknown>)?.[metric];

                    return (
                      <MetricRow
                        key={metric}
                        metric={metric}
                        valueA={valueA}
                        valueB={valueB}
                        delta={delta}
                      />
                    );
                  })}
                </div>
              </Card>
            </div>
          ))}

          {/* Delta Summary */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-up" style={{ animationDelay: '600ms' }}>
            {/* Improvements */}
            <Card padding="none">
              <div className="px-6 py-4 border-b border-surface-200">
                <h2 className="text-sm font-semibold text-success-700 uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l5 5a1 1 0 01-1.414 1.414L11 6.414V16a1 1 0 11-2 0V6.414L5.707 9.707a1 1 0 01-1.414-1.414l5-5A1 1 0 0110 3z" clipRule="evenodd" />
                  </svg>
                  Improvements ({improvements.length})
                </h2>
              </div>
              <div className="px-6 py-3">
                {improvements.length === 0 ? (
                  <p className="text-sm text-surface-400 py-2">No improvements in this period.</p>
                ) : (
                  <ul className="space-y-2">
                    {improvements.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-success-500 shrink-0" />
                        <span className="text-surface-700 font-medium">{item.label}</span>
                        <span className="text-surface-400 text-xs">({item.section})</span>
                        {item.pct !== null && (
                          <Badge variant="success" size="sm" className="ml-auto">
                            {item.pct > 0 ? '+' : ''}{item.pct}%
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            {/* Declines */}
            <Card padding="none">
              <div className="px-6 py-4 border-b border-surface-200">
                <h2 className="text-sm font-semibold text-danger-700 uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 17a1 1 0 01-.707-.293l-5-5a1 1 0 111.414-1.414L9 13.586V4a1 1 0 112 0v9.586l3.293-3.293a1 1 0 111.414 1.414l-5 5A1 1 0 0110 17z" clipRule="evenodd" />
                  </svg>
                  Declines ({declines.length})
                </h2>
              </div>
              <div className="px-6 py-3">
                {declines.length === 0 ? (
                  <p className="text-sm text-surface-400 py-2">No declines in this period.</p>
                ) : (
                  <ul className="space-y-2">
                    {declines.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-danger-500 shrink-0" />
                        <span className="text-surface-700 font-medium">{item.label}</span>
                        <span className="text-surface-400 text-xs">({item.section})</span>
                        {item.pct !== null && (
                          <Badge variant="danger" size="sm" className="ml-auto">
                            {item.pct > 0 ? '+' : ''}{item.pct}%
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
