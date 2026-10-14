import type { ColumnDef } from '@tanstack/react-table';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from './data-table';

interface Row {
  name: string;
  age: number;
}

const rows: Row[] = [
  { name: 'Bravo', age: 30 },
  { name: 'Alpha', age: 22 },
  { name: 'Charlie', age: 26 },
];
const columns: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'age', header: 'Age' },
];

const bodyNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0]?.textContent);

describe('DataTable', () => {
  it('sorts when a header is clicked and exposes aria-sort', async () => {
    const user = userEvent.setup();
    render(<DataTable caption="People" columns={columns} data={rows} />);
    expect(bodyNames()).toEqual(['Bravo', 'Alpha', 'Charlie']);

    await user.click(screen.getByRole('button', { name: /name/i }));
    expect(bodyNames()).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(screen.getByRole('columnheader', { name: /name/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await user.click(screen.getByRole('button', { name: /name/i }));
    expect(bodyNames()).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });

  it('filters rows with the quick filter', async () => {
    const user = userEvent.setup();
    render(<DataTable caption="People" columns={columns} data={rows} searchable />);
    await user.type(screen.getByRole('textbox', { name: /filter/i }), 'char');
    expect(bodyNames()).toEqual(['Charlie']);
  });

  it('shows the empty message and handles row clicks', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const { rerender } = render(
      <DataTable caption="People" columns={columns} data={[]} emptyMessage="Nobody here" />,
    );
    expect(screen.getByText('Nobody here')).toBeInTheDocument();

    rerender(<DataTable caption="People" columns={columns} data={rows} onRowClick={onRowClick} />);
    await user.click(screen.getByText('Alpha'));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });
});
