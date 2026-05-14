/**
 * Admin monthly reports page.
 *
 * Previously this lived at the bottom of the dashboard. It got moved here
 * (2026-05) because:
 *   1. It's analytical content, not "what needs my attention now" — wrong
 *      content for a dashboard hero.
 *   2. The 9-card report was eating ~30% of dashboard vertical space.
 *   3. Admins rarely need it daily, so it doesn't need to be on-route every
 *      time they log in.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  FileText,
  HeartPulse,
  Sparkles,
  Stethoscope,
  UserCheck,
  Users,
} from 'lucide-react';
import { ErrorBanner, LoadingState, PageHeader } from '@/components/admin';

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

export default function AdminReportsPage() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [reportMonth, setReportMonth] = useState(currentMonth);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReport = useCallback(async (month: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/admin/reports?month=${month}`);
      const json = (await res.json()) as { success: boolean; data: MonthlyReport; error?: { message: string } };
      if (json.success) {
        setReport(json.data);
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
    void fetchReport(reportMonth);
  }, [reportMonth, fetchReport]);

  return (
    <div>
      <PageHeader
        title="月報表"
        description="平台各項指標的月度彙整"
        actions={
          <input
            type="month"
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
            className="rounded-lg border border-outline bg-white px-3 py-1.5 text-sm shadow-brand-low focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            max={currentMonth}
          />
        }
      />

      {error && <ErrorBanner message={error} onRetry={() => void fetchReport(reportMonth)} />}

      {loading ? (
        <LoadingState label="載入月報表..." />
      ) : report ? (
        <div className="space-y-6">
          {/* Headline metrics — bigger / more prominent */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportCard label="新增委託人"   value={report.new_caregivers}   Icon={Users} />
            <ReportCard label="新增被照護者" value={report.new_recipients}   Icon={HeartPulse} accent />
            <ReportCard label="量測總數"     value={report.total_measurements} Icon={Activity} />
            <ReportCard label="異常量測"     value={report.abnormal_measurements} Icon={AlertTriangle} danger />
          </div>

          {/* Service-related metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportCard label="建立需求單"   value={report.service_requests.created}   Icon={ClipboardList} />
            <ReportCard label="完成服務"     value={report.service_requests.completed} Icon={UserCheck} accent />
            <ReportCard label="取消需求"     value={report.service_requests.cancelled} Icon={ClipboardList} />
            <ReportCard label="AI 報告生成"  value={report.ai_reports_generated}       Icon={Sparkles} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReportCard label="活躍服務人員" value={report.active_providers} Icon={Stethoscope} />
            <div /> {/* placeholder for symmetry */}
          </div>

          {/* Category breakdown */}
          {Object.keys(report.service_requests.by_category).length > 0 && (
            <div className="rounded-2xl border border-outline bg-white p-6 shadow-brand-low">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50">
                  <FileText className="h-4 w-4 text-brand-600" aria-hidden="true" />
                </span>
                <h2 className="text-base font-semibold text-ink-900">需求單分類統計</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(report.service_requests.by_category).map(([name, count]) => (
                  <div key={name} className="rounded-xl bg-surface-alt px-4 py-3 text-center">
                    <p className="text-xs text-ink-500">{name}</p>
                    <p className="mt-1 text-xl font-bold text-ink-900">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ReportCard({
  label,
  value,
  Icon,
  accent,
  danger,
}: {
  label: string;
  value: number;
  Icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
  danger?: boolean;
}) {
  const valueClass = danger
    ? 'text-danger'
    : accent
      ? 'text-accent-600'
      : 'text-ink-900';
  const iconWrapClass = danger
    ? 'bg-danger-soft text-danger'
    : accent
      ? 'bg-accent-50 text-accent-600'
      : 'bg-brand-50 text-brand-600';
  return (
    <div className="rounded-2xl border border-outline bg-white p-5 shadow-brand-low">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconWrapClass}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
      <p className={`mt-2 text-3xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
