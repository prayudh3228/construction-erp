import { type ColumnDef } from '@tanstack/react-table';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type DataTableProps } from './data-table';

interface Item {
  id: string;
  name: string;
  kind: 'steel' | 'cement';
  qty: number;
}

/** 23 rows: steel-01..steel-12 (odd) and cement rows, qty = index. */
const ROWS: Item[] = Array.from({ length: 23 }, (_, i) => ({
  id: `r${i + 1}`,
  name: `${i % 2 === 0 ? 'Steel' : 'Cement'} lot ${String(i + 1).padStart(2, '0')}`,
  kind: i % 2 === 0 ? 'steel' : 'cement',
  qty: i + 1,
}));

const columns: ColumnDef<Item, unknown>[] = [
  { accessorKey: 'name', header: 'Name', enableHiding: false },
  {
    accessorKey: 'kind',
    header: 'Kind',
    filterFn: 'equalsString',
    meta: {
      filterAllLabel: 'All kinds',
      filterOptions: [
        { value: 'steel', label: 'Steel' },
        { value: 'cement', label: 'Cement' },
      ],
    },
  },
  { accessorKey: 'qty', header: 'Qty', meta: { align: 'right' } },
];

function setup(props: Partial<DataTableProps<Item>> = {}) {
  const user = userEvent.setup();
  render(
    <DataTable label="Items" columns={columns} data={ROWS} getRowId={(r) => r.id} {...props} />,
  );
  const table = () => screen.getByRole('table', { name: 'Items' });
  const bodyRows = () => within(table()).getAllByRole('row').slice(1);
  const firstCells = () => bodyRows().map((r) => within(r).getAllByRole('cell')[0]!.textContent);
  return { user, table, bodyRows, firstCells };
}

describe('DataTable', () => {
  it('paginates 10 rows a page and reports the range', async () => {
    const { user, bodyRows } = setup();
    expect(bodyRows()).toHaveLength(10);
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1–10 of 23');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    // Last page: rows 21-23.
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 21–23 of 23');
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('changes page size and goes back to page 1', async () => {
    const { user, bodyRows } = setup();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '25');
    expect(bodyRows()).toHaveLength(23);
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });

  it('searches across columns and resets to page 1', async () => {
    const { user, bodyRows, firstCells } = setup();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search items' }), 'lot 2');
    // "lot 20".."lot 23"
    expect(firstCells()).toEqual([
      'Cement lot 20',
      'Steel lot 21',
      'Cement lot 22',
      'Steel lot 23',
    ]);
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1–4 of 4 (filtered from 23)');
    expect(bodyRows()).toHaveLength(4);
  });

  it('filters by an exact option value', async () => {
    const { user } = setup();
    const select = screen.getByRole('combobox', { name: 'Filter by kind' });
    expect(within(select).getByRole('option', { name: 'All kinds' })).toBeInTheDocument();
    await user.selectOptions(select, 'steel');
    // 12 steel rows (indexes 0,2,...,22).
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1–10 of 12 (filtered from 23)');
  });

  it('sorts by clicking the header and exposes aria-sort', async () => {
    const { user, firstCells } = setup();
    const qtyHeader = screen.getByRole('columnheader', { name: /Qty/ });
    expect(qtyHeader).not.toHaveAttribute('aria-sort');

    await user.click(within(qtyHeader).getByRole('button'));
    expect(qtyHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(firstCells()[0]).toBe('Steel lot 01');

    await user.click(within(qtyHeader).getByRole('button'));
    expect(qtyHeader).toHaveAttribute('aria-sort', 'descending');
    expect(firstCells()[0]).toBe('Steel lot 23');
  });

  it('shows a no-matches state with a working clear button', async () => {
    const { user, bodyRows } = setup();
    await user.type(screen.getByRole('searchbox'), 'granite');
    expect(screen.getByRole('heading', { name: 'No matches' })).toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    const clear = screen.getAllByRole('button', { name: 'Clear filters' });
    await user.click(clear[clear.length - 1]!);
    expect(bodyRows()).toHaveLength(10);
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('hides a column from the column chooser, but never the last one', async () => {
    const { user, table } = setup();
    await user.click(screen.getByRole('button', { name: 'Columns' }));
    // Name cannot be hidden (enableHiding: false), so only Kind and Qty are offered.
    const items = screen.getAllByRole('menuitemcheckbox');
    expect(items.map((i) => i.textContent)).toEqual(['Kind', 'Qty']);
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Qty' }));
    // The menu stays open for more changes; close it to read the table again.
    await user.keyboard('{Escape}');
    expect(within(table()).queryByRole('columnheader', { name: /Qty/ })).not.toBeInTheDocument();
    expect(within(table()).getByRole('columnheader', { name: /Kind/ })).toBeInTheDocument();
  });

  it('shows the empty state when there is no data at all', () => {
    setup({ data: [], empty: { title: 'No items yet', description: 'Add one.' } });
    expect(screen.getByRole('heading', { name: 'No items yet' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows skeleton rows and a status message while loading', () => {
    const { table } = setup({ data: undefined, isLoading: true });
    expect(table()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Loading items…');
    expect(screen.getByRole('searchbox')).toBeDisabled();
  });

  it('shows an error state with retry', async () => {
    const onRetry = vi.fn();
    const { user } = setup({ error: new Error('boom'), onRetry });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load items');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('opens a row by mouse or by its keyboard-reachable button', async () => {
    const onRowClick = vi.fn();
    const { user, bodyRows } = setup({ onRowClick, rowActionLabel: (r) => `Open ${r.name}` });
    await user.click(within(bodyRows()[1]!).getAllByRole('cell')[2]!);
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[1]);

    const btn = screen.getByRole('button', { name: 'Open Steel lot 03' });
    btn.focus();
    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[2]);
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });
});
