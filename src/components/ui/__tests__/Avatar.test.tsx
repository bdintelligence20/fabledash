import { render, screen } from '@testing-library/react';
import { Avatar } from '../Avatar';

describe('Avatar', () => {
  it('renders with initials from single name', () => {
    render(<Avatar name="Alice" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders initials from two-word name', () => {
    render(<Avatar name="John Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders initials from three-word name (max 2)', () => {
    render(<Avatar name="Mary Jane Watson" />);
    expect(screen.getByText('MJ')).toBeInTheDocument();
  });

  it('sets title attribute to full name', () => {
    render(<Avatar name="Jane Smith" />);
    expect(screen.getByTitle('Jane Smith')).toBeInTheDocument();
  });

  it('renders image when src is provided', () => {
    render(<Avatar name="Jane" src="https://example.com/jane.jpg" />);
    const img = screen.getByAltText('Jane');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/jane.jpg');
  });

  it('applies md size by default', () => {
    const { container } = render(<Avatar name="Test" />);
    expect(container.firstChild).toHaveClass('h-10', 'w-10');
  });

  it('applies sm size', () => {
    const { container } = render(<Avatar name="Test" size="sm" />);
    expect(container.firstChild).toHaveClass('h-8', 'w-8');
  });

  it('applies lg size', () => {
    const { container } = render(<Avatar name="Test" size="lg" />);
    expect(container.firstChild).toHaveClass('h-12', 'w-12');
  });

  it('applies custom className', () => {
    const { container } = render(<Avatar name="Test" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
