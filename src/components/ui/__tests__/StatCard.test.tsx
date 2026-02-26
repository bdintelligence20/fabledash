import { render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Revenue" value="R 150,000" />);
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('R 150,000')).toBeInTheDocument();
  });

  it('renders with prefix', () => {
    render(<StatCard title="Cash" value="50,000" prefix="R " />);
    expect(screen.getByText(/R/)).toBeInTheDocument();
    expect(screen.getByText(/50,000/)).toBeInTheDocument();
  });

  it('renders positive change indicator', () => {
    render(
      <StatCard
        title="Revenue"
        value="100"
        change={{ value: 12.5, direction: 'up' }}
      />,
    );
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });

  it('renders negative change indicator', () => {
    render(
      <StatCard
        title="Revenue"
        value="100"
        change={{ value: 5.2, direction: 'down' }}
      />,
    );
    expect(screen.getByText('-5.2%')).toBeInTheDocument();
  });

  it('renders flat change indicator', () => {
    render(
      <StatCard
        title="Revenue"
        value="100"
        change={{ value: 0, direction: 'flat' }}
      />,
    );
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <StatCard
        title="Clients"
        value="12"
        icon={<span data-testid="stat-icon">Icon</span>}
      />,
    );
    expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
  });

  it('renders spinner when loading', () => {
    const { container } = render(<StatCard title="Loading" value="0" loading />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const cls = svg?.getAttribute('class') || '';
    expect(cls).toContain('animate-spin');
  });

  it('does not show change when loading', () => {
    render(
      <StatCard
        title="Revenue"
        value="100"
        loading
        change={{ value: 10, direction: 'up' }}
      />,
    );
    expect(screen.queryByText('+10.0%')).not.toBeInTheDocument();
  });
});
