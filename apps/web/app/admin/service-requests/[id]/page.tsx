'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  StickyNote,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  ADMIN_STATUS_TRANSITIONS,
  flattenCertifications,
  formatMetadataEntries,
  PROVIDER_LEVEL_DISPLAY,
  SERVICE_REQUEST_STATUS_DISPLAY,
  TIME_SLOT_DISPLAY,
} from '@remote-care/shared';
import type { ServiceRequestStatus } from '@remote-care/shared';
import {
  ConfirmModal,
  ErrorBanner,
  Field,
  LoadingState,
  SectionCard,
  ServiceRequestStatusBadge,
  useToast,
} from '@/components/admin';

interface ServiceRequestDetail {
  id: string;
  caregiver_id: string;
  status: string;
  preferred_date: string;
  preferred_time_slot: string | null;
  location: string;
  description: string;
  admin_note: string | null;
  provider_note: string | null;
  caregiver_confirmed_at: string | null;
  provider_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
  assigned_provider: ProviderOptionFull | null;
  candidate_provider: ProviderOptionFull | null;
  provider_report: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

interface ProviderOptionFull {
  id: string;
  name: string;
  phone: string | null;
  photo_url: string | null;
  level: string;
  specialties: string[];
  certifications: string[];
  experience_years: number | null;
  service_areas: string[];
}

interface ProviderOption {
  id: string;
  name: string;
  level: string;
  phone: string | null;
  photo_url: string | null;
  specialties: string[];
  certifications: string[];
  experience_years: number | null;
  service_areas: string[];
  available_services: string[];
  availability_status: string;
}

// Section 2.8 — admin transition button labels per (current, target) pair.
function statusActionLabel(current: string, target: string): string {
  if (target === 'cancelled') return '取消需求';
  if (current === 'submitted' && target === 'screening') return '開始審核';
  if (current === 'screening' && target === 'submitted') return '退回送出';
  if (target === 'screening') return '退回審核';
  if (target === 'arranged') return '標記為已安排';
  if (target === 'submitted') return '退回送出';
  return SERVICE_REQUEST_STATUS_DISPLAY[target as ServiceRequestStatus]?.label ?? target;
}

function statusActionClassName(target: string): string {
  if (target === 'cancelled') return 'bg-danger text-white hover:bg-rose-600';
  if (target === 'arranged')  return 'bg-brand-600 text-white hover:bg-brand-700';
  if (target === 'screening') return 'bg-warning text-white hover:bg-orange-500';
  if (target === 'submitted') return 'bg-brand-500 text-white hover:bg-brand-600';
  return 'bg-ink-500 text-white hover:bg-ink-700';
}

type EligibilityResult = { eligible: boolean; reasons: string[] };

function isProviderEligible(p: ProviderOption, req: ServiceRequestDetail): EligibilityResult {
  const reasons: string[] = [];
  if (p.availability_status !== 'available') reasons.push('not_available');

  const services = p.available_services ?? [];
  if (services.length > 0 && !services.includes(req.category.code)) {
    reasons.push('category_mismatch');
  }

  const areas = p.service_areas ?? [];
  const target = req.location ?? '';
  if (areas.length > 0 && !areas.some((a) => target.includes(a))) {
    reasons.push('area_mismatch');
  }

  return { eligible: reasons.length === 0, reasons };
}

function eligibilityReasonLabel(reason: string): string {
  switch (reason) {
    case 'not_available':     return '目前不可接案';
    case 'category_mismatch': return '不在該服務類別範圍';
    case 'area_mismatch':     return '不在服務區域';
    default: return reason;
  }
}

// ─── Status stepper config ────────────────────────────────────
// Linear flow: submitted → screening → candidate_proposed → caregiver_confirmed
// → provider_confirmed → arranged → in_service → completed
// (cancelled is a side branch, not part of the linear flow shown here)
const FLOW_STEPS: { status: ServiceRequestStatus; short: string }[] = [
  { status: 'submitted',           short: '已送出' },
  { status: 'screening',           short: '審核中' },
  { status: 'candidate_proposed',  short: '已推薦' },
  { status: 'caregiver_confirmed', short: '家屬確認' },
  { status: 'provider_confirmed',  short: '服務者確認' },
  { status: 'arranged',            short: '已安排' },
  { status: 'in_service',          short: '服務中' },
  { status: 'completed',           short: '已完成' },
];

export default function AdminServiceRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const [request, setRequest] = useState<ServiceRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [proposing, setProposing] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<ServiceRequestStatus | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/service-requests/${id}`);
      const json = (await res.json()) as { success: boolean; data: ServiceRequestDetail };
      if (json.success) {
        setRequest(json.data);
        setAdminNote(json.data.admin_note ?? '');
      } else {
        setError('載入失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/providers?review_status=approved&limit=50');
      const json = (await res.json()) as { success: boolean; data: ProviderOption[] };
      if (json.success) setProviders(json.data ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void fetchDetail(); }, [fetchDetail]);

  useEffect(() => {
    if (request?.status === 'screening') void fetchProviders();
  }, [request?.status, fetchProviders]);

  const updateStatus = async (newStatus: ServiceRequestStatus) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/v1/service-requests/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, admin_note: adminNote || undefined }),
      });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      if (json.success) {
        showToast({
          tone: 'success',
          message: `已將狀態改為「${SERVICE_REQUEST_STATUS_DISPLAY[newStatus]?.label ?? newStatus}」`,
        });
        await fetchDetail();
      } else {
        showToast({ tone: 'error', message: json.error?.message ?? '更新失敗' });
      }
    } catch {
      showToast({ tone: 'error', message: '網路錯誤' });
    } finally {
      setUpdating(false);
      setPendingTransition(null);
    }
  };

  const cancelRequest = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/v1/service-requests/${id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: adminNote || undefined }),
      });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      if (json.success) {
        showToast({ tone: 'success', message: '需求已取消' });
        await fetchDetail();
      } else {
        showToast({ tone: 'error', message: json.error?.message ?? '取消失敗' });
      }
    } catch {
      showToast({ tone: 'error', message: '網路錯誤' });
    } finally {
      setUpdating(false);
      setPendingTransition(null);
    }
  };

  const proposeCandidate = async () => {
    if (!selectedProviderId) return;
    setProposing(true);
    try {
      const res = await fetch(`/api/v1/service-requests/${id}/propose-candidate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: selectedProviderId,
          admin_note: adminNote || undefined,
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      if (json.success) {
        showToast({ tone: 'success', message: '已推薦候選服務人員' });
        await fetchDetail();
        setSelectedProviderId('');
      } else {
        showToast({ tone: 'error', message: json.error?.message ?? '提出候選失敗' });
      }
    } catch {
      showToast({ tone: 'error', message: '網路錯誤' });
    } finally {
      setProposing(false);
    }
  };

  const { eligibleProviders, otherProviders } = useMemo(() => {
    if (!request) return { eligibleProviders: [], otherProviders: [] };
    const eligible: { p: ProviderOption; result: EligibilityResult }[] = [];
    const other: { p: ProviderOption; result: EligibilityResult }[] = [];
    for (const p of providers) {
      const result = isProviderEligible(p, request);
      (result.eligible ? eligible : other).push({ p, result });
    }
    return { eligibleProviders: eligible, otherProviders: other };
  }, [providers, request]);

  const selectedProviderEligibility = useMemo(() => {
    if (!selectedProviderId || !request) return null;
    const p = providers.find((x) => x.id === selectedProviderId);
    if (!p) return null;
    return { provider: p, result: isProviderEligible(p, request) };
  }, [selectedProviderId, providers, request]);

  if (loading) return <LoadingState />;
  if (error && !request) {
    return (
      <div>
        <ErrorBanner message={error} onRetry={() => void fetchDetail()} />
        <button onClick={() => router.back()} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
          <ArrowLeft className="h-4 w-4" />返回列表
        </button>
      </div>
    );
  }
  if (!request) return null;

  const allowedTransitions = ADMIN_STATUS_TRANSITIONS[request.status as ServiceRequestStatus] ?? [];
  const canPropose = request.status === 'screening';
  const isCancelled = request.status === 'cancelled';

  return (
    <div>
      <Link href="/admin/service-requests" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition-colors hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </Link>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-outline bg-hero-gradient p-6 shadow-brand-low sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-brand-600">需求單詳情</p>
            <h1 className="mt-1 text-3xl font-bold text-ink-900">{request.category.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-700">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-ink-500" />
                {request.recipient.name}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-ink-500" />
                {new Date(request.preferred_date).toLocaleDateString('zh-TW')}
                {request.preferred_time_slot && ` ${TIME_SLOT_DISPLAY[request.preferred_time_slot]?.label ?? request.preferred_time_slot}`}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-ink-500" />
                建立 {new Date(request.created_at).toLocaleDateString('zh-TW')}
              </span>
            </p>
          </div>
          <ServiceRequestStatusBadge status={request.status} size="md" />
        </div>

        {/* Status stepper — linear visual of the lifecycle */}
        {!isCancelled && (
          <StatusStepper currentStatus={request.status as ServiceRequestStatus} />
        )}
        {isCancelled && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            <AlertTriangle className="h-4 w-4" />
            此需求單已被取消
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          <SectionCard icon={ClipboardList} title="基本資訊">
            <dl className="space-y-4 text-sm">
              <Field icon={MapPin}      label="服務地點"  value={request.location} />
              <Field icon={StickyNote}  label="需求描述"  value={request.description} multiline />
            </dl>
          </SectionCard>

          {(() => {
            const entries = formatMetadataEntries(request.metadata);
            if (entries.length === 0) return null;
            return (
              <SectionCard icon={StickyNote} title="詳細資訊">
                <dl className="space-y-4 text-sm">
                  {entries.map((e) => (
                    <Field key={e.key} icon={Check} label={e.label} value={e.value} />
                  ))}
                </dl>
              </SectionCard>
            );
          })()}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {request.assigned_provider && (
            <SectionCard icon={CheckCircle2} title="指派服務者" tone="positive">
              <ProviderDetailCard provider={request.assigned_provider} />
            </SectionCard>
          )}

          {request.candidate_provider && (
            <SectionCard icon={UserPlus} title="候選服務人員" tone="brand">
              <ProviderDetailCard provider={request.candidate_provider} />
              <div className="mt-5 grid gap-2 rounded-xl bg-surface-alt p-3">
                <ConfirmationRow label="委託人確認"   confirmedAt={request.caregiver_confirmed_at} />
                <ConfirmationRow label="服務人員確認" confirmedAt={request.provider_confirmed_at} />
              </div>
            </SectionCard>
          )}

          {canPropose && (
            <SectionCard icon={UserPlus} title="提出候選服務人員">
              <select
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                className="mb-4 block w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm shadow-brand-low focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value="">— 選擇服務人員 —</option>
                {eligibleProviders.length > 0 && (
                  <optgroup label={`建議候選（${eligibleProviders.length}）`}>
                    {eligibleProviders.map(({ p }) => (
                      <option key={p.id} value={p.id}>
                        {formatProviderOptionLabel(p)}
                      </option>
                    ))}
                  </optgroup>
                )}
                {otherProviders.length > 0 && (
                  <optgroup label={`其他可選（${otherProviders.length}）`}>
                    {otherProviders.map(({ p, result }) => (
                      <option key={p.id} value={p.id}>
                        {formatProviderOptionLabel(p)} ｜ {result.reasons.map(eligibilityReasonLabel).join('、')}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {selectedProviderEligibility && (
                <div
                  className={`mb-4 rounded-xl border p-4 text-sm ${
                    selectedProviderEligibility.result.eligible
                      ? 'border-brand-100 bg-brand-50'
                      : 'border-warning/30 bg-warning-soft'
                  }`}
                >
                  <p className="font-medium text-ink-900">
                    {selectedProviderEligibility.provider.name}
                    <span className="ml-1.5 text-xs text-ink-500">
                      {PROVIDER_LEVEL_DISPLAY[selectedProviderEligibility.provider.level]?.label ?? selectedProviderEligibility.provider.level}
                    </span>
                  </p>
                  {(selectedProviderEligibility.provider.specialties ?? []).length > 0 && (
                    <p className="mt-1 text-xs text-ink-700">
                      專業：{selectedProviderEligibility.provider.specialties.join('、')}
                    </p>
                  )}
                  {flattenCertifications(selectedProviderEligibility.provider.certifications).length > 0 && (
                    <p className="text-xs text-ink-700">
                      證照：{flattenCertifications(selectedProviderEligibility.provider.certifications).join('、')}
                    </p>
                  )}
                  {!selectedProviderEligibility.result.eligible && (
                    <div className="mt-3 rounded-lg bg-white/60 p-2 text-xs text-warning">
                      <p className="font-medium">注意：此服務人員不完全符合需求</p>
                      <ul className="mt-1 list-disc pl-5">
                        {selectedProviderEligibility.result.reasons.map((r) => (
                          <li key={r}>{eligibilityReasonLabel(r)}</li>
                        ))}
                      </ul>
                      <p className="mt-1">您仍可選擇此候選人，但建議再次確認。</p>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={!selectedProviderId || proposing}
                onClick={() => void proposeCandidate()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-brand-md transition-all duration-150 hover:bg-brand-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                {proposing ? '提出中...' : '提出候選'}
              </button>
            </SectionCard>
          )}

          <SectionCard icon={StickyNote} title="狀態操作">
            <label className="mb-1.5 block text-xs font-medium text-ink-500">
              管理員備註（選填）
            </label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
              placeholder="選填備註…"
              className="block w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm shadow-brand-low placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {allowedTransitions.length === 0 ? (
                <p className="text-sm text-ink-500">此狀態無可用操作</p>
              ) : (
                allowedTransitions.map((next) => (
                  <button
                    key={next}
                    type="button"
                    disabled={updating}
                    onClick={() => setPendingTransition(next)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-brand-low transition-all duration-150 active:scale-[0.98] disabled:opacity-50 ${
                      statusActionClassName(next)
                    }`}
                  >
                    {statusActionLabel(request.status, next)}
                  </button>
                ))
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      <ConfirmModal
        open={pendingTransition !== null}
        title={
          pendingTransition === 'cancelled'
            ? `取消「${request.category.name}」需求`
            : pendingTransition
              ? `將狀態改為「${SERVICE_REQUEST_STATUS_DISPLAY[pendingTransition]?.label ?? pendingTransition}」`
              : ''
        }
        description={
          pendingTransition === 'cancelled'
            ? `將通知委託人${request.candidate_provider || request.assigned_provider ? '與服務人員' : ''}此需求已取消。${adminNote.trim() ? `\n\n取消原因：${adminNote.trim()}` : ''}`
            : pendingTransition
              ? `從「${SERVICE_REQUEST_STATUS_DISPLAY[request.status as ServiceRequestStatus]?.label ?? request.status}」轉至「${SERVICE_REQUEST_STATUS_DISPLAY[pendingTransition]?.label ?? pendingTransition}」。${adminNote.trim() ? `\n\n備註：${adminNote.trim()}` : ''}`
              : undefined
        }
        confirmLabel={pendingTransition ? statusActionLabel(request.status, pendingTransition) : ''}
        tone={pendingTransition === 'cancelled' ? 'danger' : 'primary'}
        submitting={updating}
        onClose={() => setPendingTransition(null)}
        onConfirm={async () => {
          if (!pendingTransition) return;
          if (pendingTransition === 'cancelled') {
            await cancelRequest();
          } else {
            await updateStatus(pendingTransition);
          }
        }}
      />
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────

function StatusStepper({ currentStatus }: { currentStatus: ServiceRequestStatus }) {
  const currentIdx = FLOW_STEPS.findIndex((s) => s.status === currentStatus);
  const reachedIdx = currentIdx < 0 ? -1 : currentIdx;

  return (
    <div className="mt-6 overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1">
        {FLOW_STEPS.map((step, idx) => {
          const isPast = idx < reachedIdx;
          const isCurrent = idx === reachedIdx;
          const isFuture = idx > reachedIdx;
          return (
            <li key={step.status} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    isPast
                      ? 'bg-positive text-white'
                      : isCurrent
                        ? 'bg-brand-500 text-white shadow-brand-md ring-4 ring-brand-100'
                        : 'bg-white text-ink-300 ring-1 ring-outline'
                  }`}
                >
                  {isPast ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <span
                  className={`mt-1.5 text-[10px] font-medium ${
                    isCurrent ? 'text-brand-700' : isFuture ? 'text-ink-300' : 'text-ink-700'
                  }`}
                >
                  {step.short}
                </span>
              </div>
              {idx < FLOW_STEPS.length - 1 && (
                <div
                  className={`mx-1 h-px w-8 sm:w-12 ${
                    idx < reachedIdx ? 'bg-positive' : 'bg-outline'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ConfirmationRow({ label, confirmedAt }: { label: string; confirmedAt: string | null }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          confirmedAt ? 'bg-positive text-white' : 'bg-outline text-ink-300'
        }`}
      >
        {confirmedAt && <Check className="h-3 w-3" />}
      </span>
      <span className={confirmedAt ? 'text-ink-900' : 'text-ink-500'}>{label}</span>
      {confirmedAt && (
        <span className="ml-auto text-xs text-ink-500">
          {new Date(confirmedAt).toLocaleString('zh-TW')}
        </span>
      )}
    </div>
  );
}

function formatProviderOptionLabel(p: ProviderOption): string {
  const parts: string[] = [`${p.name}（${PROVIDER_LEVEL_DISPLAY[p.level]?.label ?? p.level}）`];
  if (p.experience_years != null) parts.push(`${p.experience_years}年`);
  const areas = p.service_areas ?? [];
  if (areas.length > 0) parts.push(areas.slice(0, 2).join('、'));
  return parts.join(' · ');
}

function ProviderDetailCard({ provider }: { provider: ProviderOptionFull }) {
  return (
    <div>
      <div className="flex items-center gap-4">
        {provider.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={provider.photo_url}
            alt={`${provider.name} 個人照片`}
            className="h-16 w-16 rounded-xl object-cover shadow-brand-low"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-100 text-xl font-bold text-brand-700 shadow-brand-low">
            {provider.name.charAt(0) || '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-ink-900">{provider.name}</p>
          <p className="text-xs text-ink-500">
            {PROVIDER_LEVEL_DISPLAY[provider.level]?.label ?? provider.level}
            {provider.experience_years != null && ` ・ 年資 ${provider.experience_years} 年`}
          </p>
        </div>
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        {provider.phone && (
          <div className="flex justify-between">
            <dt className="text-ink-500">電話</dt>
            <dd className="font-medium text-ink-900">{provider.phone}</dd>
          </div>
        )}
        {(provider.specialties ?? []).length > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">專業</dt>
            <dd className="text-right text-ink-900">{(provider.specialties as string[]).join('、')}</dd>
          </div>
        )}
        {flattenCertifications(provider.certifications).length > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">證照</dt>
            <dd className="text-right text-ink-900">{flattenCertifications(provider.certifications).join('、')}</dd>
          </div>
        )}
        {(provider.service_areas ?? []).length > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">服務區域</dt>
            <dd className="text-right text-ink-900">{(provider.service_areas as string[]).join('、')}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
