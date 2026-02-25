import { type HTMLAttributes } from 'react';

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
} as const;

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string;
  size?: keyof typeof sizes;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, src, size = 'md', className = '', ...props }: AvatarProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full overflow-hidden ${sizes[size]} ${!src ? 'bg-primary-100 text-primary-600 font-semibold' : ''} ${className}`}
      title={name}
      {...props}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}
