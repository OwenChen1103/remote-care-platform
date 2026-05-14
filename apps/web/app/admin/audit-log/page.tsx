/**
 * Admin audit log viewer.
 *
 * Read-only timeline view of every privileged action recorded by
 * `apps/web/lib/admin-audit.ts`. Supports filtering by action type, target
 * type, admin user, date range, and (via URL query) target id.
 *
 * Each entry is a clickable card that opens a details modal showing full
 * metadata, IP, and user-agent.
 */
'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Calendar,
  ChevronRight,
  Eye,
  History,
  Mail,
  MapPin,
  Monitor,
  Tag,
  X,
} from 'lucide-react';
import {
  Avatar,
  ErrorBanner,
  LoadingState,
  PageHeader,
} from '@/components/admin';
import {
  ADMIN_ACTION_OPTIONS,
  ADMIN_TARGET_TYPE_OPTIONS,
  getAdminActionLabel,
  getAdminTargetTypeLabel,
} from '@/lib/admin-audit-labels';

interface AuditLog {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  admin: { id: string; name: string; email: string };
}

interface PaginatedResponse {
  success: boolean;
  data: AuditLog[];
  meta: { page: number; limit: number; total: number };
}

interface AdminUserOption {
  id: string;
  name: string;
  email: string;
}

function dateToIsoStart(d: string): string | undefined {
  if (!d) return undefined;
  const date = new Date(`${d}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
function dateToIsoEnd(d: string): string | undefined {
  if (!d) return undefined;
  const date = new Date(`${d}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Color tone hints per action — used to colorise the timeline dots. */
function actionTone(action: string): 'positive' | 'warning' | 'danger' | 'brand' {
  if (action.endsWith('.suspend') || action.endsWith('.cancel') || action === 'provider.review') {
    // These can be destructive — but provider.review can also be approval. We
    // settle for brand as neutral; the action label is the source of truth.
    return action === 'provider.review' ? 'brand' : 'danger';
  }
  if (action.endsWith('.unsuspend')) return 'positive';
  if (action === 'preview.access') return 'warning';
  return 'brand';
}

const TONE_CLASSES: Record<'positive' | 'warning' | 'danger' | 'brand', { dot: string; ring: string; bg: string; text: string }> = {
  positive: { dot: 'bg-positive',  ring: 'ring-positive-soft',  bg: 'bg-positive-soft',  text: 'text-positive' },
  warning:  { dot: 'bg-warning',   ring: 'ring-warning-soft',   bg: 'bg-warning-soft',   text: 'text-warning' },
  danger:   { dot: 'bg-danger',    ring: 'ring-danger-soft',    bg: 'bg-danger-soft',    text: 'text-danger' },
  brand:    { dot: 'bg-brand-500', ring: 'ring-brand-50',       bg: 'bg-brand-50',       text: 'text-brand-700' },
};

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString('zh-TW');
}

export default function AdminAuditLogPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AuditLogPageInner />
    </Suspense>
  );
}

function AuditLogPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const targetIdFilter = searchParams?.get('target_id') ?? '';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState(
    searchParams?.get('target_type') ?? '',
  );
  const [adminFilter, setAdminFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [admins, setAdmins] = useState<AdminUserOption[]>([]);
  const [detailsOpen, setDetailsOpen] = useState<AuditLog | null>(null);

  const limit = 30;

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/v1/admin/users?role=admin&limit=100');
        const json = (await res.json()) as { success: boolean; data: AdminUserOption[] };
        if (json.success) setAdmins(json.data ?? []);
      } catch { /* non-fatal */ }
    })();
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (actionFilter) params.set('action', actionFilter);
      if (targetTypeFilter) params.set('target_type', targetTypeFilter);
      if (targetIdFilter) params.set('target_id', targetIdFilter);
      if (adminFilter) params.set('admin_user_id', adminFilter);
      const fromIso = dateToIsoStart(dateFrom);
      const toIso = dateToIsoEnd(dateTo);
      if (fromIso) params.set('from', fromIso);
      if (toIso) params.set('to', toIso);

      const res = await fetch(`/api/v1/admin/audit-log?${params.toString()}`);
      const json = (await res.json()) as PaginatedResponse;
      if (json.success) {
        setLogs(json.data);
        setTotal(json.meta.total);
      } else {
        setError('載入失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, targetTypeFilter, targetIdFilter, adminFilter, dateFrom, dateTo]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const applyDatePreset = (days: number) => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - (days - 1));
    setDateFrom(formatLocalDate(start));
    setDateTo(formatLocalDate(today));
    setPage(1);
  };

  const clearDateRange = () => {
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const clearTargetIdFilter = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('target_id');
    const qs = params.toString();
    router.push(qs ? `/admin/audit-log?${qs}` : '/admin/audit-log');
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <PageHeader
        title="審核日誌"
        description="所有管理員行為的完整紀錄；可用於追溯誰在何時對哪個資源做了什麼"
      />

      {/* Filters — categorical */}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Select
          label="動作類型"
          value={actionFilter}
          onChange={(v) => { setActionFilter(v); setPage(1); }}
          options={ADMIN_ACTION_OPTIONS}
        />
        <Select
          label="目標類型"
          value={targetTypeFilter}
          onChange={(v) => { setTargetTypeFilter(v); setPage(1); }}
          options={ADMIN_TARGET_TYPE_OPTIONS}
        />
        <Select
          label="操作管理員"
          value={adminFilter}
          onChange={(v) => { setAdminFilter(v); setPage(1); }}
          options={[
            { value: '', label: '全部管理員' },
            ...admins.map((a) => ({ value: a.id, label: `${a.name}（${a.email}）` })),
          ]}
        />
        {targetIdFilter && (
          <span className="inline-flex items-center gap-1 self-end rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            篩選資源 ID：{targetIdFilter.slice(0, 8)}...
            <button
              type="button"
              onClick={clearTargetIdFilter}
              className="ml-1 rounded p-0.5 hover:bg-brand-100"
              aria-label="清除資源 ID 篩選"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
      </div>

      {/* Filters — date range */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">起始日期</label>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-lg border border-outline bg-white px-3 py-1.5 text-sm shadow-brand-low focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">結束日期</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-lg border border-outline bg-white px-3 py-1.5 text-sm shadow-brand-low focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 self-end pb-0.5">
          {[
            { label: '今日',     days: 1 },
            { label: '近 7 天',  days: 7 },
            { label: '近 30 天', days: 30 },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyDatePreset(p.days)}
              className="rounded-lg border border-outline bg-white px-2.5 py-1 text-xs font-medium text-ink-700 transition-colors hover:border-brand-200 hover:bg-brand-50"
            >
              {p.label}
            </button>
          ))}
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={clearDateRange}
              className="rounded-lg border border-outline bg-white px-2.5 py-1 text-xs font-medium text-ink-500 hover:bg-surface-alt"
            >
              清除日期
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      {error ? (
        <ErrorBanner message={error} onRetry={() => void fetchLogs()} />
      ) : loading ? (
        <LoadingState />
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-strong bg-white px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
            <History className="h-7 w-7 text-brand-400" aria-hidden="true" />
          </div>
          <p className="text-base font-medium text-ink-900">目前沒有符合條件的審核紀錄</p>
          <p className="text-sm text-ink-500">調整篩選條件或執行一些管理動作後再回來查看</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-outline bg-white p-6 shadow-brand-low">
          <ul className="relative space-y-2 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-outline">
            {logs.map((log) => {
              const tone = actionTone(log.action);
              const toneClasses = TONE_CLASSES[tone];
              return (
                <li key={log.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setDetailsOpen(log)}
                    className="group relative flex w-full items-start gap-4 rounded-xl px-2 py-3 text-left transition-colors hover:bg-surface-alt"
                  >
                    {/* Timeline dot */}
                    <span
                      className={`relative z-10 mt-1 flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full ring-4 ring-white`}
                      aria-hidden="true"
                    >
                      <span className={`h-[14px] w-[14px] rounded-full ${toneClasses.dot} ring-4 ${toneClasses.ring}`} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${toneClasses.bg} ${toneClasses.text}`}>
                          {getAdminActionLabel(log.action)}
                        </span>
                        {log.target_type && (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                            <Tag className="h-3 w-3" />
                            {getAdminTargetTypeLabel(log.target_type)}
                          </span>
                        )}
                        <span className="text-xs text-ink-500">
                          {formatRelativeTime(log.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink-900">{log.summary}</p>
                      {/* Avatar renders a <div>, so this admin-credit row uses
                          <div> rather than <p> — HTML doesn't allow block
                          descendants inside <p> (causes hydration errors). */}
                      <div className="mt-1 inline-flex items-center gap-1 text-xs text-ink-500">
                        <Avatar name={log.admin.name} size="sm" />
                        <span>{log.admin.name}</span>
                        <span className="text-ink-300">・</span>
                        <span>{log.admin.email}</span>
                      </div>
                    </div>

                    <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-500" />
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-outline pt-4 text-sm text-ink-700">
              <span>共 <strong className="font-semibold text-ink-900">{total}</strong> 筆</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="rounded-lg border border-outline bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一頁
                </button>
                <span className="px-2 text-xs text-ink-500">
                  第 <strong className="text-ink-900">{page}</strong> / {totalPages} 頁
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="rounded-lg border border-outline bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一頁
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <DetailsModal log={detailsOpen} onClose={() => setDetailsOpen(null)} />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-outline bg-white px-3 py-1.5 text-sm shadow-brand-low focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DetailsModal({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  useEffect(() => {
    if (!log) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [log, onClose]);

  if (!log) return null;

  const metadataJson = JSON.stringify(log.metadata ?? {}, null, 2);
  const tone = actionTone(log.action);
  const toneClasses = TONE_CLASSES[tone];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-details-title"
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-2xl animate-scale-in overflow-hidden rounded-2xl bg-white shadow-brand-high">
        <div className="flex items-start justify-between border-b border-outline px-6 py-4">
          <div className="flex items-start gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClasses.bg} ${toneClasses.text}`}>
              <History className="h-4 w-4" />
            </span>
            <div>
              <h3 id="audit-details-title" className="text-base font-semibold text-ink-900">
                {getAdminActionLabel(log.action)}
              </h3>
              <p className="mt-0.5 text-xs text-ink-500">
                {new Date(log.created_at).toLocaleString('zh-TW')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-500 transition-colors hover:bg-surface-alt hover:text-ink-900"
            aria-label="關閉"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5 text-sm">
          <p className="rounded-xl bg-surface-alt p-4 text-sm text-ink-900">{log.summary}</p>

          <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailField icon={Mail}    label="操作管理員" value={`${log.admin.name}（${log.admin.email}）`} />
            <DetailField icon={Tag}     label="目標類型"    value={getAdminTargetTypeLabel(log.target_type) ?? '—'} />
            <DetailField icon={Tag}     label="目標 ID"     value={log.target_id ? <code className="font-mono text-xs">{log.target_id}</code> : '—'} />
            <DetailField icon={History} label="動作鍵值"    value={<code className="font-mono text-xs">{log.action}</code>} />
            <DetailField icon={MapPin}  label="IP 位址"     value={log.ip_address ?? '—'} />
            <DetailField icon={Monitor} label="User Agent"  value={
              log.user_agent
                ? <span className="break-all text-xs text-ink-700">{log.user_agent}</span>
                : '—'
            } />
          </dl>

          <div className="mt-5">
            <p className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ink-500">
              <Eye className="h-3 w-3" /> 完整 metadata
            </p>
            <pre className="overflow-x-auto rounded-xl border border-outline bg-surface-alt p-4 text-xs text-ink-700">
              {metadataJson}
            </pre>
          </div>

          {Object.keys(log.metadata ?? {}).length === 0 && (
            <p className="mt-2 flex items-center gap-1 text-xs text-ink-300">
              <Calendar className="h-3 w-3" />
              此紀錄沒有 metadata
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-outline bg-surface-subtle px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-outline bg-white px-4 py-1.5 text-sm font-medium text-ink-700 hover:bg-surface-alt"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="inline-flex items-center gap-1 text-xs font-medium text-ink-500">
        <Icon className="h-3 w-3" />
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-ink-900">{value}</dd>
    </div>
  );
}
