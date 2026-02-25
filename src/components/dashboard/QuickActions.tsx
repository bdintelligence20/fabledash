import { Clock, Plus, DollarSign, Bot } from 'lucide-react';
import { Card, Button } from '../ui';

const actions = [
  {
    label: 'Log Time',
    icon: <Clock className="h-4 w-4" />,
    variant: 'secondary' as const,
  },
  {
    label: 'New Task',
    icon: <Plus className="h-4 w-4" />,
    variant: 'secondary' as const,
  },
  {
    label: 'View Finances',
    icon: <DollarSign className="h-4 w-4" />,
    variant: 'secondary' as const,
  },
  {
    label: 'Ask OpsAI',
    icon: <Bot className="h-4 w-4" />,
    variant: 'primary' as const,
  },
];

export function QuickActions() {
  return (
    <Card padding="none">
      <Card.Header>
        <h3 className="text-heading text-base">Quick Actions</h3>
      </Card.Header>
      <Card.Body>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant}
              icon={action.icon}
              className="w-full"
            >
              {action.label}
            </Button>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}
