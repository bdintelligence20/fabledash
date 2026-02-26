import { render, screen } from '@testing-library/react';
import { ActivityLog, type TimeLogEntry } from '../ActivityLog';

const clients = new Map([
  ['c1', 'Acme Corp'],
  ['c2', 'Globex Inc'],
]);

const tasks = new Map([
  ['t1', 'Design'],
  ['t2', 'Development'],
]);

function makeEntry(overrides: Partial<TimeLogEntry> = {}): TimeLogEntry {
  return {
    id: 'e1',
    date: '2024-06-01',
    client_id: 'c1',
    task_id: null,
    description: 'Working on tests',
    start_time: '09:00',
    end_time: '10:30',
    duration_minutes: 90,
    is_billable: true,
    ...overrides,
  };
}

describe('ActivityLog', () => {
  it('renders spinner when loading', () => {
    const { container } = render(
      <ActivityLog entries={[]} clients={clients} tasks={tasks} loading={true} />,
    );
    const spinner = container.querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows empty state when no entries', () => {
    render(
      <ActivityLog entries={[]} clients={clients} tasks={tasks} loading={false} />,
    );
    expect(screen.getByText(/No activity logged today/)).toBeInTheDocument();
  });

  it('renders log entries with time range', () => {
    const entries = [makeEntry()];
    render(
      <ActivityLog entries={entries} clients={clients} tasks={tasks} loading={false} />,
    );
    expect(screen.getByText(/09:00/)).toBeInTheDocument();
    expect(screen.getByText(/10:30/)).toBeInTheDocument();
  });

  it('renders duration badge', () => {
    const entries = [makeEntry({ duration_minutes: 90 })];
    render(
      <ActivityLog entries={entries} clients={clients} tasks={tasks} loading={false} />,
    );
    // Duration appears in both the entry badge and the total header badge
    const badges = screen.getAllByText('1h 30m');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders client name', () => {
    const entries = [makeEntry({ client_id: 'c1' })];
    render(
      <ActivityLog entries={entries} clients={clients} tasks={tasks} loading={false} />,
    );
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
  });

  it('renders task name when available', () => {
    const entries = [makeEntry({ task_id: 't1' })];
    render(
      <ActivityLog entries={entries} clients={clients} tasks={tasks} loading={false} />,
    );
    expect(screen.getByText(/Design/)).toBeInTheDocument();
  });

  it('sorts entries chronologically by start_time', () => {
    const entries = [
      makeEntry({ id: 'e2', start_time: '14:00', end_time: '15:00', description: 'Afternoon' }),
      makeEntry({ id: 'e1', start_time: '09:00', end_time: '10:00', description: 'Morning' }),
    ];
    render(
      <ActivityLog entries={entries} clients={clients} tasks={tasks} loading={false} />,
    );
    const descriptions = screen.getAllByText(/Morning|Afternoon/);
    expect(descriptions[0].textContent).toContain('Morning');
    expect(descriptions[1].textContent).toContain('Afternoon');
  });

  it('renders billable badge', () => {
    const entries = [makeEntry({ is_billable: true })];
    render(
      <ActivityLog entries={entries} clients={clients} tasks={tasks} loading={false} />,
    );
    expect(screen.getByText('Billable')).toBeInTheDocument();
  });

  it('renders non-billable badge', () => {
    const entries = [makeEntry({ is_billable: false })];
    render(
      <ActivityLog entries={entries} clients={clients} tasks={tasks} loading={false} />,
    );
    expect(screen.getByText('Non-billable')).toBeInTheDocument();
  });
});
