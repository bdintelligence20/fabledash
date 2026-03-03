import { type ReactNode } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Spinner } from './Spinner';

export interface StatCardChange {
  value: number;
  direction: 'up' | 'down' | 'flat';
}

export type StatCardAccent = 'emerald' | 'indigo' | 'amber' | 'violet' | 'default';

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: StatCardChange;
  icon?: ReactNode;
  prefix?: string;
  loading?: boolean;
  className?: string;
  accent?: StatCardAccent;
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

const accentMap: Record<
  StatCardAccent,
  { iconBg: string; iconColor: string; valueColor: string; stripe: string }
> = {
  emerald: {
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    valueColor: 'text-emerald-700',
    stripe: 'bg-emerald-500',
  },
  indigo: {
    iconBg: 'bg-primary-50',
    iconColor: 'text-primary-600',
    valueColor: 'text-primary-700',
    stripe: 'bg-primary-500',
  },
  amber: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    valueColor: 'text-amber-700',
    stripe: 'bg-amber-500',
  },
  violet: {
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    valueColor: 'text-violet-700',
    stripe: 'bg-violet-500',
  },
  default: {
    iconBg: 'bg-surface-100',
    iconColor: 'text-surface-500',
    valueColor: 'text-surface-900',
    stripe: 'bg-surface-300',
  },
};

export function StatCard({
  title,
  value,
  change,
  icon,
  prefix,
  loading = false,
  className = '',
  accent = 'default',
}: StatCardProps) {
  const colors = accentMap[accent];

  return (
    <div className={`bg-white rounded-xl border border-surface-100 shadow-soft overflow-hidden ${className}`}>
      {/* Top accent stripe */}
      <div className={`h-0.5 w-full ${colors.stripe}`} />

      <div className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-surface-400">{title}</p>
          {icon && (
            <span className={`flex items-center justify-center h-8 w-8 rounded-lg ${colors.iconBg} ${colors.iconColor}`}>
              {icon}
            </span>
          )}
        </div>

        <div className="mt-3">
          {loading ? (
            <Spinner size="md" />
          ) : (
            <p className={`text-2xl font-bold tracking-tight ${colors.valueColor}`}>
              {prefix}
              {value}
            </p>
          )}
        </div>

        {change && !loading && (
          <div className={`mt-2 flex items-center gap-1 text-xs ${changeStyles[change.direction]}`}>
            {(() => {
              const Icon = changeIcons[change.direction];
              return <Icon className="h-3.5 w-3.5" />;
            })()}
            <span className="font-semibold">{formatChange(change.value, change.direction)}</span>
            <span className="text-surface-400 font-normal">vs last period</span>
          </div>
        )}

        {!change && !loading && (
          <div className="mt-2 h-4" />
        )}
      </div>
    </div>
  );
}
