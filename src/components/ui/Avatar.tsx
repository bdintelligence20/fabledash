import React, { ReactNode } from 'react';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type AvatarShape = 'circle' | 'square';
type AvatarStatus = 'online' | 'offline' | 'away' | 'busy' | 'none';

interface AvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  icon?: ReactNode;
  size?: AvatarSize;
  shape?: AvatarShape;
  status?: AvatarStatus;
  bgColor?: string;
  textColor?: string;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  initials,
  icon,
  size = 'md',
  shape = 'circle',
  status = 'none',
  bgColor = 'bg-primary-100',
  textColor = 'text-primary-600',
  className = '',
}) => {
  const sizeClasses = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-12 w-12 text-lg',
    xl: 'h-16 w-16 text-xl',
  };

  const shapeClasses = {
    circle: 'rounded-full',
    square: 'rounded-lg',
  };

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    none: 'hidden',
  };

  const statusSizes = {
    xs: 'h-1.5 w-1.5',
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
    xl: 'h-4 w-4',
  };

  // Render image if src is provided
  if (src) {
    return (
      <div className="relative inline-block">
        <img
          src={src}
          alt={alt}
          className={`${sizeClasses[size]} ${shapeClasses[shape]} object-cover ${className}`}
        />
        {status !== 'none' && (
          <span
            className={`absolute bottom-0 right-0 block ${statusColors[status]} ${statusSizes[size]} ${
              shape === 'circle' ? 'rounded-full' : 'rounded-sm'
            } ring-2 ring-white`}
          ></span>
        )}
      </div>
    );
  }

  // Render initials or icon
  return (
    <div className="relative inline-block">
      <div
        className={`${sizeClasses[size]} ${shapeClasses[shape]} ${bgColor} ${textColor} flex items-center justify-center font-medium ${className}`}
      >
        {icon || (initials ? initials.substring(0, 2).toUpperCase() : '?')}
      </div>
      {status !== 'none' && (
        <span
          className={`absolute bottom-0 right-0 block ${statusColors[status]} ${statusSizes[size]} ${
            shape === 'circle' ? 'rounded-full' : 'rounded-sm'
          } ring-2 ring-white`}
        ></span>
      )}
    </div>
  );
};

export default Avatar;
