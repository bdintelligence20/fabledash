import { render, screen } from '@testing-library/react';
import KanbanBoard from '../KanbanBoard';

const mockTasks = [
  {
    id: 't1', title: 'Todo Task', description: null, client_id: 'c1',
    status: 'todo' as const, priority: 'medium' as const, due_date: null,
    assigned_to: null, comments: [], attachments: [],
    created_at: '2024-01-01', updated_at: '2024-01-01', created_by: 'u1',
  },
  {
    id: 't2', title: 'In Progress Task', description: null, client_id: 'c1',
    status: 'in_progress' as const, priority: 'high' as const, due_date: null,
    assigned_to: null, comments: [], attachments: [],
    created_at: '2024-01-01', updated_at: '2024-01-01', created_by: 'u1',
  },
  {
    id: 't3', title: 'Done Task', description: null, client_id: 'c2',
    status: 'done' as const, priority: 'low' as const, due_date: null,
    assigned_to: null, comments: [], attachments: [],
    created_at: '2024-01-01', updated_at: '2024-01-01', created_by: 'u1',
  },
];

const clientMap = { c1: 'Acme Corp', c2: 'Globex Inc' };

describe('KanbanBoard', () => {
  it('renders 5 status columns', () => {
    render(
      <KanbanBoard
        tasks={[]}
        clientMap={{}}
        onStatusChange={vi.fn()}
        onTaskClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Todo')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('In Review')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('shows tasks in correct columns', () => {
    render(
      <KanbanBoard
        tasks={mockTasks}
        clientMap={clientMap}
        onStatusChange={vi.fn()}
        onTaskClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Todo Task')).toBeInTheDocument();
    expect(screen.getByText('In Progress Task')).toBeInTheDocument();
    expect(screen.getByText('Done Task')).toBeInTheDocument();
  });

  it('shows task count per column', () => {
    render(
      <KanbanBoard
        tasks={mockTasks}
        clientMap={clientMap}
        onStatusChange={vi.fn()}
        onTaskClick={vi.fn()}
      />,
    );
    // Todo column should show 1, In Progress 1, Done 1, etc.
    // The counts are rendered as text in spans
    const counts = screen.getAllByText('1');
    expect(counts.length).toBeGreaterThanOrEqual(3);
  });

  it('shows client names on cards', () => {
    render(
      <KanbanBoard
        tasks={mockTasks}
        clientMap={clientMap}
        onStatusChange={vi.fn()}
        onTaskClick={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Globex Inc')).toBeInTheDocument();
  });

  it('shows "No tasks" for empty columns', () => {
    render(
      <KanbanBoard
        tasks={[]}
        clientMap={{}}
        onStatusChange={vi.fn()}
        onTaskClick={vi.fn()}
      />,
    );
    const noTasksLabels = screen.getAllByText('No tasks');
    expect(noTasksLabels.length).toBe(5);
  });

  it('renders priority badges on cards', () => {
    render(
      <KanbanBoard
        tasks={mockTasks}
        clientMap={clientMap}
        onStatusChange={vi.fn()}
        onTaskClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });
});
