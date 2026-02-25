import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  Activity,
  DollarSign,
  ClipboardCheck,
  Heart,
  ArrowRight,
  Download,
  Sparkles,
  Copy,
  Check,
  GitCompareArrows,
} from 'lucide-react';
import { Card, Button, Modal } from '../components/ui';
import { colors } from '../styles/tokens';
import apiClient from '../lib/api';

/* -------------------------------------------------------------------------- */
/*  Report card definitions                                                    */
/* -------------------------------------------------------------------------- */

interface ReportCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  to: string;
}

const REPORT_CARDS: ReportCard[] = [
  {
    title: 'Health & Vitality',
    description:
      'Comprehensive report combining operational efficiency, financial performance, and process quality with overall health score.',
    icon: <Heart className="h-6 w-6" />,
    color: colors.danger[500],
    to: '/reports/health',
  },
  {
    title: 'Period Comparison',
    description:
      'Side-by-side quarter or year-to-date comparison with trend arrows, delta badges, and improvements summary.',
    icon: <GitCompareArrows className="h-6 w-6" />,
    color: colors.primary[500],
    to: '/reports/comparison',
  },
  {
    title: 'Operational Efficiency',
    description:
      'Utilization rate, time allocation by partner group, saturation leaderboards, and productivity score.',
    icon: <Activity className="h-6 w-6" />,
    color: colors.accent[500],
    to: '/reports/health',
  },
  {
    title: 'Financial Performance',
    description:
      'Revenue growth, cost-benefit analysis, cash position, and pass-through summary.',
    icon: <DollarSign className="h-6 w-6" />,
    color: colors.success[500],
    to: '/reports/health',
  },
  {
    title: 'Process Quality',
    description:
      'Task completion rates, overdue tracking, meeting-to-action ratio, and time entry consistency.',
    icon: <ClipboardCheck className="h-6 w-6" />,
    color: colors.warning[500],
    to: '/reports/health',
  },
];

/* -------------------------------------------------------------------------- */
/*  Period quick selector                                                      */
/* -------------------------------------------------------------------------- */

type QuickPeriod = 'this_quarter' | 'last_quarter' | 'ytd';

const QUICK_PERIODS: { key: QuickPeriod; label: string }[] = [
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'last_quarter', label: 'Last Quarter' },
  { key: 'ytd', label: 'Year to Date' },
];

function getQuarterRange(offset: number): { start: string; end: string } {
  const now = new Date();
  const currentQ = Math.floor(now.getMonth() / 3);
  const targetQ = currentQ + offset;
  const year = now.getFullYear();
  const qStart = new Date(year, targetQ * 3, 1);
  const qEnd =
    offset === 0
      ? now
      : new Date(year, (targetQ + 1) * 3, 0); // last day of quarter
  return {
    start: toISODate(qStart),
    end: toISODate(qEnd),
  };
}

function getYTDRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: `${now.getFullYear()}-01-01`,
    end: toISODate(now),
  };
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getPeriodRange(period: QuickPeriod): { start: string; end: string } {
  switch (period) {
    case 'this_quarter':
      return getQuarterRange(0);
    case 'last_quarter':
      return getQuarterRange(-1);
    case 'ytd':
      return getYTDRange();
  }
}

function periodToQuery(period: QuickPeriod): string {
  const range = getPeriodRange(period);
  return `?period_start=${range.start}&period_end=${range.end}`;
}

/* -------------------------------------------------------------------------- */
/*  ReportsPage                                                                */
/* -------------------------------------------------------------------------- */

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<QuickPeriod>('this_quarter');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExport = async (format: 'text' | 'summary') => {
    setExportLoading(true);
    setExportContent('');
    setExportModalOpen(true);
    setCopied(false);

    try {
      const range = getPeriodRange(selectedPeriod);
      const res = await apiClient.get<{ success: boolean; content: string; format: string }>(
        `/reports/export?period_start=${range.start}&period_end=${range.end}&format=${format}`,
      );
      if (res.success) {
        setExportContent(res.content);
      } else {
        setExportContent('Failed to generate export. Please try again.');
      }
    } catch {
      setExportContent('Failed to generate export. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="animate-up flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">Health &amp; Vitality Reports</h1>
          <p className="text-body mt-1">
            Business health dashboards combining operational efficiency, financial performance, and process quality.
          </p>
        </div>
      </div>

      {/* Quick period selector + export buttons */}
      <div className="mt-6 animate-up" style={{ animationDelay: '100ms' }}>
        <Card padding="md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-surface-600 mb-3">Quick Period</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PERIODS.map((p) => (
                  <Button
                    key={p.key}
                    variant={selectedPeriod === p.key ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSelectedPeriod(p.key)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-surface-600 mb-3">Export Report</p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExport('text')}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Text
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExport('summary')}
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  AI Summary
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Report cards grid */}
      <div
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-up"
        style={{ animationDelay: '200ms' }}
      >
        {REPORT_CARDS.map((card) => (
          <Link
            key={card.title}
            to={`${card.to}${periodToQuery(selectedPeriod)}`}
            className="block group"
          >
            <Card className="h-full transition-all duration-200 group-hover:shadow-md">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${card.color}15`, color: card.color }}
                >
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-surface-900 group-hover:text-primary-600 transition-colors">
                      {card.title}
                    </h2>
                    <ArrowRight className="h-4 w-4 text-surface-300 group-hover:text-primary-500 transition-colors shrink-0 ml-2" />
                  </div>
                  <p className="mt-1 text-sm text-surface-500 leading-relaxed">
                    {card.description}
                  </p>
                  <span className="mt-3 inline-block text-sm font-medium text-primary-600 group-hover:text-primary-700">
                    View Report
                  </span>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Export modal */}
      <Modal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export Report"
        size="lg"
      >
        {exportLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <span className="ml-3 text-sm text-surface-600">Generating report...</span>
          </div>
        ) : (
          <div>
            <div className="flex justify-end mb-2">
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1.5 text-success-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <textarea
              readOnly
              value={exportContent}
              rows={18}
              className="w-full rounded-lg border border-surface-200 bg-surface-50 p-4 text-sm font-mono text-surface-700 focus:outline-none resize-y"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
