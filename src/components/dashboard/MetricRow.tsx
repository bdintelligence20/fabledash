import { TrendingUp, Activity, Users, Wallet } from 'lucide-react';
import { StatCard } from '../ui';

interface MetricData {
  revenue?: number | null;
  utilization?: number | null;
  activeClients?: number | null;
  cashPosition?: number | null;
}

interface MetricRowProps {
  data?: MetricData;
  loading?: boolean;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '\u2014';
  return value.toLocaleString('en-ZA', { maximumFractionDigits: 0 });
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return '\u2014';
  return `${Math.round(value)}%`;
}

function formatCount(value: number | null | undefined): string {
  if (value == null) return '\u2014';
  return String(value);
}

export function MetricRow({ data, loading = false }: MetricRowProps) {
  const metrics = [
    {
      title: 'Monthly Revenue',
      value: formatCurrency(data?.revenue),
      prefix: data?.revenue != null ? 'R ' : '',
      icon: <TrendingUp className="h-5 w-5" />,
    },
    {
      title: 'Utilization Rate',
      value: formatPercent(data?.utilization),
      icon: <Activity className="h-5 w-5" />,
    },
    {
      title: 'Active Clients',
      value: formatCount(data?.activeClients),
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: 'Cash Position',
      value: formatCurrency(data?.cashPosition),
      prefix: data?.cashPosition != null ? 'R ' : '',
      icon: <Wallet className="h-5 w-5" />,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <StatCard
          key={metric.title}
          title={metric.title}
          value={metric.value}
          prefix={metric.prefix}
          icon={metric.icon}
          loading={loading}
        />
      ))}
    </div>
  );
}
