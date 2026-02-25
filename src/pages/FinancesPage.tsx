import { useEffect, useState, useRef, type ChangeEvent } from 'react';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  BarChart3,
  RefreshCw,
  Upload,
  Trash2,
  ExternalLink,
  Unplug,
} from 'lucide-react';
import {
  StatCard,
  Card,
  Badge,
  Table,
  Button,
  Tabs,
  Spinner,
} from '../components/ui';
import { apiClient } from '../lib/api';
import { currency } from '../styles/tokens';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface FinancialSummary {
  snapshot: Record<string, unknown> | null;
  invoices: {
    total: number;
    paid: number;
    outstanding: number;
    overdue: number;
    total_revenue: number;
    total_outstanding_amount: number;
  };
  pnl: {
    id: string;
    filename: string;
    period: string;
    row_count: number;
    uploaded_at: string;
  } | null;
  forecast: {
    id: string;
    filename: string;
    forecast_date: string;
    entry_count: number;
    uploaded_at: string;
  } | null;
  sage_connected: boolean;
}

interface SageStatus {
  connected: boolean;
  last_sync: string | null;
}

interface PnlUploadSummary {
  id: string;
  filename: string;
  period: string;
  row_count: number;
  uploaded_at: string;
}

interface ForecastSummary {
  id: string;
  filename: string;
  forecast_date: string;
  entry_count: number;
  uploaded_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  amount: number;
  currency: string;
  issued_date: string;
  due_date: string;
  client_id: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'primary' | 'success' | 'danger' | 'warning'> = {
  draft: 'default',
  sent: 'primary',
  paid: 'success',
  overdue: 'danger',
  void: 'default',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '\u2014';
  try {
    return new Date(iso).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/* -------------------------------------------------------------------------- */
/*  FinancesPage                                                               */
/* -------------------------------------------------------------------------- */

export default function FinancesPage() {
  // Data state
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [sageStatus, setSageStatus] = useState<SageStatus | null>(null);
  const [pnlUploads, setPnlUploads] = useState<PnlUploadSummary[]>([]);
  const [forecasts, setForecasts] = useState<ForecastSummary[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Loading state
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [sageLoading, setSageLoading] = useState(true);
  const [pnlLoading, setPnlLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(true);

  // Upload state
  const [pnlFile, setPnlFile] = useState<File | null>(null);
  const [pnlPeriod, setPnlPeriod] = useState('');
  const [pnlUploading, setPnlUploading] = useState(false);
  const [pnlFeedback, setPnlFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [forecastFile, setForecastFile] = useState<File | null>(null);
  const [forecastUploading, setForecastUploading] = useState(false);
  const [forecastFeedback, setForecastFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sage action state
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState('sage');

  // File input refs
  const pnlInputRef = useRef<HTMLInputElement>(null);
  const forecastInputRef = useRef<HTMLInputElement>(null);

  /* ---------------------------------------------------------------------- */
  /*  Data fetching                                                          */
  /* ---------------------------------------------------------------------- */

  async function fetchSummary() {
    setSummaryLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<FinancialSummary>>('/financial-data/summary');
      setSummary(res.data);
    } catch {
      // Silently handle — stat cards will show "—"
    } finally {
      setSummaryLoading(false);
    }
  }

  async function fetchSageStatus() {
    setSageLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<SageStatus>>('/sage/status');
      setSageStatus(res.data);
    } catch {
      // Silently handle
    } finally {
      setSageLoading(false);
    }
  }

  async function fetchPnlUploads() {
    setPnlLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<PnlUploadSummary[]>>('/financial/pnl');
      setPnlUploads(res.data);
    } catch {
      // Silently handle
    } finally {
      setPnlLoading(false);
    }
  }

  async function fetchForecasts() {
    setForecastLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<ForecastSummary[]>>('/financial/forecast');
      setForecasts(res.data);
    } catch {
      // Silently handle
    } finally {
      setForecastLoading(false);
    }
  }

  async function fetchInvoices() {
    setInvoicesLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<Invoice[]>>('/sage/invoices?limit=20');
      setInvoices(res.data);
    } catch {
      // Silently handle
    } finally {
      setInvoicesLoading(false);
    }
  }

  useEffect(() => {
    fetchSummary();
    fetchSageStatus();
    fetchPnlUploads();
    fetchForecasts();
    fetchInvoices();
  }, []);

  /* ---------------------------------------------------------------------- */
  /*  Sage actions                                                           */
  /* ---------------------------------------------------------------------- */

  async function handleConnectSage() {
    try {
      const res = await apiClient.get<ApiResponse<{ authorization_url: string }>>('/sage/connect');
      window.open(res.data.authorization_url, '_blank');
    } catch (err) {
      // Error is already in console
    }
  }

  async function handleSyncSage() {
    setSyncing(true);
    try {
      await apiClient.post('/sage/sync?full=false');
      // Refresh data after sync
      await Promise.all([fetchSummary(), fetchInvoices()]);
    } catch {
      // Silently handle
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnectSage() {
    setDisconnecting(true);
    try {
      await apiClient.post('/sage/disconnect');
      setSageStatus({ connected: false, last_sync: null });
      await fetchSummary();
    } catch {
      // Silently handle
    } finally {
      setDisconnecting(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  P&L upload                                                             */
  /* ---------------------------------------------------------------------- */

  function handlePnlFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPnlFile(file);
    setPnlFeedback(null);
  }

  async function handlePnlUpload() {
    if (!pnlFile) return;

    setPnlUploading(true);
    setPnlFeedback(null);

    try {
      const formData = new FormData();
      formData.append('file', pnlFile);
      if (pnlPeriod) {
        formData.append('period', pnlPeriod);
      }

      await apiClient.post('/financial/pnl', formData);
      setPnlFeedback({ type: 'success', message: 'P&L report uploaded successfully.' });
      setPnlFile(null);
      setPnlPeriod('');
      if (pnlInputRef.current) pnlInputRef.current.value = '';
      await fetchPnlUploads();
      await fetchSummary();
    } catch (err) {
      setPnlFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Upload failed.',
      });
    } finally {
      setPnlUploading(false);
    }
  }

  async function handleDeletePnl(uploadId: string) {
    try {
      await apiClient.delete(`/financial/pnl/${uploadId}`);
      await fetchPnlUploads();
    } catch {
      // Silently handle
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Forecast upload                                                        */
  /* ---------------------------------------------------------------------- */

  function handleForecastFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setForecastFile(file);
    setForecastFeedback(null);
  }

  async function handleForecastUpload() {
    if (!forecastFile) return;

    setForecastUploading(true);
    setForecastFeedback(null);

    try {
      const formData = new FormData();
      formData.append('file', forecastFile);

      await apiClient.post('/financial/forecast', formData);
      setForecastFeedback({ type: 'success', message: 'Forecast uploaded successfully.' });
      setForecastFile(null);
      if (forecastInputRef.current) forecastInputRef.current.value = '';
      await fetchForecasts();
      await fetchSummary();
    } catch (err) {
      setForecastFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Upload failed.',
      });
    } finally {
      setForecastUploading(false);
    }
  }

  async function handleDeleteForecast(forecastId: string) {
    try {
      await apiClient.delete(`/financial/forecast/${forecastId}`);
      await fetchForecasts();
    } catch {
      // Silently handle
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Computed values                                                        */
  /* ---------------------------------------------------------------------- */

  const totalRevenue = summary?.invoices.total_revenue ?? null;
  const totalOutstanding = summary?.invoices.total_outstanding_amount ?? null;
  const cashOnHand = summary?.snapshot
    ? (summary.snapshot.cash_on_hand as number | null)
    : null;
  const netProfit = summary?.snapshot
    ? (summary.snapshot.net_profit as number | null)
    : null;

  const dataTabs = [
    { id: 'sage', label: 'Sage Connection' },
    { id: 'pnl', label: 'P&L Reports' },
    { id: 'forecasts', label: 'Revenue Forecasts' },
  ];

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Financial Performance</h1>
        <p className="mt-1 text-sm text-surface-500">
          Revenue, expenses, and financial health metrics.
        </p>
      </div>

      {/* Section 1: Financial Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={totalRevenue !== null ? currency.format(totalRevenue) : '\u2014'}
          icon={<DollarSign className="h-5 w-5" />}
          loading={summaryLoading}
        />
        <StatCard
          title="Total Outstanding"
          value={totalOutstanding !== null ? currency.format(totalOutstanding) : '\u2014'}
          icon={<CreditCard className="h-5 w-5" />}
          loading={summaryLoading}
        />
        <StatCard
          title="Cash on Hand"
          value={cashOnHand !== null ? currency.format(cashOnHand) : '\u2014'}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={summaryLoading}
        />
        <StatCard
          title="Net Profit"
          value={netProfit !== null ? currency.format(netProfit) : '\u2014'}
          icon={<BarChart3 className="h-5 w-5" />}
          loading={summaryLoading}
        />
      </div>

      {/* Section 2: Data Sources (tabbed panel) */}
      <Card padding="none">
        <div className="px-6 pt-4">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">Data Sources</h2>
          <Tabs tabs={dataTabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <div className="p-6">
          {/* Tab: Sage Connection */}
          {activeTab === 'sage' && (
            <div className="space-y-4">
              {sageLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size="lg" />
                </div>
              ) : sageStatus?.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="success" dot size="md">Connected</Badge>
                    {sageStatus.last_sync && (
                      <span className="text-sm text-surface-500">
                        Last synced: {formatDate(sageStatus.last_sync)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-surface-600">
                    Sage Business Cloud Accounting is linked to FableDash. Invoices and
                    payments are synced automatically.
                  </p>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<RefreshCw className="h-4 w-4" />}
                      loading={syncing}
                      onClick={handleSyncSage}
                    >
                      Sync Now
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Unplug className="h-4 w-4" />}
                      loading={disconnecting}
                      onClick={handleDisconnectSage}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="warning" dot size="md">Not Connected</Badge>
                  </div>
                  <p className="text-sm text-surface-600">
                    Connect Sage Business Cloud Accounting to automatically sync invoices,
                    payments, and financial snapshots.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<ExternalLink className="h-4 w-4" />}
                    onClick={handleConnectSage}
                  >
                    Connect Sage
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Tab: P&L Reports */}
          {activeTab === 'pnl' && (
            <div className="space-y-6">
              {/* Upload form */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-surface-700">Upload P&L Report</h3>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs text-surface-500 mb-1">File (CSV or Excel)</label>
                    <input
                      ref={pnlInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handlePnlFileChange}
                      className="block text-sm text-surface-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100 file:cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-surface-500 mb-1">Period</label>
                    <input
                      type="month"
                      value={pnlPeriod}
                      onChange={(e) => setPnlPeriod(e.target.value)}
                      className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm text-surface-900 focus:ring-focus focus:border-primary-500"
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Upload className="h-4 w-4" />}
                    loading={pnlUploading}
                    disabled={!pnlFile}
                    onClick={handlePnlUpload}
                  >
                    Upload
                  </Button>
                </div>
                {pnlFeedback && (
                  <div
                    className={`rounded-lg px-4 py-3 text-sm ${
                      pnlFeedback.type === 'success'
                        ? 'bg-success-50 text-success-700'
                        : 'bg-danger-50 text-danger-700'
                    }`}
                  >
                    {pnlFeedback.message}
                  </div>
                )}
              </div>

              {/* Uploads table */}
              {pnlLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : pnlUploads.length === 0 ? (
                <p className="text-sm text-surface-400 py-4">No P&L reports uploaded yet.</p>
              ) : (
                <Table>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>Filename</Table.HeaderCell>
                      <Table.HeaderCell>Period</Table.HeaderCell>
                      <Table.HeaderCell>Rows</Table.HeaderCell>
                      <Table.HeaderCell>Uploaded</Table.HeaderCell>
                      <Table.HeaderCell>Actions</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {pnlUploads.map((upload) => (
                      <Table.Row key={upload.id}>
                        <Table.Cell className="font-medium">{upload.filename}</Table.Cell>
                        <Table.Cell>{upload.period}</Table.Cell>
                        <Table.Cell>{upload.row_count}</Table.Cell>
                        <Table.Cell>{formatDate(upload.uploaded_at)}</Table.Cell>
                        <Table.Cell>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 className="h-3.5 w-3.5" />}
                            onClick={() => handleDeletePnl(upload.id)}
                          >
                            Delete
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </div>
          )}

          {/* Tab: Revenue Forecasts */}
          {activeTab === 'forecasts' && (
            <div className="space-y-6">
              {/* Upload form */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-surface-700">Upload Revenue Forecast</h3>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs text-surface-500 mb-1">File (CSV or Excel)</label>
                    <input
                      ref={forecastInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleForecastFileChange}
                      className="block text-sm text-surface-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100 file:cursor-pointer"
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Upload className="h-4 w-4" />}
                    loading={forecastUploading}
                    disabled={!forecastFile}
                    onClick={handleForecastUpload}
                  >
                    Upload
                  </Button>
                </div>
                {forecastFeedback && (
                  <div
                    className={`rounded-lg px-4 py-3 text-sm ${
                      forecastFeedback.type === 'success'
                        ? 'bg-success-50 text-success-700'
                        : 'bg-danger-50 text-danger-700'
                    }`}
                  >
                    {forecastFeedback.message}
                  </div>
                )}
              </div>

              {/* Forecasts table */}
              {forecastLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : forecasts.length === 0 ? (
                <p className="text-sm text-surface-400 py-4">No revenue forecasts uploaded yet.</p>
              ) : (
                <Table>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>Filename</Table.HeaderCell>
                      <Table.HeaderCell>Forecast Date</Table.HeaderCell>
                      <Table.HeaderCell>Entries</Table.HeaderCell>
                      <Table.HeaderCell>Uploaded</Table.HeaderCell>
                      <Table.HeaderCell>Actions</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {forecasts.map((fc) => (
                      <Table.Row key={fc.id}>
                        <Table.Cell className="font-medium">{fc.filename}</Table.Cell>
                        <Table.Cell>{formatDate(fc.forecast_date)}</Table.Cell>
                        <Table.Cell>{fc.entry_count}</Table.Cell>
                        <Table.Cell>{formatDate(fc.uploaded_at)}</Table.Cell>
                        <Table.Cell>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 className="h-3.5 w-3.5" />}
                            onClick={() => handleDeleteForecast(fc.id)}
                          >
                            Delete
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Section 3: Recent Invoices */}
      <Card padding="none">
        <Card.Header>
          <h2 className="text-lg font-semibold text-surface-900">Recent Invoices</h2>
        </Card.Header>
        <div className="p-0">
          {invoicesLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-surface-400">
              <p className="text-sm">
                Connect Sage to see invoices, or upload P&L reports manually.
              </p>
            </div>
          ) : (
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Invoice #</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Amount</Table.HeaderCell>
                  <Table.HeaderCell>Issued</Table.HeaderCell>
                  <Table.HeaderCell>Due</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {invoices.map((inv) => (
                  <Table.Row key={inv.id}>
                    <Table.Cell className="font-medium">{inv.invoice_number}</Table.Cell>
                    <Table.Cell>
                      <Badge variant={STATUS_BADGE_VARIANT[inv.status] ?? 'default'}>
                        {inv.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{currency.format(inv.amount)}</Table.Cell>
                    <Table.Cell>{formatDate(inv.issued_date)}</Table.Cell>
                    <Table.Cell>{formatDate(inv.due_date)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
