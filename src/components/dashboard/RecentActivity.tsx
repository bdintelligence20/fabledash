import { UserPlus, FileText, Clock, Mic, AlertTriangle } from 'lucide-react';
import { Card } from '../ui';

interface ActivityItem {
  id: string;
  description: string;
  timestamp: string;
  icon: React.ReactNode;
  iconBg: string;
}

const activities: ActivityItem[] = [
  {
    id: '1',
    description: 'New client onboarded: Acme Creative',
    timestamp: '2 hours ago',
    icon: <UserPlus className="h-4 w-4 text-success-600" />,
    iconBg: 'bg-success-50',
  },
  {
    id: '2',
    description: 'Invoice #1247 sent to Blue Mountain Co',
    timestamp: '4 hours ago',
    icon: <FileText className="h-4 w-4 text-primary-600" />,
    iconBg: 'bg-primary-50',
  },
  {
    id: '3',
    description: 'Time log submitted: 6.5h on Meridian project',
    timestamp: '5 hours ago',
    icon: <Clock className="h-4 w-4 text-accent-600" />,
    iconBg: 'bg-accent-50',
  },
  {
    id: '4',
    description: 'Meeting transcript processed: Q1 Strategy Review',
    timestamp: 'Yesterday',
    icon: <Mic className="h-4 w-4 text-primary-600" />,
    iconBg: 'bg-primary-50',
  },
  {
    id: '5',
    description: 'Utilization alert: Team dropped below 75%',
    timestamp: 'Yesterday',
    icon: <AlertTriangle className="h-4 w-4 text-warning-600" />,
    iconBg: 'bg-warning-50',
  },
];

export function RecentActivity() {
  return (
    <Card padding="none">
      <Card.Header className="flex items-center justify-between">
        <h3 className="text-heading text-base">Recent Activity</h3>
        <button
          type="button"
          className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-default"
        >
          View all
        </button>
      </Card.Header>
      <Card.Body>
        <div className="space-y-0">
          {activities.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 py-3 border-b border-surface-100 last:border-0"
            >
              <span
                className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.iconBg}`}
              >
                {item.icon}
              </span>
              <p className="text-sm text-surface-700 leading-snug">{item.description}</p>
              <span className="text-xs text-surface-400 ml-auto flex-shrink-0">
                {item.timestamp}
              </span>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}
