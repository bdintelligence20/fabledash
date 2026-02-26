import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../Input';

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('handles change events', async () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'hello');
    expect(handleChange).toHaveBeenCalled();
  });

  it('renders label with correct association', () => {
    render(<Input label="Username" />);
    const label = screen.getByText('Username');
    expect(label).toBeInTheDocument();
    const input = screen.getByLabelText('Username');
    expect(input).toBeInTheDocument();
  });

  it('displays error message', () => {
    render(<Input error="Required field" />);
    expect(screen.getByText('Required field')).toBeInTheDocument();
  });

  it('applies error border styling', () => {
    render(<Input error="Error" />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('border-danger-500');
  });

  it('applies normal border without error', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('border-surface-200');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders icon when provided', () => {
    render(<Input icon={<span data-testid="search-icon">S</span>} />);
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Input className="my-input" />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('my-input');
  });
});
