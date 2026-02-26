import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from '../Tabs';

const tabs = [
  { id: 'tab1', label: 'Tab One' },
  { id: 'tab2', label: 'Tab Two' },
  { id: 'tab3', label: 'Tab Three' },
];

describe('Tabs', () => {
  it('renders all tab buttons', () => {
    render(<Tabs tabs={tabs} activeTab="tab1" onChange={vi.fn()} />);
    expect(screen.getByText('Tab One')).toBeInTheDocument();
    expect(screen.getByText('Tab Two')).toBeInTheDocument();
    expect(screen.getByText('Tab Three')).toBeInTheDocument();
  });

  it('marks the active tab with active styles (underline variant)', () => {
    render(<Tabs tabs={tabs} activeTab="tab1" onChange={vi.fn()} />);
    const activeBtn = screen.getByText('Tab One');
    expect(activeBtn.className).toContain('text-primary-600');
    expect(activeBtn.className).toContain('border-b-2');
  });

  it('calls onChange with tab id on click', async () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} activeTab="tab1" onChange={onChange} />);
    await userEvent.click(screen.getByText('Tab Two'));
    expect(onChange).toHaveBeenCalledWith('tab2');
  });

  it('renders pills variant', () => {
    render(<Tabs tabs={tabs} activeTab="tab1" onChange={vi.fn()} variant="pills" />);
    const activeBtn = screen.getByText('Tab One');
    expect(activeBtn.className).toContain('bg-primary-50');
    expect(activeBtn.className).toContain('rounded-lg');
  });

  it('applies inactive styles on non-active tabs', () => {
    render(<Tabs tabs={tabs} activeTab="tab1" onChange={vi.fn()} />);
    const inactiveBtn = screen.getByText('Tab Two');
    expect(inactiveBtn.className).toContain('text-surface-500');
  });

  it('renders tab icons when provided', () => {
    const tabsWithIcons = [
      { id: 'a', label: 'A', icon: <span data-testid="icon-a">I</span> },
    ];
    render(<Tabs tabs={tabsWithIcons} activeTab="a" onChange={vi.fn()} />);
    expect(screen.getByTestId('icon-a')).toBeInTheDocument();
  });
});
