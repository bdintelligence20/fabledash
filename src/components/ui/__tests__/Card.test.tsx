import { render, screen } from '@testing-library/react';
import { Card } from '../Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies default md padding', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveClass('p-6');
  });

  it('applies sm padding', () => {
    const { container } = render(<Card padding="sm">Content</Card>);
    expect(container.firstChild).toHaveClass('p-4');
  });

  it('applies none padding', () => {
    const { container } = render(<Card padding="none">Content</Card>);
    expect(container.firstChild).toHaveClass('p-0');
  });

  it('applies hover styles when hover prop is true', () => {
    const { container } = render(<Card hover>Content</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('hover:shadow-card-hover');
    expect(el.className).toContain('cursor-pointer');
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="my-class">Content</Card>);
    expect(container.firstChild).toHaveClass('my-class');
  });
});

describe('Card.Header', () => {
  it('renders children', () => {
    render(<Card.Header>Header content</Card.Header>);
    expect(screen.getByText('Header content')).toBeInTheDocument();
  });

  it('applies border-b styling', () => {
    const { container } = render(<Card.Header>Header</Card.Header>);
    expect(container.firstChild).toHaveClass('border-b');
  });
});

describe('Card.Body', () => {
  it('renders children', () => {
    render(<Card.Body>Body content</Card.Body>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });
});

describe('Card.Footer', () => {
  it('renders children', () => {
    render(<Card.Footer>Footer content</Card.Footer>);
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('applies border-t styling', () => {
    const { container } = render(<Card.Footer>Footer</Card.Footer>);
    expect(container.firstChild).toHaveClass('border-t');
  });
});
