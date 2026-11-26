import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type Row,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  SearchX,
} from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { cn } from '@/lib/cn';
import { EmptyState, ErrorState } from '../states';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Input, NativeSelect } from '../ui/input';
import { Skeleton } from '../ui/skeleton';

/** Extra column settings the table reads from `column.meta`. */
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Name shown in the column chooser (defaults to the header text or id). */
    label?: string;
    align?: 'left' | 'right';
    /** Shown in a filter drop-down above the table. */
    filterOptions?: readonly { value: string; label: string }[];
    /** First option of that drop-down, e.g. "All statuses". */
    filterAllLabel?: string;
  }
}

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export interface DataTableProps<TData> {
  /** Accessible name of the table, e.g. "Projects". */
  label: string;
  columns: ColumnDef<TData, unknown>[];
  data: readonly TData[] | undefined;
  getRowId: (row: TData) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** What to show when there is no data at all (not when a search finds nothing). */
  empty?: { title: string; description?: ReactNode; action?: ReactNode };
  searchPlaceholder?: string;
  initialPageSize?: (typeof PAGE_SIZES)[number];
  initialSorting?: SortingState;
  onRowClick?: (row: TData) => void;
  /** Accessible name for the row action, e.g. (row) => `Open ${row.name}`. */
  rowActionLabel?: (row: TData) => string;
  toolbar?: ReactNode;
}

export function DataTable<TData>({
  label,
  columns,
  data,
  getRowId,
  isLoading = false,
  error,
  onRetry,
  empty = { title: 'Nothing here yet' },
  searchPlaceholder = 'Search…',
  initialPageSize = 10,
  initialSorting = [],
  onRowClick,
  rowActionLabel,
  toolbar,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const searchId = useId();

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 is not compiler-safe; this component opts out.
  const table = useReactTable({
    data: (data ?? []) as TData[],
    columns,
    getRowId: (row) => getRowId(row),
    state: { sorting, globalFilter, columnFilters, columnVisibility, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: (v: string) => {
      setGlobalFilter(v);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onColumnFiltersChange: (updater) => {
      setColumnFilters(updater);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    globalFilterFn: 'includesString',
    // Every column sorts ascending on the first click (TanStack's default is descending for numbers).
    sortDescFirst: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  });

  if (error) {
    return (
      <ErrorState
        title={`Could not load ${label.toLowerCase()}`}
        description="Check your connection and try again. If it keeps happening, tell the admin."
        onRetry={onRetry}
      />
    );
  }

  const total = data?.length ?? 0;
  if (!isLoading && total === 0) {
    return <EmptyState title={empty.title} description={empty.description} action={empty.action} />;
  }

  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const from = filteredCount === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(filteredCount, (pageIndex + 1) * pageSize);
  const filterColumns = table.getAllLeafColumns().filter((c) => c.columnDef.meta?.filterOptions);
  const hideableColumns = table.getAllLeafColumns().filter((c) => c.getCanHide());
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const hasFilters = globalFilter !== '' || columnFilters.length > 0;

  const columnLabel = (id: string) => {
    const col = table.getColumn(id);
    const header = col?.columnDef.header;
    return col?.columnDef.meta?.label ?? (typeof header === 'string' ? header : id);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-48 flex-1 gap-1 sm:max-w-xs">
          <label htmlFor={searchId} className="sr-only">
            Search {label.toLowerCase()}
          </label>
          <Input
            id={searchId}
            type="search"
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            disabled={isLoading}
          />
        </div>
        {filterColumns.map((col) => {
          const options = col.columnDef.meta?.filterOptions ?? [];
          const name = columnLabel(col.id);
          return (
            <NativeSelect
              key={col.id}
              aria-label={`Filter by ${name.toLowerCase()}`}
              className="w-auto"
              value={(col.getFilterValue() as string | undefined) ?? ''}
              onChange={(e) => col.setFilterValue(e.target.value || undefined)}
              disabled={isLoading}
            >
              <option value="">
                {col.columnDef.meta?.filterAllLabel ?? `All: ${name.toLowerCase()}`}
              </option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          );
        })}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              table.setGlobalFilter('');
              table.resetColumnFilters();
            }}
          >
            Clear filters
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          {hideableColumns.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="md" disabled={isLoading}>
                  <Columns3 aria-hidden />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideableColumns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    // Keep at least one column, or the table has nothing to show.
                    disabled={col.getIsVisible() && visibleColumnCount === 1}
                    onCheckedChange={(v) => col.toggleVisibility(v === true)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {columnLabel(col.id)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full border-collapse text-sm" aria-label={label} aria-busy={isLoading}>
          <thead className="bg-surface-muted text-left">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  const align = header.column.columnDef.meta?.align;
                  const content = header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext());
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                      className={cn(
                        'h-10 border-b border-border px-3 font-medium whitespace-nowrap text-muted-foreground',
                        align === 'right' && 'text-right',
                      )}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            '-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground',
                            align === 'right' && 'flex-row-reverse',
                          )}
                        >
                          {content}
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3.5" aria-hidden />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />
                          )}
                        </button>
                      ) : (
                        content
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: Math.min(pageSize, 5) }, (_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {table.getVisibleLeafColumns().map((c) => (
                      <td key={c.id} className="px-3 py-3">
                        <Skeleton className="h-4 w-full max-w-40" />
                      </td>
                    ))}
                  </tr>
                ))
              : table
                  .getRowModel()
                  .rows.map((row) => (
                    <DataRow
                      key={row.id}
                      row={row}
                      onRowClick={onRowClick}
                      rowActionLabel={rowActionLabel}
                    />
                  ))}
          </tbody>
        </table>
        {isLoading && (
          <p role="status" className="sr-only">
            Loading {label.toLowerCase()}…
          </p>
        )}
        {!isLoading && filteredCount === 0 && (
          <EmptyState
            className="m-4"
            icon={<SearchX aria-hidden />}
            title="No matches"
            description="Nothing matches your search or filters. Try different words or clear the filters."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  table.setGlobalFilter('');
                  table.resetColumnFilters();
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}
      </div>

      {!isLoading && filteredCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <p aria-live="polite">
            Showing <span className="tabular text-foreground">{from}</span>–
            <span className="tabular text-foreground">{to}</span> of{' '}
            <span className="tabular text-foreground">{filteredCount}</span>
            {filteredCount !== total && <> (filtered from {total})</>}
          </p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              <span aria-hidden>Rows per page</span>
              <NativeSelect
                aria-label="Rows per page"
                className="w-auto"
                value={pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value));
                  table.setPageIndex(0);
                }}
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <span className="tabular px-1">
              Page {pageIndex + 1} of {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DataRow<TData>({
  row,
  onRowClick,
  rowActionLabel,
}: {
  row: Row<TData>;
  onRowClick?: (row: TData) => void;
  rowActionLabel?: (row: TData) => string;
}) {
  const clickable = !!onRowClick;
  const cells = row.getVisibleCells();
  return (
    <tr
      className={cn(
        'border-b border-border last:border-0',
        clickable && 'cursor-pointer hover:bg-surface-muted',
      )}
      onClick={clickable ? () => onRowClick(row.original) : undefined}
    >
      {cells.map((cell, i) => (
        <td
          key={cell.id}
          className={cn(
            'px-3 py-2.5 align-middle',
            cell.column.columnDef.meta?.align === 'right' && 'text-right',
          )}
        >
          {/* Keyboard users reach the row action through a real button in the first cell. */}
          {clickable && i === 0 ? (
            <button
              type="button"
              className="text-left font-medium text-primary hover:underline"
              aria-label={rowActionLabel?.(row.original)}
              onClick={(e) => {
                e.stopPropagation();
                onRowClick(row.original);
              }}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </button>
          ) : (
            flexRender(cell.column.columnDef.cell, cell.getContext())
          )}
        </td>
      ))}
    </tr>
  );
}
