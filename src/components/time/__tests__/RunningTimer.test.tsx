import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RunningTimer } from '../RunningTimer';

const clients = [
  { value: 'c1', label: 'Acme Corp' },
  { value: 'c2', label: 'Globex' },
];

const tasks = [
  { value: 't1', label: 'Design' },
];

describe('RunningTimer', () => {
  it('renders initial timer display at 00:00:00', () => {
    render(
      <RunningTimer
        clients={clients}
        tasks={tasks}
        onClientChange={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
  });

  it('renders Start button initially', () => {
    render(
      <RunningTimer
        clients={clients}
        tasks={tasks}
        onClientChange={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByText('Start')).toBeInTheDocument();
  });

  it('Start button is disabled when description and client are empty', () => {
    render(
      <RunningTimer
        clients={clients}
        tasks={tasks}
        onClientChange={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    const startBtn = screen.getByText('Start');
    expect(startBtn.closest('button')).toBeDisabled();
  });

  it('shows Stop button after starting', async () => {
    render(
      <RunningTimer
        clients={clients}
        tasks={tasks}
        onClientChange={vi.fn()}
        onStop={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    // Fill in description
    const descInput = screen.getByPlaceholderText('What are you working on?');
    await userEvent.type(descInput, 'Working on tests');

    // Select client
    const clientSelect = screen.getAllByRole('combobox')[0];
    await userEvent.selectOptions(clientSelect, 'c1');

    // Click Start
    await userEvent.click(screen.getByText('Start'));

    expect(screen.getByText('Stop')).toBeInTheDocument();
  });

  it('renders billable checkbox', () => {
    render(
      <RunningTimer
        clients={clients}
        tasks={tasks}
        onClientChange={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByText('Billable')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('renders description input', () => {
    render(
      <RunningTimer
        clients={clients}
        tasks={tasks}
        onClientChange={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('What are you working on?')).toBeInTheDocument();
  });

  it('calls onClientChange when client is selected', async () => {
    const onClientChange = vi.fn();
    render(
      <RunningTimer
        clients={clients}
        tasks={tasks}
        onClientChange={onClientChange}
        onStop={vi.fn()}
      />,
    );

    const clientSelect = screen.getAllByRole('combobox')[0];
    await userEvent.selectOptions(clientSelect, 'c1');

    expect(onClientChange).toHaveBeenCalledWith('c1');
  });
});
