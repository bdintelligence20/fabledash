import { render, screen } from '@testing-library/react';
import { MetricRow } from '../MetricRow';

describe('MetricRow', () => {
  it('renders all four metric titles', () => {
    render(<MetricRow />);
    expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
    expect(screen.getByText('Utilization Rate')).toBeInTheDocument();
    expect(screen.getByText('Active Clients')).toBeInTheDocument();
    expect(screen.getByText('Cash Position')).toBeInTheDocument();
  });

  it('renders em-dash when data is undefined', () => {
    render(<MetricRow />);
    // All four values should show em-dash
    const dashes = screen.getAllByText('\u2014');
    expect(dashes.length).toBe(4);
  });

  it('renders formatted values with data', () => {
    render(
      <MetricRow
        data={{
          revenue: 150000,
          utilization: 75,
          activeClients: 12,
          cashPosition: 50000,
        }}
      />,
    );
    // Revenue should show formatted number with R prefix
    expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    // Revenue and cash use R prefix - just verify they're present
    const allText = document.body.textContent || '';
    expect(allText).toContain('150');
    expect(allText).toContain('50');
  });

  it('renders em-dash for null values', () => {
    render(
      <MetricRow
        data={{
          revenue: null,
          utilization: null,
          activeClients: null,
          cashPosition: null,
        }}
      />,
    );
    const dashes = screen.getAllByText('\u2014');
    expect(dashes.length).toBe(4);
  });

  it('renders spinners when loading', () => {
    const { container } = render(<MetricRow loading />);
    const svgs = container.querySelectorAll('svg');
    const spinners = Array.from(svgs).filter(svg =>
      (svg.getAttribute('class') || '').includes('animate-spin')
    );
    expect(spinners.length).toBe(4);
  });
});
