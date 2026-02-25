import { type ReactNode } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Spinner } from './Spinner';

export interface StatCardChange {
  value: number;
  direction: 'up' | 'down' | 'flat';
}

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: StatCardChange;
  icon?: ReactNode;
  prefix?: string;
  loading?: boolean;
  className?: string;
}

const changeStyles = {
  up: 'text-success-600',
  down: 'text-danger-600',
  flat: 'text-surface-400',
} as const;

const changeIcons = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
} as const;

function formatChange(value: number, direction: 'up' | 'down' | 'flat'): string {
  const abs = Math.abs(value).toFixed(1);
  if (direction === 'up') return `+${abs}%`;
  if (direction === 'down') return `-${abs}%`;
  return `${abs}%`;
}

export function StatCard({
  title,
  value,
  change,
  icon,
  prefix,
  loading = false,
  className = '',
}: StatCardProps) {
  return (
    <div className={`surface-card p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <p className="text-caption">{title}</p>
        {icon && <span className="text-surface-400">{icon}</span>}
      </div>

      <div className="mt-2">
        {loading ? (
          <Spinner size="md" />
        ) : (
          <p className="text-2xl font-bold text-surface-900">
            {prefix}
            {value}
          </p>
        )}
      </div>

      {change && !loading && (
        <div className={`mt-2 flex items-center gap-1 text-sm ${changeStyles[change.direction]}`}>
          {(() => {
            const Icon = changeIcons[change.direction];
            return <Icon className="h-4 w-4" />;
          })()}
          <span className="font-medium">{formatChange(change.value, change.direction)}</span>
        </div>
      )}
    </div>
  );
}
