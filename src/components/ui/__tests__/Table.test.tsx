import { render, screen } from '@testing-library/react';
import { Table } from '../Table';

describe('Table', () => {
  it('renders a table element', () => {
    render(
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Alice</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders header cells', () => {
    render(
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Email</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
      </Table>,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders body rows and cells', () => {
    render(
      <Table>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Row 1</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>Row 2</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    expect(screen.getByText('Row 1')).toBeInTheDocument();
    expect(screen.getByText('Row 2')).toBeInTheDocument();
  });

  it('applies striped styling on body', () => {
    const { container } = render(
      <Table>
        <Table.Body striped>
          <Table.Row>
            <Table.Cell>Data</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    const tbody = container.querySelector('tbody');
    expect(tbody?.className).toContain('nth-child');
  });

  it('applies custom className to root', () => {
    const { container } = render(
      <Table className="custom-table">
        <Table.Body>
          <Table.Row>
            <Table.Cell>Data</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    const table = container.querySelector('table');
    expect(table?.className).toContain('custom-table');
  });

  it('wraps in overflow-x-auto container', () => {
    const { container } = render(
      <Table>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Data</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    expect(container.querySelector('.overflow-x-auto')).toBeInTheDocument();
  });
});
