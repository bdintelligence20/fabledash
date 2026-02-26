import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../Modal';

describe('Modal', () => {
  it('renders nothing when isOpen is false', () => {
    render(<Modal isOpen={false} onClose={vi.fn()} title="Test">Content</Modal>);
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders title and children when open', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="My Modal">Modal content</Modal>);
    expect(screen.getByText('My Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="Test">Content</Modal>);
    // The close button has an X icon
    const closeButtons = screen.getAllByRole('button');
    await userEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', async () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="Test">Content</Modal>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen={true} onClose={onClose} title="Test">Content</Modal>,
    );
    // The backdrop is the div with bg-black/50
    const backdrop = container.ownerDocument.querySelector('.bg-black\\/50');
    if (backdrop) {
      await userEvent.click(backdrop);
    }
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders with different sizes', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="Small" size="sm">Content</Modal>,
    );
    const panel = container.ownerDocument.querySelector('.max-w-sm');
    expect(panel).toBeInTheDocument();
  });

  it('renders via portal to document.body', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="Portal">Portal content</Modal>);
    // The content should be in document.body, not the render container
    expect(document.body.querySelector('.fixed.inset-0')).toBeInTheDocument();
  });
});
