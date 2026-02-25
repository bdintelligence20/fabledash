import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ArrowDownRight, ArrowUpRight, BarChart3 } from 'lucide-react';
import { StatCard, Card, Badge, Spinner } from '../components/ui';
import { apiClient } from '../lib/api';
import { currency, colors } from '../styles/tokens';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface TrendEntry {
  period: string;   // "YYYY-MM"
  revenue: number;
  expenses: number;
  net_profit: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Map a YYYY-MM period string to its calendar quarter (1-4). */
function monthToQuarter(month: number): number {
  return Math.ceil(month / 3);
}

/** Format YYYY-MM to a short month label like "Jan '26". */
function formatMonthLabel(period: string): string {
  const [yearStr, monthStr] = period.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = parseInt(monthStr, 10) - 1;
  const shortYear = yearStr.slice(2);
  return `${monthNames[monthIndex]} '${shortYear}`;
}

/** Group trend entries by quarter. Returns entries keyed by "YYYY-QN". */
function groupByQuarter(entries: TrendEntry[]): Record<string, TrendEntry[]> {
  const groups: Record<string, TrendEntry[]> = {};
  for (const entry of entries) {
    const [yearStr, monthStr] = entry.period.split('-');
    const q = monthToQuarter(parseInt(monthStr, 10));
    const key = `${yearStr}-Q${q}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }
  return groups;
}

/** Summarise a set of entries into totals for a quarter. */
function quarterTotals(entries: TrendEntry[]): { revenue: number; expenses: number; netProfit: number } {
  let revenue = 0;
  let expenses = 0;
  let netProfit = 0;
  for (const e of entries) {
    revenue += e.revenue;
    expenses += e.expenses;
    netProfit += e.net_profit;
  }
  return { revenue, expenses, netProfit };
}

/* -------------------------------------------------------------------------- */
/*  RevenueTrackingPage                                                        */
/* -------------------------------------------------------------------------- */

export default function RevenueTrackingPage() {
  const [trendData, setTrendData] = useState<TrendEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrend() {
      setLoading(true);
      try {
        const res = await apiClient.get<ApiResponse<TrendEntry[]>>(
          '/financial-data/revenue-trend?months=12',
        );
        setTrendData(res.data);
      } catch {
        // Silently handle — sections will show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchTrend();
  }, []);

  /* ---------------------------------------------------------------------- */
  /*  Derived data                                                           */
  /* ---------------------------------------------------------------------- */

  // Quarter grouping
  const quarterGroups = groupByQuarter(trendData);
  const quarterKeys = Object.keys(quarterGroups).sort();

  const currentQKey = quarterKeys.length > 0 ? quarterKeys[quarterKeys.length - 1] : null;
  const prevQKey = quarterKeys.length > 1 ? quarterKeys[quarterKeys.length - 2] : null;

  const currentQ = currentQKey ? quarterTotals(quarterGroups[currentQKey]) : null;
  const prevQ = prevQKey ? quarterTotals(quarterGroups[prevQKey]) : null;

  // QoQ growth rate
  let qoqGrowth: number | null = null;
  if (currentQ && prevQ && prevQ.revenue !== 0) {
    qoqGrowth = ((currentQ.revenue - prevQ.revenue) / prevQ.revenue) * 100;
  }

  // Bar chart max value (for proportional widths)
  const maxMonthValue = trendData.reduce((max, e) => {
    const total = e.revenue + e.expenses;
    return total > max ? total : max;
  }, 0);

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                 */
  /* ---------------------------------------------------------------------- */

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
        <h1 className="text-2xl font-bold text-surface-900">Revenue Tracking</h1>
        <p className="mt-1 text-sm text-surface-500">
          Quarter-over-quarter growth, monthly trends, and period comparison.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Section 1: Revenue Growth Rate                                     */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <div className="flex flex-col items-center text-center py-2">
          <p className="text-sm font-medium text-surface-500 uppercase tracking-wide">
            Quarter over Quarter
          </p>
          {qoqGrowth !== null ? (
            <>
              <div className="mt-3 flex items-center gap-3">
                {qoqGrowth >= 0 ? (
                  <TrendingUp
                    className="h-8 w-8"
                    style={{ color: colors.success[500] }}
                  />
                ) : (
                  <TrendingDown
                    className="h-8 w-8"
                    style={{ color: colors.danger[500] }}
                  />
                )}
                <span
                  className="text-4xl font-bold"
                  style={{ color: qoqGrowth >= 0 ? colors.success[600] : colors.danger[600] }}
                >
                  {qoqGrowth >= 0 ? '+' : ''}{qoqGrowth.toFixed(1)}%
                </span>
              </div>
              <p className="mt-2 text-sm text-surface-400">
                {currentQKey} vs {prevQKey}
              </p>
            </>
          ) : (
            <p className="mt-3 text-lg text-surface-400">
              Insufficient data to calculate growth rate.
            </p>
          )}
        </div>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/*  Section 2: Revenue Trend (horizontal bar chart)                    */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <h2 className="text-lg font-semibold text-surface-900 mb-6">Revenue Trend</h2>
        {trendData.length === 0 ? (
          <p className="text-sm text-surface-400 py-4">No trend data available.</p>
        ) : (
          <div className="space-y-2">
            {trendData.map((entry) => {
              const total = entry.revenue + entry.expenses;
              const pctTotal = maxMonthValue > 0 ? (total / maxMonthValue) * 100 : 0;
              const revPct = total > 0 ? (entry.revenue / total) * 100 : 0;
              const expPct = total > 0 ? (entry.expenses / total) * 100 : 0;

              return (
                <div key={entry.period} className="flex items-center gap-3">
                  {/* Month label */}
                  <span className="w-20 shrink-0 text-sm font-medium text-surface-600 text-right">
                    {formatMonthLabel(entry.period)}
                  </span>

                  {/* Bar */}
                  <div className="flex-1 h-7 rounded-md overflow-hidden bg-surface-100 relative">
                    <div
                      className="h-full flex rounded-md overflow-hidden transition-all duration-300"
                      style={{ width: `${pctTotal}%` }}
                    >
                      {/* Revenue segment */}
                      <div
                        className="h-full"
                        style={{
                          width: `${revPct}%`,
                          backgroundColor: colors.primary[500],
                        }}
                        title={`Revenue: ${currency.format(entry.revenue)}`}
                      />
                      {/* Expenses segment */}
                      <div
                        className="h-full"
                        style={{
                          width: `${expPct}%`,
                          backgroundColor: colors.danger[300],
                        }}
                        title={`Expenses: ${currency.format(entry.expenses)}`}
                      />
                    </div>
                  </div>

                  {/* Amount label */}
                  <span className="w-32 shrink-0 text-sm font-medium text-surface-700 text-right tabular-nums">
                    {currency.format(entry.revenue)}
                  </span>
                </div>
              );
            })}

            {/* Legend */}
            <div className="flex items-center gap-6 pt-4 border-t border-surface-100 mt-4">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: colors.primary[500] }}
                />
                <span className="text-xs text-surface-500">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: colors.danger[300] }}
                />
                <span className="text-xs text-surface-500">Expenses</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/*  Section 3: Period Comparison                                       */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <h2 className="text-lg font-semibold text-surface-900 mb-4">Period Comparison</h2>

        {!currentQ || !prevQ ? (
          <Card>
            <p className="text-sm text-surface-400 py-4">
              At least two quarters of data are needed for comparison.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Current Quarter */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-surface-800">
                  {currentQKey}
                </h3>
                <Badge variant="primary" size="md">Current</Badge>
              </div>
              <div className="space-y-4">
                <StatCard
                  title="Revenue"
                  value={currency.format(currentQ.revenue)}
                  icon={<DollarSign className="h-5 w-5" />}
                  change={prevQ.revenue !== 0 ? {
                    value: Math.abs(((currentQ.revenue - prevQ.revenue) / prevQ.revenue) * 100),
                    direction: currentQ.revenue >= prevQ.revenue ? 'up' : 'down',
                  } : undefined}
                />
                <StatCard
                  title="Expenses"
                  value={currency.format(currentQ.expenses)}
                  icon={<ArrowDownRight className="h-5 w-5" />}
                  change={prevQ.expenses !== 0 ? {
                    value: Math.abs(((currentQ.expenses - prevQ.expenses) / prevQ.expenses) * 100),
                    direction: currentQ.expenses <= prevQ.expenses ? 'up' : 'down',
                  } : undefined}
                />
                <StatCard
                  title="Net Profit"
                  value={currency.format(currentQ.netProfit)}
                  icon={<BarChart3 className="h-5 w-5" />}
                  change={prevQ.netProfit !== 0 ? {
                    value: Math.abs(((currentQ.netProfit - prevQ.netProfit) / prevQ.netProfit) * 100),
                    direction: currentQ.netProfit >= prevQ.netProfit ? 'up' : 'down',
                  } : undefined}
                />
              </div>
            </Card>

            {/* Previous Quarter */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-surface-800">
                  {prevQKey}
                </h3>
                <Badge variant="default" size="md">Previous</Badge>
              </div>
              <div className="space-y-4">
                <StatCard
                  title="Revenue"
                  value={currency.format(prevQ.revenue)}
                  icon={<DollarSign className="h-5 w-5" />}
                />
                <StatCard
                  title="Expenses"
                  value={currency.format(prevQ.expenses)}
                  icon={<ArrowDownRight className="h-5 w-5" />}
                />
                <StatCard
                  title="Net Profit"
                  value={currency.format(prevQ.netProfit)}
                  icon={<BarChart3 className="h-5 w-5" />}
                />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
