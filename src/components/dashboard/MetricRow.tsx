import { TrendingUp, Activity, Users, Wallet } from 'lucide-react';
import { StatCard } from '../ui';

const metrics = [
  {
    title: 'Monthly Revenue',
    value: '1,247,500',
    prefix: 'R ',
    change: { value: 12.5, direction: 'up' as const },
    icon: <TrendingUp className="h-5 w-5" />,
  },
  {
    title: 'Utilization Rate',
    value: '78%',
    change: { value: 3.2, direction: 'up' as const },
    icon: <Activity className="h-5 w-5" />,
  },
  {
    title: 'Active Clients',
    value: '24',
    change: { value: 2, direction: 'up' as const },
    icon: <Users className="h-5 w-5" />,
  },
  {
    title: 'Cash Position',
    value: '271,340',
    prefix: 'R ',
    change: { value: 1.8, direction: 'down' as const },
    icon: <Wallet className="h-5 w-5" />,
  },
] as const;

export function MetricRow() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <StatCard
          key={metric.title}
          title={metric.title}
          value={metric.value}
          prefix={metric.prefix}
          change={metric.change}
          icon={metric.icon}
        />
      ))}
    </div>
  );
}
