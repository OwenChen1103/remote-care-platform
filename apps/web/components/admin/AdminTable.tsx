/**
 * Generic admin list table.
 *
 * Consolidates the same pattern repeated across 6+ admin list pages:
 *   - Overflow-x scroll wrapper + bordered card shell
 *   - sticky header row with brand-tinted bg
 *   - cells with `whitespace-nowrap px-4 py-3 text-sm`
 *   - paginated footer ("共 N 筆 / 上一頁 / 下一頁")
 *
 * Optional column sorting: pass `sortKey` on a column to make its header
 * clickable. Track current state via `sort` prop + `onSortChange` callback.
 * Sort cycle on click: none → asc → desc → none. The actual sort happens
 * on the server — pass the `sort` state into your fetch as `?sort=key:order`.
 */
'use client';

import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { ErrorBanner } from './LoadingState';

export interface AdminTableColumn<T> {
  key: string;
  header: ReactNode;
  /** Renderer for a cell. Receives the typed row. */
  cell: (row: T) => ReactNode;
  /** Default left. */
  align?: 'left' | 'right' | 'center';
  /** Default true. Set false for description / long-text columns. */
  whitespaceNowrap?: boolean;
  /** Tailwind classes added to the <td> for this column. */
  cellClassName?: string;
  /** When set, the header becomes a sort toggle. Value should match an
   *  API-recognised field name (e.g. 'created_at'). */
  sortKey?: string;
}

export type SortState = { key: string; order: 'asc' | 'desc' } | null;

interface AdminTableProps<T> {
  data: T[];
  columns: AdminTableColumn<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Pagination footer — omitting it hides the footer altogether. */
  pagination?: {
    page: number;
    total: number;
    limit: number;
    onPageChange: (page: number) => void;
  };
  /** Current sort state (null = server default). */
  sort?: SortState;
  /** Called when the user clicks a sortable column header. Cycle: none → asc → desc → none. */
  onSortChange?: (next: SortState) => void;
}

export function AdminTable<T>({
  data,
  columns,
  rowKey,
  loading,
  error,
  onRetry,
  emptyTitle = '目前沒有資料',
  emptyDescription,
  pagination,
  sort,
  onSortChange,
}: AdminTableProps<T>) {
  if (error) {
    return <ErrorBanner message={error} onRetry={onRetry} />;
  }
  if (loading) {
    return <TableSkeleton columns={columns.length} />;
  }
  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.limit)) : 0;

  const handleSortClick = (key: string) => {
    if (!onSortChange) return;
    // Cycle: not-sorting-this-column → asc → desc → null (reset)
    if (!sort || sort.key !== key) {
      onSortChange({ key, order: 'asc' });
      return;
    }
    if (sort.order === 'asc') {
      onSortChange({ key, order: 'desc' });
      return;
    }
    onSortChange(null);
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-outline bg-white shadow-brand-low">
        <table className="min-w-full divide-y divide-outline">
          <thead className="bg-surface-alt">
            <tr>
              {columns.map((col) => {
                const sortable = !!col.sortKey && !!onSortChange;
                const active = sortable && sort?.key === col.sortKey;
                const ariaSort: 'ascending' | 'descending' | 'none' | undefined = active
                  ? (sort?.order === 'asc' ? 'ascending' : 'descending')
                  : sortable
                    ? 'none'
                    : undefined;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-ink-500 ${alignClass(col.align)}`}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSortClick(col.sortKey!)}
                        className={`group inline-flex items-center gap-1 rounded transition-colors hover:text-ink-900 ${active ? 'text-brand-600' : ''}`}
                      >
                        <span>{col.header}</span>
                        {active ? (
                          sort?.order === 'asc' ? (
                            <ArrowUp className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="h-3 w-3" aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown
                            className="h-3 w-3 text-ink-300 transition-colors group-hover:text-ink-500"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline">
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                className="transition-colors duration-150 hover:bg-brand-50/40"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-5 py-4 text-sm text-ink-700 ${
                      col.whitespaceNowrap === false ? '' : 'whitespace-nowrap'
                    } ${alignClass(col.align)} ${col.cellClassName ?? ''}`}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-700">
          <span>共 <strong className="font-semibold text-ink-900">{pagination.total}</strong> 筆</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-outline bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              上一頁
            </button>
            <span className="px-2 py-1 text-xs text-ink-500">
              第 <strong className="text-ink-900">{pagination.page}</strong> / {totalPages} 頁
            </span>
            <button
              type="button"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-outline bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一頁
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function alignClass(align?: 'left' | 'right' | 'center') {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

/** Shimmering placeholder rows that mimic the table structure during fetch. */
function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-outline bg-white shadow-brand-low">
      <div className="border-b border-outline bg-surface-alt px-5 py-3.5">
        <div className="h-3 w-32 animate-pulse rounded bg-outline" />
      </div>
      <div className="divide-y divide-outline">
        {Array.from({ length: 5 }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-4">
            {Array.from({ length: columns }).map((__, c) => (
              <div
                key={c}
                className="h-3 flex-1 animate-pulse rounded bg-surface-alt"
                style={{ animationDelay: `${r * 80 + c * 40}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
