import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Card, Badge } from '../ui';

export interface ProactiveAlert {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  entity_id?: string;
  client_id?: string;
  task_id?: string;
  [key: string]: unknown;
}

interface AlertsPanelProps {
  alerts: ProactiveAlert[];
  loading?: boolean;
}

type SeverityKey = 'high' | 'medium' | 'low';

const severityBarColors: Record<SeverityKey, string> = {
  high: 'bg-danger-500',
  medium: 'bg-warning-500',
  low: 'bg-primary-500',
};

const severityBadgeVariant: Record<SeverityKey, 'danger' | 'warning' | 'primary'> = {
  high: 'danger',
  medium: 'warning',
  low: 'primary',
};

const typeLabels: Record<string, string> = {
  over_servicing: 'Over-servicing',
  utilization_drop: 'Utilization',
  low_cash: 'Cash Position',
  high_ar: 'Receivables',
  ap_due: 'Payables',
  scope_creep: 'Scope Creep',
  deadline_risk: 'Deadline',
};

function getAlertLink(alert: ProactiveAlert): string | null {
  if (alert.client_id) return `/clients/${alert.client_id}`;
  if (alert.task_id) return `/tasks/${alert.task_id}`;
  return null;
}

export function AlertsPanel({ alerts, loading = false }: AlertsPanelProps) {
  const highCount = alerts.filter((a) => a.severity === 'high').length;
  const badgeVariant = highCount > 0 ? 'danger' : alerts.length > 0 ? 'warning' : 'success';

  return (
    <Card padding="none">
      <Card.Header className="flex items-center justify-between">
        <h3 className="text-heading text-base">Alerts & Insights</h3>
        <Badge variant={badgeVariant} dot>
          {alerts.length}
        </Badge>
      </Card.Header>
      <Card.Body className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-5 w-5 rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-10 w-10 text-success-500 mb-2" />
            <p className="text-sm font-medium text-surface-700">All clear</p>
            <p className="text-xs text-surface-400 mt-0.5">No alerts at this time</p>
          </div>
        ) : (
          alerts.map((alert, idx) => {
            const link = getAlertLink(alert);
            return (
              <div
                key={`${alert.type}-${idx}`}
                className="flex gap-3 p-3 rounded-lg bg-surface-50 hover:bg-surface-100 transition-default"
              >
                <div
                  className={`w-1 flex-shrink-0 rounded-full ${severityBarColors[alert.severity] || 'bg-surface-300'}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm text-surface-800">{alert.message}</p>
                    <Badge variant={severityBadgeVariant[alert.severity] || 'primary'} size="sm" className="flex-shrink-0">
                      {alert.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-surface-400">
                      {typeLabels[alert.type] || alert.type}
                    </span>
                    {link && (
                      <Link
                        to={link}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        View Details
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Card.Body>
    </Card>
  );
}
