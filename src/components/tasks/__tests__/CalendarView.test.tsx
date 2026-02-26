import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalendarView from '../CalendarView';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

describe('CalendarView', () => {
  it('renders current month and year', () => {
    const now = new Date();
    render(<CalendarView tasks={[]} clientMap={{}} onTaskClick={vi.fn()} />);
    expect(screen.getByText(`${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`)).toBeInTheDocument();
  });

  it('renders day-of-week headers', () => {
    render(<CalendarView tasks={[]} clientMap={{}} onTaskClick={vi.fn()} />);
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
  });

  it('navigates to next month', async () => {
    const now = new Date();
    render(<CalendarView tasks={[]} clientMap={{}} onTaskClick={vi.fn()} />);

    // Find the next month button (ChevronRight)
    const buttons = screen.getAllByRole('button');
    // Second button is next month
    await userEvent.click(buttons[1]);

    const nextMonth = (now.getMonth() + 1) % 12;
    const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    expect(screen.getByText(`${MONTH_NAMES[nextMonth]} ${nextYear}`)).toBeInTheDocument();
  });

  it('navigates to previous month', async () => {
    const now = new Date();
    render(<CalendarView tasks={[]} clientMap={{}} onTaskClick={vi.fn()} />);

    // First button is prev month
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[0]);

    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    expect(screen.getByText(`${MONTH_NAMES[prevMonth]} ${prevYear}`)).toBeInTheDocument();
  });

  it('renders Today button', () => {
    render(<CalendarView tasks={[]} clientMap={{}} onTaskClick={vi.fn()} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders 42 calendar cells (6 rows x 7 cols)', () => {
    const { container } = render(<CalendarView tasks={[]} clientMap={{}} onTaskClick={vi.fn()} />);
    // Calendar grid cells have min-h-[100px]
    const cells = container.querySelectorAll('.min-h-\\[100px\\]');
    expect(cells.length).toBe(42);
  });
});
