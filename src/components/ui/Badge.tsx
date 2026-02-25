import { type HTMLAttributes } from 'react';

const variants = {
  default: 'bg-surface-100 text-surface-700',
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
} as const;

const dotColors = {
  default: 'bg-surface-400',
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
} as const;

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  dot?: boolean;
}

export function Badge({
  variant = 'default',
  size = 'sm',
  dot = false,
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}
