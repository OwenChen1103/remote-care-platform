/**
 * Admin monthly reports page (redesigned).
 *
 * The page is a one-screen executive view of "what happened on the platform
 * this month". Every number is shown alongside its month-over-month delta
 * (computed client-side by calling the same endpoint twice — current + prior
 * month — in parallel; no backend change), and the chart-friendly data
 * (completion/cancel rates, category split, abnormal share of measurements)
 * is rendered with small pure-SVG charts instead of flat number tiles.
 *
 * Sections, top to bottom:
 *   1. Hero KPI strip — 4 headline numbers (建立 / 完成 / 異常 / AI 報告)
 *   2. 服務需求成效 — donut for completion rate + bar for cancel rate
 *   3. 服務類別分布 — horizontal-bar breakdown sorted by demand
 *   4. 平台成長 — new caregivers / new recipients / active providers
 *   5. 量測活動 — total volume + abnormal-share stacked bar
 *
 * Active providers is a SNAPSHOT (not month-bounded in the API), so its card
 * deliberately omits the MoM delta — comparing it to itself would be misleading.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  ClipboardX,
  HeartPulse,
  Minus,
  PieChart as PieChartIcon,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { ErrorBanner, LoadingState, PageHeader, SectionCard } from '@/components/admin';

interface MonthlyReport {
  month: string;
  new_caregivers: number;
  new_recipients: number;
  total_measurements: number;
  abnormal_measurements: number;
  service_requests: {
    created: number;
    completed: number;
    cancelled: number;
    by_category: Record<string, number>;
  };
  ai_reports_generated: number;
  active_providers: number;
}

function shiftMonth(month: string, deltaMonths: number): string {
  const [yStr, mStr] = month.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

function isMonthInFuture(month: string, current: string): boolean {
  return month > current;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y} 年 ${Number(m)} 月`;
}

export default function AdminReportsPage() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [reportMonth, setReportMonth] = useState(currentMonth);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [previous, setPrevious] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReport = useCallback(async (month: string) => {
    setLoading(true);
    setError('');
    try {
      const prevMonth = shiftMonth(month, -1);
      // Call current + previous in parallel for MoM deltas. Previous may
      // legitimately fail (pre-launch month, or future month) — we treat
      // that as "no baseline" rather than surfacing the error.
      const [currentJson, prevJson] = await Promise.all([
        fetch(`/api/v1/admin/reports?month=${month}`).then((r) => r.json()),
        fetch(`/api/v1/admin/reports?month=${prevMonth}`).then((r) => r.json()),
      ]);
      const currentTyped = currentJson as { success: boolean; data?: MonthlyReport; error?: { message: string } };
      const prevTyped = prevJson as { success: boolean; data?: MonthlyReport };
      if (!currentTyped.success || !currentTyped.data) {
        setError(currentTyped.error?.message ?? '載入失敗');
        return;
      }
      setReport(currentTyped.data);
      setPrevious(prevTyped.success && prevTyped.data ? prevTyped.data : null);
    } catch {
      setError('網路錯誤');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport(reportMonth);
  }, [reportMonth, fetchReport]);

  const created = report?.service_requests.created ?? 0;
  const completed = report?.service_requests.completed ?? 0;
  const cancelled = report?.service_requests.cancelled ?? 0;
  const completionRate = created > 0 ? Math.round((completed / created) * 100) : 0;
  const cancelRate = created > 0 ? Math.round((cancelled / created) * 100) : 0;
  const prevCreated = previous?.service_requests.created ?? 0;
  const prevCompletionRate = prevCreated > 0
    ? Math.round(((previous?.service_requests.completed ?? 0) / prevCreated) * 100)
    : 0;
  const prevCancelRate = prevCreated > 0
    ? Math.round(((previous?.service_requests.cancelled ?? 0) / prevCreated) * 100)
    : 0;
  const total = report?.total_measurements ?? 0;
  const abnormal = report?.abnormal_measurements ?? 0;
  const abnormalRate = total > 0 ? Math.round((abnormal / total) * 100) : 0;

  const prevMonthStr = shiftMonth(reportMonth, -1);
  const nextMonthStr = shiftMonth(reportMonth, 1);
  const nextDisabled = isMonthInFuture(nextMonthStr, currentMonth);

  return (
    <div>
      <PageHeader
        title="月報表"
        description={`${formatMonthLabel(reportMonth)} · 平台各項指標的月度彙整`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReportMonth(prevMonthStr)}
              className="rounded-lg border border-outline bg-white p-1.5 text-ink-700 shadow-brand-low transition-colors hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-brand-100"
              aria-label="前一個月"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              type="month"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="rounded-lg border border-outline bg-white px-3 py-1.5 text-sm shadow-brand-low focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              max={currentMonth}
            />
            <button
              type="button"
              onClick={() => !nextDisabled && setReportMonth(nextMonthStr)}
              disabled={nextDisabled}
              className="rounded-lg border border-outline bg-white p-1.5 text-ink-700 shadow-brand-low transition-colors hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="後一個月"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} onRetry={() => void fetchReport(reportMonth)} />}

      {loading ? (
        <LoadingState label="載入月報表..." />
      ) : report ? (
        <div className="space-y-6">
          {/* ── Hero KPI strip — at-a-glance headline numbers ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="建立需求"
              value={created}
              previous={previous?.service_requests.created}
              Icon={ClipboardList}
              tone="brand"
            />
            <KpiCard
              label="完成服務"
              value={completed}
              previous={previous?.service_requests.completed}
              Icon={ClipboardCheck}
              tone="positive"
            />
            <KpiCard
              label="異常量測"
              value={abnormal}
              previous={previous?.abnormal_measurements}
              Icon={AlertTriangle}
              tone="danger"
              invertDelta
            />
            <KpiCard
              label="AI 報告生成"
              value={report.ai_reports_generated}
              previous={previous?.ai_reports_generated}
              Icon={Sparkles}
              tone="brand"
            />
          </div>

          {/* ── 服務需求成效 ── */}
          <SectionCard icon={PieChartIcon} title="服務需求成效">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <RateBlock
                label="完成率"
                rate={completionRate}
                previousRate={prevCompletionRate}
                numerator={completed}
                denominator={created}
                tone="positive"
                emptyHint={created === 0 ? '本月尚未有需求' : undefined}
              />
              <RateBlock
                label="取消率"
                rate={cancelRate}
                previousRate={prevCancelRate}
                numerator={cancelled}
                denominator={created}
                tone="danger"
                emptyHint={created === 0 ? '本月尚未有需求' : undefined}
                invertDelta
              />
            </div>
          </SectionCard>

          {/* ── 服務類別分布 ── */}
          <SectionCard icon={ClipboardList} title="服務類別分布">
            <CategoryBars data={report.service_requests.by_category} />
          </SectionCard>

          {/* ── 平台成長 ── */}
          <SectionCard icon={Users} title="平台成長">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard
                label="新增委託人"
                value={report.new_caregivers}
                previous={previous?.new_caregivers}
                Icon={Users}
                tone="brand"
                compact
              />
              <KpiCard
                label="新增被照護者"
                value={report.new_recipients}
                previous={previous?.new_recipients}
                Icon={HeartPulse}
                tone="positive"
                compact
              />
              <KpiCard
                label="活躍服務人員"
                value={report.active_providers}
                Icon={Stethoscope}
                tone="brand"
                compact
                hint="目前狀態"
              />
            </div>
          </SectionCard>

          {/* ── 量測活動 ── */}
          <SectionCard icon={Activity} title="量測活動">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <KpiCard
                label="量測總數"
                value={total}
                previous={previous?.total_measurements}
                Icon={Activity}
                tone="brand"
                compact
              />
              <div className="rounded-xl border border-outline bg-surface-subtle p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-ink-500">異常比例</p>
                  <Bell className="h-3.5 w-3.5 text-ink-500" aria-hidden="true" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-ink-900">{abnormalRate}%</p>
                  <p className="text-xs text-ink-500">
                    {abnormal} / {total || 0} 筆
                  </p>
                </div>
                <SegmentBar abnormal={abnormal} total={total} />
              </div>
            </div>
          </SectionCard>

          {/* ── 取消需求 (kept as a small standalone card — useful but secondary) ── */}
          {cancelled > 0 && (
            <div className="rounded-2xl border border-outline bg-white p-4 shadow-brand-low">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-danger-soft text-danger">
                    <ClipboardX className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-medium text-ink-900">本月取消需求</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xl font-bold text-ink-900">{cancelled}</p>
                  <Delta
                    current={cancelled}
                    previous={previous?.service_requests.cancelled}
                    invert
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────

type Tone = 'brand' | 'positive' | 'danger' | 'warning';

const TONE_VALUE: Record<Tone, string> = {
  brand: 'text-ink-900',
  positive: 'text-accent-600',
  danger: 'text-danger',
  warning: 'text-warning',
};

const TONE_ICON: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  positive: 'bg-accent-50 text-accent-600',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
};

function KpiCard({
  label,
  value,
  previous,
  Icon,
  tone = 'brand',
  invertDelta = false,
  compact = false,
  hint,
}: {
  label: string;
  value: number;
  previous?: number;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  invertDelta?: boolean;
  compact?: boolean;
  hint?: string;
}) {
  return (
    <div className={`rounded-2xl border border-outline bg-white shadow-brand-low ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${TONE_ICON[tone]}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
      <p className={`mt-2 ${compact ? 'text-2xl' : 'text-3xl'} font-bold ${TONE_VALUE[tone]}`}>{value}</p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {previous !== undefined ? (
          <Delta current={value} previous={previous} invert={invertDelta} />
        ) : hint ? (
          <span className="text-ink-500">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

// ─── Delta indicator (↑/→/↓ vs 上月 N) ───────────────────────

function Delta({
  current,
  previous,
  invert = false,
}: {
  current: number;
  previous: number | undefined;
  /** When true, a DECREASE is colored positive (e.g. abnormal/cancelled — lower is better). */
  invert?: boolean;
}) {
  // Previous month missing entirely (pre-launch / API failed) — show neutral baseline.
  if (previous === undefined) {
    return <span className="text-ink-500">無上月資料</span>;
  }

  // Both zero — call it "持平".
  if (previous === 0 && current === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-ink-500">
        <Minus className="h-3 w-3" aria-hidden="true" />
        持平
      </span>
    );
  }

  // Previous was zero, current is non-zero — show "新增 N" rather than ∞%.
  if (previous === 0) {
    return (
      <span className={`inline-flex items-center gap-1 font-medium ${invert ? 'text-danger' : 'text-accent-600'}`}>
        <TrendingUp className="h-3 w-3" aria-hidden="true" />
        新增 (上月 0)
      </span>
    );
  }

  // Current zero, previous non-zero — show "下降 100%".
  if (current === 0) {
    return (
      <span className={`inline-flex items-center gap-1 font-medium ${invert ? 'text-accent-600' : 'text-danger'}`}>
        <TrendingDown className="h-3 w-3" aria-hidden="true" />
        −100% (上月 {previous})
      </span>
    );
  }

  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-ink-500">
        <Minus className="h-3 w-3" aria-hidden="true" />
        持平 (上月 {previous})
      </span>
    );
  }

  const isUp = pct > 0;
  // Up is GOOD for most metrics; for inverted ones (abnormal, cancelled) up is BAD.
  const isPositive = invert ? !isUp : isUp;
  const colorClass = isPositive ? 'text-accent-600' : 'text-danger';
  const ArrowIcon = isUp ? TrendingUp : TrendingDown;
  const sign = isUp ? '+' : '';

  return (
    <span className={`inline-flex items-center gap-1 font-medium ${colorClass}`}>
      <ArrowIcon className="h-3 w-3" aria-hidden="true" />
      {sign}{pct}% (上月 {previous})
    </span>
  );
}

// ─── Rate block (donut + metric + delta) ──────────────────────

function RateBlock({
  label,
  rate,
  previousRate,
  numerator,
  denominator,
  tone,
  emptyHint,
  invertDelta = false,
}: {
  label: string;
  rate: number;
  previousRate: number;
  numerator: number;
  denominator: number;
  tone: 'positive' | 'danger';
  emptyHint?: string;
  invertDelta?: boolean;
}) {
  const isEmpty = !!emptyHint;
  const donutColor = tone === 'positive' ? '#5DA945' : '#D9534F';

  return (
    <div className="flex items-center gap-5 rounded-xl border border-outline bg-surface-subtle p-4">
      <Donut percent={isEmpty ? 0 : rate} size={84} stroke={9} color={donutColor} />
      <div className="flex-1">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        {isEmpty ? (
          <>
            <p className="mt-1 text-2xl font-bold text-ink-300">--</p>
            <p className="mt-1 text-xs text-ink-500">{emptyHint}</p>
          </>
        ) : (
          <>
            <p className={`mt-1 text-3xl font-bold ${tone === 'positive' ? 'text-accent-600' : 'text-danger'}`}>
              {rate}%
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {numerator} / {denominator} 筆
            </p>
            <div className="mt-2 text-xs">
              <Delta current={rate} previous={previousRate} invert={invertDelta} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Donut chart (SVG, no library) ─────────────────────────────

function Donut({
  percent,
  size,
  stroke,
  color,
}: {
  percent: number;
  size: number;
  stroke: number;
  color: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const cx = size / 2;
  return (
    <svg width={size} height={size} className="block flex-shrink-0">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#E1E8EF" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dashoffset 400ms ease-out' }}
      />
    </svg>
  );
}

// ─── Category horizontal-bar list ─────────────────────────────

function CategoryBars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <p className="text-sm text-ink-500">本月尚無服務需求。</p>;
  }
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  // entries.length > 0 guard above narrows TS, but the index access still
  // needs an explicit non-null assertion under strict mode.
  const max = entries[0]![1]; // sorted desc

  // Cycle through brand-tinted colors so neighboring bars are distinguishable.
  const palette = ['#2E8DC9', '#1B6DA0', '#5DA945', '#3F7F2E', '#E8A23B'];

  return (
    <div className="space-y-3">
      {entries.map(([name, count], i) => {
        const widthPct = max > 0 ? (count / max) * 100 : 0;
        const sharePct = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
        return (
          <div key={name} className="flex items-center gap-3">
            <div className="w-24 truncate text-sm font-medium text-ink-900" title={name}>
              {name}
            </div>
            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-surface-alt">
              <div
                className="h-full rounded-md transition-[width] duration-500 ease-out"
                style={{ width: `${widthPct}%`, backgroundColor: palette[i % palette.length] }}
              />
            </div>
            <div className="flex w-24 items-baseline justify-end gap-1">
              <span className="text-sm font-bold text-ink-900">{count}</span>
              <span className="text-xs text-ink-500">({sharePct}%)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Segmented bar for abnormal-share visualization ────────────

function SegmentBar({ abnormal, total }: { abnormal: number; total: number }) {
  // Empty bar when no data — gray track with subtle hint.
  if (total === 0) {
    return (
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-alt">
        <div className="h-full w-0" />
      </div>
    );
  }
  const abnormalPct = (abnormal / total) * 100;
  return (
    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-alt">
      <div
        className="h-full bg-danger transition-[width] duration-500 ease-out"
        style={{ width: `${abnormalPct}%` }}
      />
      <div
        className="h-full bg-accent-400 transition-[width] duration-500 ease-out"
        style={{ width: `${100 - abnormalPct}%` }}
      />
    </div>
  );
}
