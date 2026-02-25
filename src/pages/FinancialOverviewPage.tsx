import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Banknote,
  Clock,
  FileText,
  ArrowRight,
  BarChart3,
  Users,
  Grid3X3,
} from 'lucide-react';
import { StatCard, Card, Spinner, Badge } from '../components/ui';
import { apiClient } from '../lib/api';
import { currency, colors } from '../styles/tokens';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface FinancialSnapshot {
  period_end?: string;
  cash_on_hand?: number | null;
  accounts_receivable?: number | null;
  accounts_payable?: number | null;
  total_revenue?: number | null;
  total_expenses?: number | null;
  net_profit?: number | null;
  [key: string]: unknown;
}

interface InvoicesSummary {
  total: number;
  paid: number;
  outstanding: number;
  overdue: number;
  total_revenue: number;
  total_outstanding_amount: number;
}

interface SummaryData {
  snapshot: FinancialSnapshot | null;
  invoices: InvoicesSummary;
  pnl: unknown;
  forecast: unknown;
  sage_connected: boolean;
}

interface TrendEntry {
  period: string;
  revenue: number;
  expenses: number;
  net_profit: number;
  cash_on_hand: number;
}

interface CostBenefitClient {
  client_id: string;
  client_name: string;
  total_revenue: number;
  total_hours: number;
  zar_per_hour: number;
  invoice_count: number;
  is_pass_through: boolean;
}

interface CostBenefitData {
  clients: CostBenefitClient[];
  summary: {
    total_revenue: number;
    total_hours: number;
    average_zar_per_hour: number;
    pass_through_count: number;
    pass_through_revenue: number;
  };
}

interface VolumeRateData {
  clients: unknown[];
  medians: {
    hours: number;
    zar_per_hour: number;
  };
  quadrant_counts: {
    high_volume_high_rate: number;
    high_volume_low_rate: number;
    low_volume_high_rate: number;
    low_volume_low_rate: number;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'YTD'] as const;
type QuarterKey = (typeof QUARTERS)[number];

/** Map a YYYY-MM period string to its calendar quarter (1-4). */
function monthToQuarter(month: number): number {
  return Math.ceil(month / 3);
}

/** Format YYYY-MM to a short month label like "Jan '26". */
function formatMonthLabel(period: string): string {
  const [yearStr, monthStr] = period.split('-');
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const monthIndex = parseInt(monthStr, 10) - 1;
  const shortYear = yearStr.slice(2);
  return `${monthNames[monthIndex]} '${shortYear}`;
}

/** Group trend entries by quarter key "QN". Returns quarter numbers present. */
function getAvailableQuarters(entries: TrendEntry[]): Set<number> {
  const qs = new Set<number>();
  for (const entry of entries) {
    const month = parseInt(entry.period.split('-')[1], 10);
    qs.add(monthToQuarter(month));
  }
  return qs;
}

/** Filter entries to a specific quarter or return all for YTD. */
function filterByQuarter(entries: TrendEntry[], quarter: QuarterKey): TrendEntry[] {
  if (quarter === 'YTD') return entries;
  const qNum = parseInt(quarter.replace('Q', ''), 10);
  return entries.filter((e) => {
    const month = parseInt(e.period.split('-')[1], 10);
    return monthToQuarter(month) === qNum;
  });
}

/** Sum revenue for a set of entries. */
function sumRevenue(entries: TrendEntry[]): number {
  return entries.reduce((sum, e) => sum + e.revenue, 0);
}

/* -------------------------------------------------------------------------- */
/*  FinancialOverviewPage                                                       */
/* -------------------------------------------------------------------------- */

export default function FinancialOverviewPage() {
  /* ------ State ------ */
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [trendData, setTrendData] = useState<TrendEntry[]>([]);
  const [costBenefitData, setCostBenefitData] = useState<CostBenefitData | null>(null);
  const [volumeRateData, setVolumeRateData] = useState<VolumeRateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterKey>('YTD');

  /* ------ Fetch all data in parallel ------ */
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const [summaryRes, trendRes, costBenefitRes, volumeRateRes] = await Promise.all([
          apiClient.get<ApiResponse<SummaryData>>('/financial-data/summary'),
          apiClient.get<ApiResponse<TrendEntry[]>>('/financial-data/revenue-trend?months=6'),
          apiClient.get<ApiResponse<CostBenefitData>>('/financial-data/cost-benefit'),
          apiClient.get<ApiResponse<VolumeRateData>>('/financial-data/volume-rate'),
        ]);
        setSummaryData(summaryRes.data);
        setTrendData(trendRes.data);
        setCostBenefitData(costBenefitRes.data);
        setVolumeRateData(volumeRateRes.data);
      } catch {
        setError('Failed to load financial data. Some sections may be incomplete.');
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  /* ------ Derived data ------ */
  const filteredTrend = filterByQuarter(trendData, selectedQuarter);
  const totalRevenue = summaryData?.invoices.total_revenue ?? null;
  const outstandingInvoices = summaryData?.invoices.outstanding ?? null;
  const cashOnHand = summaryData?.snapshot?.cash_on_hand ?? null;
  const avgZarPerHr = costBenefitData?.summary.average_zar_per_hour ?? null;

  // QoQ revenue growth
  const availableQs = getAvailableQuarters(trendData);
  const currentQNum = availableQs.size > 0 ? Math.max(...availableQs) : null;
  const prevQNum = currentQNum !== null && currentQNum > 1 ? currentQNum - 1 : null;

  let qoqGrowth: number | null = null;
  if (currentQNum && prevQNum) {
    const curEntries = trendData.filter((e) => monthToQuarter(parseInt(e.period.split('-')[1], 10)) === currentQNum);
    const prevEntries = trendData.filter((e) => monthToQuarter(parseInt(e.period.split('-')[1], 10)) === prevQNum);
    const curRev = sumRevenue(curEntries);
    const prevRev = sumRevenue(prevEntries);
    if (prevRev > 0) {
      qoqGrowth = ((curRev - prevRev) / prevRev) * 100;
    }
  }

  // Utilization rate from total hours (rough: hours worked / (22 work days * 8 hours * months))
  const totalHours = costBenefitData?.summary.total_hours ?? 0;
  const monthCount = trendData.length || 1;
  const availableHours = 22 * 8 * monthCount; // assumes single person for relative metric
  const utilizationRate = availableHours > 0 ? Math.min((totalHours / availableHours) * 100, 100) : null;

  // Revenue trend mini-chart data (last 6 months)
  const maxRevenue = filteredTrend.reduce((max, e) => Math.max(max, e.revenue), 0);

  // Top 5 clients by revenue
  const topClients = costBenefitData?.clients
    .filter((c) => !c.is_pass_through)
    .slice(0, 5) ?? [];

  // Cash trend from trend data
  const latestCashTrend = trendData.length >= 2
    ? trendData[trendData.length - 1].cash_on_hand - trendData[trendData.length - 2].cash_on_hand
    : null;

  // Volume-rate quadrant counts
  const quadrants = volumeRateData?.quadrant_counts ?? null;

  /* ------ Render ------ */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Financial Overview</h1>
        <p className="mt-1 text-sm text-surface-500">
          Combined financial dashboard with key metrics across revenue, costs, and cash position.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-warning-50 border border-warning-200 px-4 py-3 text-sm text-warning-700">
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  Quarter Selector                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap gap-2">
        {QUARTERS.map((q) => (
          <button
            key={q}
            onClick={() => setSelectedQuarter(q)}
            className={[
              'px-4 py-2 text-sm font-medium rounded-lg transition-default',
              selectedQuarter === q
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200',
            ].join(' ')}
          >
            {q}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Key Metrics Row                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Revenue Growth (QoQ)"
          value={qoqGrowth !== null ? `${qoqGrowth >= 0 ? '+' : ''}${qoqGrowth.toFixed(1)}%` : '\u2014'}
          icon={<TrendingUp className="h-5 w-5" />}
          change={qoqGrowth !== null ? {
            value: Math.abs(qoqGrowth),
            direction: qoqGrowth >= 0 ? 'up' : 'down',
          } : undefined}
        />
        <StatCard
          title="Total Revenue"
          value={totalRevenue !== null ? currency.format(totalRevenue) : '\u2014'}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Avg ZAR/Hr"
          value={avgZarPerHr !== null ? currency.format(avgZarPerHr) : '\u2014'}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          title="Cash on Hand"
          value={cashOnHand !== null ? currency.format(cashOnHand) : '\u2014'}
          icon={<Banknote className="h-5 w-5" />}
          change={latestCashTrend !== null ? {
            value: Math.abs(latestCashTrend),
            direction: latestCashTrend >= 0 ? 'up' : 'down',
          } : undefined}
        />
        <StatCard
          title="Outstanding Invoices"
          value={outstandingInvoices !== null ? String(outstandingInvoices) : '\u2014'}
          icon={<FileText className="h-5 w-5" />}
          change={outstandingInvoices !== null && outstandingInvoices > 0 ? {
            value: outstandingInvoices,
            direction: 'down',
          } : undefined}
        />
        <StatCard
          title="Utilization Rate"
          value={utilizationRate !== null ? `${utilizationRate.toFixed(0)}%` : '\u2014'}
          icon={<BarChart3 className="h-5 w-5" />}
          change={utilizationRate !== null ? {
            value: utilizationRate,
            direction: utilizationRate >= 70 ? 'up' : 'down',
          } : undefined}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Dashboard Grid (2-column on desktop)                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Revenue Trend mini-chart */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-surface-900">Revenue Trend</h2>
            <Badge variant="default" size="md">
              {selectedQuarter === 'YTD' ? 'Last 6 months' : selectedQuarter}
            </Badge>
          </div>
          {filteredTrend.length === 0 ? (
            <p className="text-sm text-surface-400 py-4">No revenue data available.</p>
          ) : (
            <div className="space-y-1.5">
              {filteredTrend.map((entry) => {
                const pct = maxRevenue > 0 ? (entry.revenue / maxRevenue) * 100 : 0;
                return (
                  <div key={entry.period} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-xs font-medium text-surface-500 text-right">
                      {formatMonthLabel(entry.period)}
                    </span>
                    <div className="flex-1 h-5 rounded bg-surface-100 overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-300"
                        style={{
                          width: `${Math.max(pct, 2)}%`,
                          backgroundColor: colors.primary[500],
                        }}
                        title={currency.format(entry.revenue)}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-xs font-medium text-surface-600 text-right tabular-nums">
                      {currency.format(entry.revenue)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Right: Cash Position summary */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-surface-900">Cash Position</h2>
            {cashOnHand !== null && (
              <span
                className="text-lg font-bold tabular-nums"
                style={{ color: cashOnHand >= 0 ? colors.success[600] : colors.danger[600] }}
              >
                {currency.format(cashOnHand)}
              </span>
            )}
          </div>
          {trendData.length === 0 ? (
            <p className="text-sm text-surface-400 py-4">No cash data available.</p>
          ) : (
            <div className="space-y-1.5">
              {trendData.slice(-6).map((entry) => {
                const cash = entry.cash_on_hand ?? 0;
                const maxCash = Math.max(...trendData.slice(-6).map((e) => Math.abs(e.cash_on_hand ?? 0)));
                const pct = maxCash > 0 ? (Math.abs(cash) / maxCash) * 100 : 0;
                const isPositive = cash >= 0;

                return (
                  <div key={entry.period} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-xs font-medium text-surface-500 text-right">
                      {formatMonthLabel(entry.period)}
                    </span>
                    <div className="flex-1 h-5 rounded bg-surface-100 overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-300"
                        style={{
                          width: `${Math.max(pct, 2)}%`,
                          backgroundColor: isPositive ? colors.success[500] : colors.danger[500],
                        }}
                        title={currency.format(cash)}
                      />
                    </div>
                    <span
                      className="w-24 shrink-0 text-xs font-medium text-right tabular-nums"
                      style={{ color: isPositive ? colors.success[700] : colors.danger[700] }}
                    >
                      {currency.format(cash)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Left (row 2): Top 5 Clients by Value */}
        <Card>
          <h2 className="text-base font-semibold text-surface-900 mb-4">Top 5 Clients by Value</h2>
          {topClients.length === 0 ? (
            <p className="text-sm text-surface-400 py-4">No client data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="py-2 pr-4 text-left font-medium text-surface-500">Client</th>
                    <th className="py-2 px-4 text-right font-medium text-surface-500">Revenue</th>
                    <th className="py-2 px-4 text-right font-medium text-surface-500">Hours</th>
                    <th className="py-2 pl-4 text-right font-medium text-surface-500">ZAR/Hr</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.map((client, idx) => (
                    <tr
                      key={client.client_id}
                      className={idx < topClients.length - 1 ? 'border-b border-surface-100' : ''}
                    >
                      <td className="py-2 pr-4 font-medium text-surface-800 truncate max-w-[160px]">
                        {client.client_name}
                      </td>
                      <td className="py-2 px-4 text-right tabular-nums text-surface-700">
                        {currency.format(client.total_revenue)}
                      </td>
                      <td className="py-2 px-4 text-right tabular-nums text-surface-600">
                        {client.total_hours}h
                      </td>
                      <td className="py-2 pl-4 text-right tabular-nums text-surface-600">
                        {currency.format(client.zar_per_hour)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Right (row 2): Volume-Rate Quadrant Counts */}
        <Card>
          <h2 className="text-base font-semibold text-surface-900 mb-4">Volume vs Rate</h2>
          {quadrants === null ? (
            <p className="text-sm text-surface-400 py-4">No volume-rate data available.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* High Volume / High Rate */}
              <div
                className="rounded-lg p-4 text-center"
                style={{
                  backgroundColor: colors.success[50],
                  borderLeft: `3px solid ${colors.success[500]}`,
                }}
              >
                <p className="text-2xl font-bold" style={{ color: colors.success[700] }}>
                  {quadrants.high_volume_high_rate}
                </p>
                <p className="text-xs font-medium text-surface-500 mt-1">Stars</p>
              </div>
              {/* Low Volume / High Rate */}
              <div
                className="rounded-lg p-4 text-center"
                style={{
                  backgroundColor: colors.primary[50],
                  borderLeft: `3px solid ${colors.primary[500]}`,
                }}
              >
                <p className="text-2xl font-bold" style={{ color: colors.primary[700] }}>
                  {quadrants.low_volume_high_rate}
                </p>
                <p className="text-xs font-medium text-surface-500 mt-1">Efficient</p>
              </div>
              {/* High Volume / Low Rate */}
              <div
                className="rounded-lg p-4 text-center"
                style={{
                  backgroundColor: colors.danger[50],
                  borderLeft: `3px solid ${colors.danger[500]}`,
                }}
              >
                <p className="text-2xl font-bold" style={{ color: colors.danger[700] }}>
                  {quadrants.high_volume_low_rate}
                </p>
                <p className="text-xs font-medium text-surface-500 mt-1">Compression Risk</p>
              </div>
              {/* Low Volume / Low Rate */}
              <div
                className="rounded-lg p-4 text-center"
                style={{
                  backgroundColor: colors.warning[50],
                  borderLeft: `3px solid ${colors.warning[500]}`,
                }}
              >
                <p className="text-2xl font-bold" style={{ color: colors.warning[700] }}>
                  {quadrants.low_volume_low_rate}
                </p>
                <p className="text-xs font-medium text-surface-500 mt-1">Review Needed</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Quick Links                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <h2 className="text-lg font-semibold text-surface-900 mb-4">Detailed Reports</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLinkCard
            to="/finances/revenue"
            title="Revenue Tracking"
            description="QoQ growth, monthly trends, and period comparison."
            icon={<TrendingUp className="h-5 w-5" />}
            color={colors.primary[500]}
          />
          <QuickLinkCard
            to="/finances/cost-benefit"
            title="Cost-Benefit"
            description="Client ZAR/hr rankings and profitability analysis."
            icon={<Users className="h-5 w-5" />}
            color={colors.accent[500]}
          />
          <QuickLinkCard
            to="/finances/cash"
            title="Cash Position"
            description="Cash on hand, receivables, and trend history."
            icon={<Banknote className="h-5 w-5" />}
            color={colors.success[500]}
          />
          <QuickLinkCard
            to="/finances/volume-rate"
            title="Volume vs Rate"
            description="Client quadrant classification by hours and rate."
            icon={<Grid3X3 className="h-5 w-5" />}
            color={colors.secondary[500]}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  QuickLinkCard                                                              */
/* -------------------------------------------------------------------------- */

function QuickLinkCard({
  to,
  title,
  description,
  icon,
  color,
}: {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Link to={to} className="block group">
      <Card className="h-full transition-all duration-200 group-hover:shadow-md">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-surface-900 group-hover:text-primary-600 transition-colors">
                {title}
              </p>
              <ArrowRight className="h-4 w-4 text-surface-300 group-hover:text-primary-500 transition-colors" />
            </div>
            <p className="mt-1 text-xs text-surface-500 leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
