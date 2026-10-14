import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Input } from './input';
import { Skeleton } from './skeleton';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Right-align numeric columns. */
    align?: 'left' | 'right' | 'center';
    /** Human label for the column picker (defaults to the header string or column id). */
    label?: string;
  }
}

/** Server-driven sorting and paging: rows arrive already sorted and paginated. */
export interface ServerSideOptions {
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  /** 1-based page number. */
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface DataTableProps<TData> {
  // TanStack's ColumnDef needs `any` for the value type to accept mixed column types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  data: TData[];
  /** Accessible table caption (visually hidden). */
  caption: string;
  isLoading?: boolean;
  emptyMessage?: ReactNode;
  /** Show a quick-filter box that searches all columns. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Show the column visibility picker. */
  columnPicker?: boolean;
  initialSorting?: SortingState;
  initialHidden?: string[];
  /** Client-side page size; omit to show all rows (virtualisation arrives with big tables). */
  pageSize?: number;
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData, index: number) => string;
  toolbar?: ReactNode;
  className?: string;
  /** Hand sorting and pagination to the server (large lists like player search). */
  server?: ServerSideOptions;
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/** Dense, sortable, filterable data table used across the game's list screens. */
export function DataTable<TData>({
  columns,
  data,
  caption,
  isLoading = false,
  emptyMessage = 'Nothing to show.',
  searchable = false,
  searchPlaceholder = 'Filter…',
  columnPicker = false,
  initialSorting = [],
  initialHidden = [],
  pageSize,
  onRowClick,
  getRowId,
  toolbar,
  className,
  server,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    Object.fromEntries(initialHidden.map((id) => [id, false])),
  );

  // TanStack Table returns non-memoisable functions by design; the React Compiler lint
  // rule knows this and skips the component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting: server ? server.sorting : sorting, globalFilter, columnVisibility },
    onSortingChange: server
      ? (updater) =>
          server.onSortingChange(typeof updater === 'function' ? updater(server.sorting) : updater)
      : setSorting,
    ...(server ? { manualSorting: true, manualPagination: true, enableSortingRemoval: false } : {}),
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    ...(server ? {} : { getSortedRowModel: getSortedRowModel() }),
    getFilteredRowModel: getFilteredRowModel(),
    ...(pageSize
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageSize } },
        }
      : {}),
    ...(getRowId ? { getRowId } : {}),
  });

  const visibleColumns = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;
  const showToolbar = searchable || columnPicker || toolbar;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && (
            <div className="relative w-full max-w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-fg-subtle" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-7 pl-7 text-xs"
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {toolbar}
            {columnPicker && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <Columns3 /> Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllLeafColumns()
                    .filter((c) => c.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(v) => column.toggleVisibility(Boolean(v))}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {column.columnDef.meta?.label ??
                          (typeof column.columnDef.header === 'string'
                            ? column.columnDef.header
                            : column.id)}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-surface-2">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
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
                        'h-8 border-b border-border px-2.5 text-2xs font-semibold tracking-wide whitespace-nowrap text-fg-subtle uppercase',
                        alignClass[meta?.align ?? 'left'],
                      )}
                      style={header.column.columnDef.size ? { width: header.getSize() } : undefined}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'inline-flex items-center gap-1 uppercase hover:text-fg',
                            sorted && 'text-fg',
                          )}
                        >
                          {content}
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3" aria-hidden />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3" aria-hidden />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-40" aria-hidden />
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
          <tbody aria-busy={isLoading || undefined}>
            {isLoading ? (
              Array.from({ length: 6 }, (_, i) => (
                // Placeholder rows are visual only: hidden from assistive tech (and from row queries).
                <tr key={i} aria-hidden className="border-b border-border last:border-0">
                  {Array.from({ length: visibleColumns }, (_, j) => (
                    <td key={j} className="px-2.5 py-2">
                      <Skeleton className="h-3.5 w-full max-w-28" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns} className="px-3 py-8 text-center text-fg-subtle">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    'border-b border-border transition-colors last:border-0 odd:bg-surface even:bg-surface-2/40 hover:bg-surface-hover',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'h-8 px-2.5 whitespace-nowrap',
                        alignClass[cell.column.columnDef.meta?.align ?? 'left'],
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {server && server.pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-fg-muted">
          <span className="tabular">
            Page {server.page} of {server.pageCount} · {server.total.toLocaleString()} results
          </span>
          <Button
            size="sm"
            onClick={() => server.onPageChange(server.page - 1)}
            disabled={server.page <= 1}
          >
            Previous
          </Button>
          <Button
            size="sm"
            onClick={() => server.onPageChange(server.page + 1)}
            disabled={server.page >= server.pageCount}
          >
            Next
          </Button>
        </div>
      )}

      {!server && pageSize && table.getPageCount() > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-fg-muted">
          <span className="tabular">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} ·{' '}
            {table.getFilteredRowModel().rows.length} rows
          </span>
          <Button
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
