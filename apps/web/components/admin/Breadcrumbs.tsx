/**
 * Auto-generated breadcrumbs from the current pathname.
 *
 * Path segments are mapped to a fixed Traditional Chinese label list. Detail
 * segments (UUIDs, anything not in the map) collapse to a generic '詳細' so
 * raw IDs never leak into the trail.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const SEGMENT_LABELS: Record<string, string> = {
  admin: '管理後台',
  dashboard: 'Dashboard',
  'service-requests': '需求單管理',
  providers: '服務人員管理',
  recipients: '被照護者總覽',
  users: '使用者管理',
  services: '服務類別',
  preview: '角色預覽',
  'audit-log': '審核日誌',
  reports: '月報表',
};

const DETAIL_FALLBACK_LABEL = '詳細';

export function Breadcrumbs() {
  const pathname = usePathname() ?? '';
  const segments = pathname.split('/').filter(Boolean);

  // Only render breadcrumbs inside admin. The /admin root → dashboard, so
  // skip when there's only one segment or it's not the admin section at all.
  if (segments.length === 0 || segments[0] !== 'admin') return null;
  if (segments.length === 1) return null;

  const crumbs = segments.map((seg, idx) => {
    const href = '/' + segments.slice(0, idx + 1).join('/');
    const label = SEGMENT_LABELS[seg] ?? DETAIL_FALLBACK_LABEL;
    return { href, label };
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          const isFirst = idx === 0;
          return (
            <li key={crumb.href} className="flex items-center gap-1.5">
              {idx > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-300" aria-hidden="true" />
              )}
              {isLast ? (
                <span aria-current="page" className="font-medium text-ink-900">
                  {isFirst && <Home className="mr-1 inline h-3.5 w-3.5 -translate-y-px" aria-hidden="true" />}
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="flex items-center gap-1 text-ink-500 transition-colors hover:text-brand-600 hover:underline"
                >
                  {isFirst && <Home className="h-3.5 w-3.5" aria-hidden="true" />}
                  <span>{crumb.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
