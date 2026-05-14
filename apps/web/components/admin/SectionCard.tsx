/**
 * Section card with iconified header — the recurring "card with title + icon
 * + body" pattern used across admin detail pages.
 *
 * Replaces 4 separate local definitions that used to live in preview,
 * recipients/[id], providers/[id], and service-requests/[id] pages.
 *
 * `tone` allows highlighting the section header for status-aware contexts:
 *   - default → brand-50 icon wrap (most cases)
 *   - brand   → brand-100 icon wrap (slightly stronger emphasis)
 *   - positive → positive-soft icon wrap (e.g. "已指派服務者" affirmative)
 */
import type { ReactNode } from 'react';

export type SectionTone = 'default' | 'brand' | 'positive';

interface SectionCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone?: SectionTone;
  children: ReactNode;
}

const ICON_WRAP_CLASSES: Record<SectionTone, string> = {
  default:  'bg-brand-50 text-brand-600',
  brand:    'bg-brand-100 text-brand-700',
  positive: 'bg-positive-soft text-positive',
};

export function SectionCard({ icon: Icon, title, tone = 'default', children }: SectionCardProps) {
  return (
    <div className="rounded-2xl border border-outline bg-white p-6 shadow-brand-low">
      <div className="mb-5 flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${ICON_WRAP_CLASSES[tone]}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}
