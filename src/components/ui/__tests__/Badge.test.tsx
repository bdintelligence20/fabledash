import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders with text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    const { container } = render(<Badge>Default</Badge>);
    expect(container.firstChild).toHaveClass('bg-surface-100');
  });

  it('applies primary variant styles', () => {
    const { container } = render(<Badge variant="primary">Primary</Badge>);
    expect(container.firstChild).toHaveClass('bg-primary-50');
  });

  it('applies success variant styles', () => {
    const { container } = render(<Badge variant="success">Success</Badge>);
    expect(container.firstChild).toHaveClass('bg-success-50');
  });

  it('applies warning variant styles', () => {
    const { container } = render(<Badge variant="warning">Warning</Badge>);
    expect(container.firstChild).toHaveClass('bg-warning-50');
  });

  it('applies danger variant styles', () => {
    const { container } = render(<Badge variant="danger">Danger</Badge>);
    expect(container.firstChild).toHaveClass('bg-danger-50');
  });

  it('applies sm size by default', () => {
    const { container } = render(<Badge>Small</Badge>);
    expect(container.firstChild).toHaveClass('text-xs');
  });

  it('applies md size', () => {
    const { container } = render(<Badge size="md">Medium</Badge>);
    expect(container.firstChild).toHaveClass('text-sm');
  });

  it('renders dot when dot prop is true', () => {
    const { container } = render(<Badge dot>Dotted</Badge>);
    const dot = container.querySelector('.rounded-full.mr-1\\.5');
    expect(dot).toBeInTheDocument();
  });

  it('does not render dot by default', () => {
    const { container } = render(<Badge>No dot</Badge>);
    const dot = container.querySelector('.mr-1\\.5');
    expect(dot).not.toBeInTheDocument();
  });
});
