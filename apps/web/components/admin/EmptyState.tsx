/**
 * Uniform empty state for admin pages.
 * Replaces scattered `<div className="text-gray-500">沒有資料</div>` snippets.
 */
import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Optional CTA — typically a <Link> or <button>. */
  action?: ReactNode;
  /** Compact variant has no border + reduced padding (for in-card emptiness). */
  variant?: 'card' | 'inline';
  /** Custom icon component (defaults to Inbox). Provide lucide or compatible. */
  icon?: React.ComponentType<{ className?: string }>;
}

export function EmptyState({
  title,
  description,
  action,
  variant = 'card',
  icon: Icon = Inbox,
}: EmptyStateProps) {
  const isInline = variant === 'inline';
  return (
    <div
      className={
        isInline
          ? 'flex flex-col items-center gap-3 py-8 text-center'
          : 'flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-strong bg-white px-6 py-14 text-center'
      }
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
        <Icon className="h-7 w-7 text-brand-400" aria-hidden="true" />
      </div>
      <p className="text-base font-medium text-ink-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
