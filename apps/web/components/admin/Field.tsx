/**
 * Single labelled-value row used inside admin detail-page section cards.
 *
 * Pattern: icon + label / value, with consistent spacing and typography.
 * Used inside `<dl>` containers — emits `<dt>` and `<dd>` for semantic markup
 * (HTML5 allows wrapping these in `<div>` directly inside `<dl>`).
 *
 * Replaces 3 separate local definitions that used to live in
 * recipients/[id], providers/[id], and service-requests/[id] pages.
 */
import type { ReactNode } from 'react';

interface FieldProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Renders as `—` when falsy. */
  value: ReactNode;
  /** When true, preserves whitespace + line breaks (for description / notes). */
  multiline?: boolean;
}

export function Field({ icon: Icon, label, value, multiline }: FieldProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-alt">
        <Icon className="h-3.5 w-3.5 text-ink-500" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-ink-500">{label}</dt>
        <dd className={`mt-0.5 text-sm text-ink-900 ${multiline ? 'whitespace-pre-wrap' : ''}`}>
          {value || <span className="text-ink-300">—</span>}
        </dd>
      </div>
    </div>
  );
}
