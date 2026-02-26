import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AlertsPanel, type ProactiveAlert } from '../AlertsPanel';

function renderWithRouter(ui: React.ReactElement) {
  return render(ui, { wrapper: BrowserRouter });
}

describe('AlertsPanel', () => {
  it('shows "All clear" when no alerts', () => {
    renderWithRouter(<AlertsPanel alerts={[]} />);
    expect(screen.getByText('All clear')).toBeInTheDocument();
    expect(screen.getByText('No alerts at this time')).toBeInTheDocument();
  });

  it('renders alert count in header badge', () => {
    const alerts: ProactiveAlert[] = [
      { type: 'over_servicing', severity: 'high', message: 'Alert 1' },
      { type: 'low_cash', severity: 'medium', message: 'Alert 2' },
    ];
    renderWithRouter(<AlertsPanel alerts={alerts} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders alerts with messages', () => {
    const alerts: ProactiveAlert[] = [
      { type: 'over_servicing', severity: 'high', message: 'Client X over-serviced' },
    ];
    renderWithRouter(<AlertsPanel alerts={alerts} />);
    expect(screen.getByText('Client X over-serviced')).toBeInTheDocument();
  });

  it('renders severity badges', () => {
    const alerts: ProactiveAlert[] = [
      { type: 'over_servicing', severity: 'high', message: 'Alert' },
    ];
    renderWithRouter(<AlertsPanel alerts={alerts} />);
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('renders "View Details" link for alerts with client_id', () => {
    const alerts: ProactiveAlert[] = [
      { type: 'over_servicing', severity: 'high', message: 'Alert', client_id: 'c1' },
    ];
    renderWithRouter(<AlertsPanel alerts={alerts} />);
    const link = screen.getByText('View Details');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/clients/c1');
  });

  it('renders "View Details" link for alerts with task_id', () => {
    const alerts: ProactiveAlert[] = [
      { type: 'deadline_risk', severity: 'medium', message: 'Alert', task_id: 't1' },
    ];
    renderWithRouter(<AlertsPanel alerts={alerts} />);
    const link = screen.getByText('View Details');
    expect(link).toHaveAttribute('href', '/tasks/t1');
  });

  it('does not render "View Details" for alerts without entity ids', () => {
    const alerts: ProactiveAlert[] = [
      { type: 'utilization_drop', severity: 'low', message: 'Util dropped' },
    ];
    renderWithRouter(<AlertsPanel alerts={alerts} />);
    expect(screen.queryByText('View Details')).not.toBeInTheDocument();
  });

  it('renders type labels', () => {
    const alerts: ProactiveAlert[] = [
      { type: 'over_servicing', severity: 'high', message: 'Alert' },
    ];
    renderWithRouter(<AlertsPanel alerts={alerts} />);
    expect(screen.getByText('Over-servicing')).toBeInTheDocument();
  });

  it('renders header title', () => {
    renderWithRouter(<AlertsPanel alerts={[]} />);
    expect(screen.getByText('Alerts & Insights')).toBeInTheDocument();
  });
});
