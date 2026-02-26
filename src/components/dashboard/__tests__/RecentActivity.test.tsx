import { render, screen } from '@testing-library/react';
import { RecentActivity } from '../RecentActivity';

describe('RecentActivity', () => {
  it('renders header', () => {
    render(<RecentActivity timeLogs={[]} />);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('shows empty state when no time logs', () => {
    render(<RecentActivity timeLogs={[]} />);
    expect(screen.getByText('No recent time logs')).toBeInTheDocument();
  });

  it('renders time log entries', () => {
    const logs = [
      { id: '1', description: 'Design work', date: '2024-01-01', duration_minutes: 90 },
      { id: '2', description: 'Code review', date: '2024-01-02', duration_minutes: 30 },
    ];
    render(<RecentActivity timeLogs={logs} />);
    expect(screen.getByText(/Design work/)).toBeInTheDocument();
    expect(screen.getByText(/Code review/)).toBeInTheDocument();
  });

  it('formats duration correctly', () => {
    const logs = [
      { id: '1', description: 'Work', date: '2024-01-01', duration_minutes: 90 },
    ];
    render(<RecentActivity timeLogs={logs} />);
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
  });

  it('formats duration for minutes only', () => {
    const logs = [
      { id: '1', description: 'Quick task', date: '2024-01-01', duration_minutes: 15 },
    ];
    render(<RecentActivity timeLogs={logs} />);
    expect(screen.getByText('15m')).toBeInTheDocument();
  });

  it('formats duration for full hours', () => {
    const logs = [
      { id: '1', description: 'Meeting', date: '2024-01-01', duration_minutes: 120 },
    ];
    render(<RecentActivity timeLogs={logs} />);
    expect(screen.getByText('2h')).toBeInTheDocument();
  });

  it('shows client name when provided', () => {
    const logs = [
      { id: '1', description: 'Work', date: '2024-01-01', duration_minutes: 60, client_name: 'Acme' },
    ];
    render(<RecentActivity timeLogs={logs} />);
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
  });

  it('shows "Time logged" for entries without description', () => {
    const logs = [
      { id: '1', description: '', date: '2024-01-01', duration_minutes: 60 },
    ];
    render(<RecentActivity timeLogs={logs} />);
    expect(screen.getByText(/Time logged/)).toBeInTheDocument();
  });
});
