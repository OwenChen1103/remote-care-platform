'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ClipboardList,
  HeartPulse,
  RotateCw,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { ErrorBanner } from '@/components/admin';

interface DashboardStats {
  total_caregivers: number;
  total_recipients: number;
  total_measurements_today: number;
  pending_service_requests: number;
  pending_provider_reviews: number;
  abnormal_alerts_today: number;
}

interface PendingRequest {
  id: string;
  category_name: string;
  recipient_name: string;
  preferred_date: string;
  created_at: string;
}

interface AbnormalAlert {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

interface DashboardData {
  stats: DashboardStats;
  recent_pending_requests: PendingRequest[];
  recent_abnormal_alerts: AbnormalAlert[];
}

/** Slimmed-down platform totals — the duplicate "pending/abnormal" cards that
 *  also appear in 我的工作 were removed. The 3 remaining are slow-moving
 *  totals + today's measurement count. Each card is a Link into the relevant
 *  list page so the number is actionable, not decoration. */
const STAT_CARDS: {
  key: keyof DashboardStats;
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}[] = [
  { key: 'total_caregivers',         label: '委託人數',   href: '/admin/users?role=caregiver',  Icon: Users,      iconBg: 'bg-brand-50',  iconColor: 'text-brand-600' },
  { key: 'total_recipients',         label: '被照護者數', href: '/admin/recipients',            Icon: HeartPulse, iconBg: 'bg-accent-50', iconColor: 'text-accent-600' },
  { key: 'total_measurements_today', label: '今日量測數', href: '/admin/recipients',            Icon: Activity,   iconBg: 'bg-brand-50',  iconColor: 'text-brand-600' },
];

function formatClockTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(iso).toLocaleDateString('zh-TW');
}

/** A merged activity-stream item — either a pending request or an abnormal alert. */
type ActivityItem =
  | { kind: 'request'; id: string; createdAt: string; label: string; sublabel: string; href: string }
  | { kind: 'alert';   id: string; createdAt: string; label: string; sublabel: string };

function mergeActivity(
  requests: PendingRequest[],
  alerts: AbnormalAlert[],
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...requests.map<ActivityItem>((r) => ({
      kind: 'request',
      id: r.id,
      createdAt: r.created_at,
      label: `新需求「${r.category_name}」`,
      sublabel: r.recipient_name,
      href: `/admin/service-requests/${r.id}`,
    })),
    ...alerts.map<ActivityItem>((a) => ({
      kind: 'alert',
      id: a.id,
      createdAt: a.created_at,
      label: a.title,
      sublabel: a.body,
    })),
  ];
  return items.sort(
    (x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime(),
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/admin/dashboard');
      const json = (await res.json()) as { success: boolean; data: DashboardData; error?: { message: string } };
      if (json.success) {
        setData(json.data);
        setLastUpdated(new Date());
      } else {
        setError(json.error?.message ?? '載入失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={() => void fetchDashboard()} />;
  }

  if (!data) return null;

  // 「我的工作」cards — surface only items needing admin action.
  const workItems = [
    {
      key: 'submitted_requests',
      count: data.stats.pending_service_requests,
      label: '待處理需求單',
      action: '前往審核',
      href: '/admin/service-requests?status=submitted',
      Icon: ClipboardList,
      gradient: 'from-warning to-orange-400',
      iconBg: 'bg-white/20',
    },
    {
      key: 'pending_reviews',
      count: data.stats.pending_provider_reviews,
      label: '待審核服務人員',
      action: '前往審核',
      href: '/admin/providers?status=pending',
      Icon: UserCheck,
      gradient: 'from-brand-600 to-brand-400',
      iconBg: 'bg-white/20',
    },
    {
      key: 'abnormal_alerts',
      count: data.stats.abnormal_alerts_today,
      label: '今日異常通知',
      action: '滾動查看',
      href: '#recent-activity',
      Icon: AlertTriangle,
      gradient: 'from-danger to-rose-400',
      iconBg: 'bg-white/20',
    },
  ];
  const activeWorkItems = workItems.filter((w) => w.count > 0);
  const workTotal = activeWorkItems.reduce((sum, w) => sum + w.count, 0);
  const hasWork = workTotal > 0;

  // Empty-platform detection: brand new install with zero of everything →
  // friendly welcome instead of a wall of zeros that looks like a broken page.
  const isBrandNewPlatform =
    data.stats.total_caregivers === 0 &&
    data.stats.total_recipients === 0 &&
    data.stats.total_measurements_today === 0 &&
    data.stats.pending_service_requests === 0 &&
    data.stats.pending_provider_reviews === 0 &&
    data.recent_pending_requests.length === 0 &&
    data.recent_abnormal_alerts.length === 0;

  const todayLabel = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });

  // Merged recent-activity timeline, sorted desc.
  const activity = mergeActivity(data.recent_pending_requests, data.recent_abnormal_alerts);

  return (
    <div className="space-y-10">
      {/* Slim utility bar — date + last refresh + manual refresh button */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-500">
        <span>
          {todayLabel}
          {lastUpdated && (
            <span className="ml-3 text-ink-300">・ 最後更新 {formatClockTime(lastUpdated)}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => void fetchDashboard()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-outline bg-white px-3 py-1.5 text-xs font-medium text-ink-700 shadow-brand-low transition-colors hover:border-brand-200 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          刷新
        </button>
      </div>

      {/* Brand-new platform welcome — replaces the wall-of-zeros */}
      {isBrandNewPlatform ? (
        <BrandNewPlatformWelcome />
      ) : (
        <>
          {/* My Work */}
          <section>
            <SectionHeader
              icon={Sparkles}
              title="我的工作"
              meta={hasWork ? `${workTotal} 項待處理` : '無待辦事項'}
            />
            {hasWork ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {activeWorkItems.map((w) => (
                  <Link
                    key={w.key}
                    href={w.href}
                    className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${w.gradient} p-7 text-white shadow-brand-md transition-all duration-200 hover:shadow-brand-high hover:-translate-y-0.5`}
                  >
                    <div
                      className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl"
                      aria-hidden="true"
                    />
                    <div className="relative flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-white/90">{w.label}</p>
                        <p className="mt-3 text-5xl font-bold leading-none tracking-tight">{w.count}</p>
                      </div>
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${w.iconBg}`}>
                        <w.Icon className="h-7 w-7" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="relative mt-6 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white">
                      <span>{w.action}</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-strong bg-white px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-50">
                  <Sparkles className="h-7 w-7 text-accent-600" aria-hidden="true" />
                </div>
                <p className="mt-4 text-base font-medium text-ink-900">目前沒有待辦事項</p>
                <p className="mt-1 text-sm text-ink-500">所有需求單與審核都已處理完畢</p>
              </div>
            )}
          </section>

          {/* Platform totals — 3 cards, each links to its list page */}
          <section>
            <SectionHeader icon={TrendingUp} title="平台總覽" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STAT_CARDS.map((card) => {
                const Icon = card.Icon;
                return (
                  <Link
                    key={card.key}
                    href={card.href}
                    className="group flex items-center gap-4 rounded-2xl border border-outline bg-white p-5 shadow-brand-low transition-all duration-150 hover:border-brand-200 hover:shadow-brand-md"
                  >
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                      <Icon className={`h-6 w-6 ${card.iconColor}`} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-ink-500">{card.label}</p>
                      <p className="mt-1 text-2xl font-bold text-ink-900">{data.stats[card.key]}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-500" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Merged recent activity — single chronological feed */}
          <section id="recent-activity">
            <SectionHeader icon={Activity} title="最近活動" meta={activity.length > 0 ? `${activity.length} 筆` : undefined} />
            {activity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-outline-strong bg-white px-6 py-10 text-center text-sm text-ink-500">
                目前沒有最近活動
              </div>
            ) : (
              <div className="rounded-2xl border border-outline bg-white p-4 shadow-brand-low sm:p-6">
                <ul className="relative space-y-1 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-outline">
                  {activity.map((item) => {
                    const isRequest = item.kind === 'request';
                    const Icon = isRequest ? ClipboardList : AlertTriangle;
                    const dotBg = isRequest ? 'bg-warning' : 'bg-danger';
                    const ringBg = isRequest ? 'ring-warning-soft' : 'ring-danger-soft';
                    const labelBg = isRequest ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-danger';
                    const content = (
                      <div className="group relative flex items-start gap-4 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-alt">
                        <span className="relative z-10 mt-1 flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full ring-4 ring-white" aria-hidden="true">
                          <span className={`h-[14px] w-[14px] rounded-full ring-4 ${dotBg} ${ringBg}`} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${labelBg}`}>
                              <Icon className="h-3 w-3" />
                              {isRequest ? '新需求' : '異常通知'}
                            </span>
                            <span className="text-xs text-ink-500">{formatTimeAgo(item.createdAt)}</span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-ink-900">{item.label}</p>
                          <p className="mt-0.5 text-xs text-ink-500">{item.sublabel}</p>
                        </div>
                        {isRequest && (
                          <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-500" />
                        )}
                      </div>
                    );
                    return (
                      <li key={`${item.kind}-${item.id}`} className="relative">
                        {isRequest ? (
                          <Link href={item.href}>{content}</Link>
                        ) : (
                          // Abnormal alerts have no detail page today — render as
                          // a non-link so it doesn't dangle as a broken affordance.
                          <div>{content}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {/* Monthly report teaser — full report lives on /admin/reports */}
          <section>
            <Link
              href="/admin/reports"
              className="group flex items-center justify-between rounded-2xl border border-outline bg-white p-5 shadow-brand-low transition-all duration-150 hover:border-brand-200 hover:shadow-brand-md"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                  <BarChart3 className="h-6 w-6 text-brand-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-ink-900">月報表</p>
                  <p className="text-xs text-ink-500">查看本月與歷史的詳細指標統計</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:text-brand-700">
                查看月報表
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </section>
        </>
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  meta,
  margin = true,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  meta?: string;
  margin?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between ${margin ? 'mb-4' : ''}`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-700">
        <Icon className="h-4 w-4 text-brand-500" aria-hidden="true" />
        <span className="uppercase tracking-wider">{title}</span>
      </h2>
      {meta && <span className="text-xs font-medium text-ink-500">{meta}</span>}
    </div>
  );
}

function BrandNewPlatformWelcome() {
  return (
    <section className="overflow-hidden rounded-2xl border border-outline bg-hero-gradient p-10 shadow-brand-low">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-brand-md">
          <Sparkles className="h-8 w-8 text-brand-500" />
        </div>
        <h2 className="mt-5 text-2xl font-bold text-ink-900">歡迎使用 WhoCares 管理後台</h2>
        <p className="mt-2 text-sm text-ink-700">
          目前平台還很新，等委託人、被照護者與服務人員開始使用後，這裡會出現實際的工作項目與活動紀錄。
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/admin/users"
            className="rounded-xl border border-outline bg-white px-4 py-3 text-left text-sm transition-all hover:border-brand-200 hover:shadow-brand-low"
          >
            <p className="font-medium text-ink-900">查看使用者</p>
            <p className="mt-0.5 text-xs text-ink-500">目前已註冊的所有帳號</p>
          </Link>
          <Link
            href="/admin/services"
            className="rounded-xl border border-outline bg-white px-4 py-3 text-left text-sm transition-all hover:border-brand-200 hover:shadow-brand-low"
          >
            <p className="font-medium text-ink-900">設定服務類別</p>
            <p className="mt-0.5 text-xs text-ink-500">啟用/停用平台提供的服務</p>
          </Link>
        </div>
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      <div className="h-7 animate-pulse rounded bg-surface-alt" />
      <div>
        <div className="mb-4 h-5 w-32 animate-pulse rounded bg-surface-alt" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-alt" />
          ))}
        </div>
      </div>
      <div>
        <div className="mb-4 h-5 w-32 animate-pulse rounded bg-surface-alt" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-alt" />
          ))}
        </div>
      </div>
    </div>
  );
}
