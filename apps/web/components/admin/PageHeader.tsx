/**
 * Standard page header for admin pages: title (h1) + optional badge + optional
 * right-aligned actions slot (buttons, filter selects).
 *
 * Replaces inconsistent inline `<h1>` + ad-hoc filter rows. Keeps the page
 * body free of layout boilerplate.
 */
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  /** Right-aligned content (buttons, filter selects, etc.). */
  actions?: ReactNode;
}

export function PageHeader({ title, description, badge, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-outline pb-6">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="mt-1.5 text-sm text-ink-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
