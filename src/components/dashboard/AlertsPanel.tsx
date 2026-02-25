import { Card, Badge } from '@/components/ui';

type Severity = 'danger' | 'warning' | 'info';

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: Severity;
}

const severityBarColors: Record<Severity, string> = {
  danger: 'bg-danger-500',
  warning: 'bg-warning-500',
  info: 'bg-primary-500',
};

const severityBadgeVariant: Record<Severity, 'danger' | 'warning' | 'primary'> = {
  danger: 'danger',
  warning: 'warning',
  info: 'primary',
};

const alerts: Alert[] = [
  {
    id: '1',
    title: 'Cash position below R250K threshold',
    description: 'Current cash on hand requires immediate attention.',
    severity: 'danger',
  },
  {
    id: '2',
    title: "Client 'Meridian Corp' over-serviced by 23%",
    description: 'Hours logged exceed budgeted allocation this month.',
    severity: 'warning',
  },
  {
    id: '3',
    title: '3 time logs pending review',
    description: 'Team submissions awaiting your approval this week.',
    severity: 'warning',
  },
  {
    id: '4',
    title: 'Quarterly report ready for Q4 2025',
    description: 'Health & Vitality report generated and available.',
    severity: 'info',
  },
];

export function AlertsPanel() {
  return (
    <Card padding="none">
      <Card.Header className="flex items-center justify-between">
        <h3 className="text-heading text-base">Alerts & Insights</h3>
        <Badge variant="danger" dot>
          {alerts.length}
        </Badge>
      </Card.Header>
      <Card.Body className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex gap-3 p-3 rounded-lg bg-surface-50 hover:bg-surface-100 transition-default cursor-pointer"
          >
            <div
              className={`w-1 flex-shrink-0 rounded-full ${severityBarColors[alert.severity]}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm text-surface-800">{alert.title}</p>
                <Badge variant={severityBadgeVariant[alert.severity]} size="sm" className="flex-shrink-0">
                  {alert.severity.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-surface-500 mt-0.5">{alert.description}</p>
            </div>
          </div>
        ))}
      </Card.Body>
    </Card>
  );
}
