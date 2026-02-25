import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  Activity,
  DollarSign,
  ClipboardCheck,
  Heart,
  ArrowRight,
} from 'lucide-react';
import { Card, Button } from '../components/ui';
import { colors } from '../styles/tokens';

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
    title: 'Operational Efficiency',
    description:
      'Utilization rate, time allocation by partner group, saturation leaderboards, and productivity score.',
    icon: <Activity className="h-6 w-6" />,
    color: colors.primary[500],
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
    color: colors.accent[500],
    to: '/reports/health',
  },
  {
    title: 'Full Health & Vitality',
    description:
      'Comprehensive report combining operational efficiency, financial performance, and process quality with overall health score.',
    icon: <Heart className="h-6 w-6" />,
    color: colors.danger[500],
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

function periodToQuery(period: QuickPeriod): string {
  let range: { start: string; end: string };
  switch (period) {
    case 'this_quarter':
      range = getQuarterRange(0);
      break;
    case 'last_quarter':
      range = getQuarterRange(-1);
      break;
    case 'ytd':
      range = getYTDRange();
      break;
  }
  return `?period_start=${range.start}&period_end=${range.end}`;
}

/* -------------------------------------------------------------------------- */
/*  ReportsPage                                                                */
/* -------------------------------------------------------------------------- */

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<QuickPeriod>('this_quarter');

  return (
    <div>
      {/* Page header */}
      <div className="animate-up">
        <h1 className="text-2xl font-bold text-heading">Health &amp; Vitality Reports</h1>
        <p className="text-body mt-1">
          Business health dashboards combining operational efficiency, financial performance, and process quality.
        </p>
      </div>

      {/* Quick period selector */}
      <div className="mt-6 animate-up" style={{ animationDelay: '100ms' }}>
        <Card padding="md">
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
        </Card>
      </div>

      {/* Report cards grid */}
      <div
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 animate-up"
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
    </div>
  );
}
