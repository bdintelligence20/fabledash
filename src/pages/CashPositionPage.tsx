import { useEffect, useState } from 'react';
import {
  Banknote,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
} from 'lucide-react';
import { StatCard, Card, Spinner } from '../components/ui';
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

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

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

/** Format an ISO date string to a readable date. */
function formatDate(iso: string | undefined | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/* -------------------------------------------------------------------------- */
/*  CashPositionPage                                                           */
/* -------------------------------------------------------------------------- */

export default function CashPositionPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [trendData, setTrendData] = useState<TrendEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [summaryRes, trendRes] = await Promise.all([
          apiClient.get<ApiResponse<SummaryData>>('/financial-data/summary'),
          apiClient.get<ApiResponse<TrendEntry[]>>(
            '/financial-data/revenue-trend?months=6',
          ),
        ]);
        setSummary(summaryRes.data);
        setTrendData(trendRes.data);
      } catch {
        // Silently handle — sections will show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  /* ---------------------------------------------------------------------- */
  /*  Derived data                                                           */
  /* ---------------------------------------------------------------------- */

  const snapshot = summary?.snapshot ?? null;
  const invoices = summary?.invoices ?? null;

  const cashOnHand = snapshot?.cash_on_hand ?? null;
  const accountsReceivable = snapshot?.accounts_receivable ?? null;
  const accountsPayable = snapshot?.accounts_payable ?? null;

  const netPosition =
    cashOnHand !== null && accountsReceivable !== null && accountsPayable !== null
      ? cashOnHand + accountsReceivable - accountsPayable
      : null;

  const snapshotDate = snapshot?.period_end ?? null;

  // Bar chart: find max absolute cash value for proportional scaling
  const maxAbsCash = trendData.reduce((max, entry) => {
    const abs = Math.abs(entry.cash_on_hand ?? 0);
    return abs > max ? abs : max;
  }, 0);

  const overdueCount = invoices?.overdue ?? 0;
  const hasOutstandingAR = accountsReceivable !== null && accountsReceivable > 0;

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
        <h1 className="text-2xl font-bold text-surface-900">Cash Position</h1>
        <p className="mt-1 text-sm text-surface-500">
          Current cash on hand, accounts overview, and historical cash trend.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Section 1: Current Cash Display                                    */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <div className="flex flex-col items-center text-center py-4">
          <p className="text-sm font-medium text-surface-500 uppercase tracking-wide">
            Current Cash on Hand
          </p>
          {cashOnHand !== null ? (
            <>
              <p
                className="mt-3 text-4xl font-bold tabular-nums"
                style={{
                  color: cashOnHand >= 0 ? colors.success[600] : colors.danger[600],
                }}
              >
                {currency.format(cashOnHand)}
              </p>
              {snapshotDate && (
                <p className="mt-2 text-sm text-surface-400">
                  As of {formatDate(snapshotDate)}
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-lg text-surface-400">
              No cash position data available. Connect Sage or upload financial reports.
            </p>
          )}
        </div>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/*  Section 2: Accounts Overview                                       */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <h2 className="text-lg font-semibold text-surface-900 mb-4">Accounts Overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Cash on Hand"
            value={cashOnHand !== null ? currency.format(cashOnHand) : '\u2014'}
            icon={<Banknote className="h-5 w-5" />}
          />
          <StatCard
            title="Accounts Receivable"
            value={accountsReceivable !== null ? currency.format(accountsReceivable) : '\u2014'}
            icon={<ArrowDownLeft className="h-5 w-5" />}
          />
          <StatCard
            title="Accounts Payable"
            value={accountsPayable !== null ? currency.format(accountsPayable) : '\u2014'}
            icon={<ArrowUpRight className="h-5 w-5" />}
          />
        </div>

        {netPosition !== null && (
          <Card className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-surface-600">
                Net Position (Cash + AR &minus; AP)
              </p>
              <p
                className="text-xl font-bold tabular-nums"
                style={{
                  color: netPosition >= 0 ? colors.success[600] : colors.danger[600],
                }}
              >
                {currency.format(netPosition)}
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Section 3: Cash Trend (bar chart)                                  */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <h2 className="text-lg font-semibold text-surface-900 mb-6">
          Cash Trend (Last 6 Months)
        </h2>
        {trendData.length === 0 ? (
          <p className="text-sm text-surface-400 py-4">No trend data available.</p>
        ) : trendData.length === 1 ? (
          <div className="text-center py-4">
            <p className="text-sm text-surface-500">
              Only one data point available ({formatMonthLabel(trendData[0].period)}).
            </p>
            <p
              className="mt-2 text-2xl font-bold tabular-nums"
              style={{
                color:
                  (trendData[0].cash_on_hand ?? 0) >= 0
                    ? colors.success[600]
                    : colors.danger[600],
              }}
            >
              {currency.format(trendData[0].cash_on_hand ?? 0)}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {trendData.map((entry) => {
              const cash = entry.cash_on_hand ?? 0;
              const pct = maxAbsCash > 0 ? (Math.abs(cash) / maxAbsCash) * 100 : 0;
              const isPositive = cash >= 0;

              return (
                <div key={entry.period} className="flex items-center gap-3">
                  {/* Month label */}
                  <span className="w-20 shrink-0 text-sm font-medium text-surface-600 text-right">
                    {formatMonthLabel(entry.period)}
                  </span>

                  {/* Bar */}
                  <div className="flex-1 h-7 rounded-md overflow-hidden bg-surface-100 relative">
                    <div
                      className="h-full rounded-md transition-all duration-300"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: isPositive
                          ? colors.success[500]
                          : colors.danger[500],
                      }}
                      title={`Cash on Hand: ${currency.format(cash)}`}
                    />
                  </div>

                  {/* Amount label */}
                  <span
                    className="w-32 shrink-0 text-sm font-medium text-right tabular-nums"
                    style={{
                      color: isPositive ? colors.success[700] : colors.danger[700],
                    }}
                  >
                    {currency.format(cash)}
                  </span>
                </div>
              );
            })}

            {/* Legend */}
            <div className="flex items-center gap-6 pt-4 border-t border-surface-100 mt-4">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: colors.success[500] }}
                />
                <span className="text-xs text-surface-500">Positive Cash</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: colors.danger[500] }}
                />
                <span className="text-xs text-surface-500">Negative Cash</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/*  Section 4: Outstanding Invoices Alert                              */}
      {/* ------------------------------------------------------------------ */}
      {hasOutstandingAR && (
        <Card
          className="border-l-4"
          style={{ borderLeftColor: colors.warning[500] }}
        >
          <div className="flex items-start gap-4">
            <div
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: colors.warning[100] }}
            >
              <AlertTriangle
                className="h-5 w-5"
                style={{ color: colors.warning[600] }}
              />
            </div>
            <div>
              <p className="text-base font-semibold text-surface-900">
                {currency.format(accountsReceivable!)} in Outstanding Receivables
              </p>
              <p className="mt-1 text-sm text-surface-500">
                {overdueCount > 0 ? (
                  <>
                    <span
                      className="font-semibold"
                      style={{ color: colors.danger[600] }}
                    >
                      {overdueCount} overdue
                    </span>
                    {' '}invoice{overdueCount !== 1 ? 's' : ''} require attention.
                  </>
                ) : (
                  'All outstanding invoices are within due date.'
                )}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
