import { render } from '@testing-library/react';
import { Spinner } from '../Spinner';

describe('Spinner', () => {
  it('renders with default md size', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const cls = svg?.getAttribute('class') || '';
    expect(cls).toContain('h-6');
    expect(cls).toContain('w-6');
  });

  it('renders with sm size', () => {
    const { container } = render(<Spinner size="sm" />);
    const svg = container.querySelector('svg');
    const cls = svg?.getAttribute('class') || '';
    expect(cls).toContain('h-4');
    expect(cls).toContain('w-4');
  });

  it('renders with lg size', () => {
    const { container } = render(<Spinner size="lg" />);
    const svg = container.querySelector('svg');
    const cls = svg?.getAttribute('class') || '';
    expect(cls).toContain('h-8');
    expect(cls).toContain('w-8');
  });

  it('has animation class', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg');
    const cls = svg?.getAttribute('class') || '';
    expect(cls).toContain('animate-spin');
  });

  it('accepts custom className', () => {
    const { container } = render(<Spinner className="text-white" />);
    const svg = container.querySelector('svg');
    const cls = svg?.getAttribute('class') || '';
    expect(cls).toContain('text-white');
  });
});
