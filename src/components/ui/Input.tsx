import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-label mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:ring-focus transition-default ${icon ? 'pl-10' : ''} ${error ? 'border-danger-500' : 'border-surface-200 focus:border-primary-500'} ${className}`}
            {...props}
          />
        </div>
        {error && <p className="mt-1.5 text-sm text-danger-600">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
