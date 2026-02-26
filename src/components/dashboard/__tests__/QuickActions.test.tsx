import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QuickActions } from '../QuickActions';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('QuickActions', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders all action buttons', () => {
    render(<QuickActions />, { wrapper: BrowserRouter });
    expect(screen.getByText('Log Time')).toBeInTheDocument();
    expect(screen.getByText('New Task')).toBeInTheDocument();
    expect(screen.getByText('View Finances')).toBeInTheDocument();
    expect(screen.getByText('Ask OpsAI')).toBeInTheDocument();
  });

  it('navigates to /time on "Log Time" click', async () => {
    render(<QuickActions />, { wrapper: BrowserRouter });
    await userEvent.click(screen.getByText('Log Time'));
    expect(mockNavigate).toHaveBeenCalledWith('/time');
  });

  it('navigates to /tasks on "New Task" click', async () => {
    render(<QuickActions />, { wrapper: BrowserRouter });
    await userEvent.click(screen.getByText('New Task'));
    expect(mockNavigate).toHaveBeenCalledWith('/tasks');
  });

  it('navigates to /finances on "View Finances" click', async () => {
    render(<QuickActions />, { wrapper: BrowserRouter });
    await userEvent.click(screen.getByText('View Finances'));
    expect(mockNavigate).toHaveBeenCalledWith('/finances');
  });

  it('navigates to /opsai on "Ask OpsAI" click', async () => {
    render(<QuickActions />, { wrapper: BrowserRouter });
    await userEvent.click(screen.getByText('Ask OpsAI'));
    expect(mockNavigate).toHaveBeenCalledWith('/opsai');
  });

  it('renders Quick Actions heading', () => {
    render(<QuickActions />, { wrapper: BrowserRouter });
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });
});
