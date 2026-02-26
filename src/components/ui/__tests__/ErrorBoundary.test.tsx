import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// Component that throws
function ThrowingComponent({ message }: { message: string }) {
  throw new Error(message);
}

// Suppress console.error for expected error boundary logs
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Safe content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('catches errors and shows default fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Test error" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('shows Reload Page button', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Oops" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('shows Go to Dashboard link', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Oops" />
      </ErrorBoundary>,
    );
    const link = screen.getByText('Go to Dashboard');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error view</div>}>
        <ThrowingComponent message="Oops" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom error view')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
