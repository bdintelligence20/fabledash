import { forwardRef, type HTMLAttributes } from 'react';

const paddings = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const;

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof paddings;
  hover?: boolean;
}

const CardRoot = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = 'md', hover = false, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`surface-card ${paddings[padding]} ${hover ? 'hover:shadow-card-hover transition-default cursor-pointer' : ''} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  },
);

CardRoot.displayName = 'Card';

function Header({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 py-4 border-b border-surface-100 ${className}`} {...props}>
      {children}
    </div>
  );
}

Header.displayName = 'Card.Header';

function Body({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 py-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

Body.displayName = 'Card.Body';

function Footer({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 py-4 border-t border-surface-100 ${className}`} {...props}>
      {children}
    </div>
  );
}

Footer.displayName = 'Card.Footer';

export const Card = Object.assign(CardRoot, {
  Header,
  Body,
  Footer,
});
