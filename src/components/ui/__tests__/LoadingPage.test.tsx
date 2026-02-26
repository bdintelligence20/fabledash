import { render, screen } from '@testing-library/react';
import { LoadingPage } from '../LoadingPage';

describe('LoadingPage', () => {
  it('renders loading text', () => {
    render(<LoadingPage />);
    expect(screen.getByText('Loading FableDash...')).toBeInTheDocument();
  });

  it('renders spinner', () => {
    const { container } = render(<LoadingPage />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const cls = svg?.getAttribute('class') || '';
    expect(cls).toContain('animate-spin');
  });

  it('renders large spinner', () => {
    const { container } = render(<LoadingPage />);
    const svg = container.querySelector('svg');
    const cls = svg?.getAttribute('class') || '';
    expect(cls).toContain('h-8');
    expect(cls).toContain('w-8');
  });
});
