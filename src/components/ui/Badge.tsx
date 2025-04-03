import React, { ReactNode } from 'react';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'default';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  rounded?: boolean;
  icon?: ReactNode;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  rounded = false,
  icon,
  className = '',
}) => {
  const variantClasses = {
    primary: 'bg-primary-100 text-primary-800',
    secondary: 'bg-secondary-100 text-secondary-800',
    success: 'bg-green-100 text-green-800',
    danger: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
    default: 'bg-gray-100 text-gray-800',
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1',
  };

  const roundedClass = rounded ? 'rounded-full' : 'rounded';

  return (
    <span
      className={`inline-flex items-center font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${roundedClass} ${className}`}
    >
      {icon && <span className="mr-1.5">{icon}</span>}
      {children}
    </span>
  );
};

// Predefined badge with status colors
interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: BadgeSize;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', size = 'md' }) => {
  // Map common status terms to variants
  const getVariant = (status: string): BadgeVariant => {
    const lowerStatus = status.toLowerCase();
    
    if (['completed', 'done', 'finished', 'approved', 'active'].includes(lowerStatus)) {
      return 'success';
    }
    
    if (['in progress', 'ongoing', 'in review', 'pending'].includes(lowerStatus)) {
      return 'primary';
    }
    
    if (['blocked', 'on hold', 'paused', 'waiting'].includes(lowerStatus)) {
      return 'warning';
    }
    
    if (['cancelled', 'failed', 'rejected', 'error'].includes(lowerStatus)) {
      return 'danger';
    }
    
    if (['new', 'to do', 'backlog', 'planned'].includes(lowerStatus)) {
      return 'info';
    }
    
    return 'default';
  };

  return (
    <Badge variant={getVariant(status)} size={size} rounded className={className}>
      {status}
    </Badge>
  );
};

export default Badge;
