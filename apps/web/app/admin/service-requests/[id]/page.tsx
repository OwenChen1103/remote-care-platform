'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ADMIN_STATUS_TRANSITIONS } from '@remote-care/shared';
import type { ServiceRequestStatus } from '@remote-care/shared';

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
}

interface ProviderOptionFull {
  id: string;
  name: string;
  phone: string | null;
  level: string;
  specialties: string[];
  certifications: string[];
  experience_years: number | null;
  service_areas: string[];
}

// Section 3.6: extended provider shape for eligibility filtering.
interface ProviderOption {
  id: string;
  name: string;
  level: string;
  phone: string | null;
  specialties: string[];
  certifications: string[];
  experience_years: number | null;
  service_areas: string[];
  available_services: string[];
  availability_status: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  submitted: { label: '已送出', color: 'bg-blue-100 text-blue-800' },
  screening: { label: '審核中', color: 'bg-yellow-100 text-yellow-800' },
  candidate_proposed: { label: '已推薦', color: 'bg-purple-100 text-purple-800' },
  caregiver_confirmed: { label: '家屬確認', color: 'bg-indigo-100 text-indigo-800' },
  provider_confirmed: { label: '服務者確認', color: 'bg-teal-100 text-teal-800' },
  arranged: { label: '已安排', color: 'bg-cyan-100 text-cyan-800' },
  in_service: { label: '服務中', color: 'bg-orange-100 text-orange-800' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800' },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-500' },
};

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

// Section 2.8 — admin transition button labels per (current, target) pair.
// Cancellation has its own /cancel route; status/route.ts rejects target='cancelled'.
function statusActionLabel(current: string, target: string): string {
  if (target === 'cancelled') return '取消需求';
  if (current === 'submitted' && target === 'screening') return '開始審核';
  if (current === 'screening' && target === 'submitted') return '退回送出';
  if (target === 'screening') return '退回審核';
  if (target === 'arranged') return '標記為已安排';
  if (target === 'submitted') return '退回送出';
  return STATUS_LABELS[target]?.label ?? target;
}

function statusActionClassName(target: string): string {
  if (target === 'cancelled') return 'bg-red-500 hover:bg-red-600';
  if (target === 'arranged') return 'bg-cyan-600 hover:bg-cyan-700';
  if (target === 'screening') return 'bg-yellow-500 hover:bg-yellow-600';
  if (target === 'submitted') return 'bg-blue-500 hover:bg-blue-600';
  return 'bg-gray-500 hover:bg-gray-600';
}

// Section 3.2.D — informational eligibility filter (admin override allowed).
type EligibilityResult = { eligible: boolean; reasons: string[] };

function isProviderEligible(p: ProviderOption, req: ServiceRequestDetail): EligibilityResult {
  const reasons: string[] = [];
  if (p.availability_status !== 'available') reasons.push('not_available');

  const services = p.available_services ?? [];
  if (services.length > 0 && !services.includes(req.category.code)) {
    reasons.push('category_mismatch');
  }

  const areas = p.service_areas ?? [];
  // Best-effort area substring match against request location.
  // Recipient address would help further but isn't exposed on the shared SR endpoint
  // (Decision A: don't widen recipient select on /service-requests/[id]).
  const target = req.location ?? '';
  if (areas.length > 0 && !areas.some((a) => target.includes(a))) {
    reasons.push('area_mismatch');
  }

  return { eligible: reasons.length === 0, reasons };
}

function eligibilityReasonLabel(reason: string): string {
  switch (reason) {
    case 'not_available': return '目前不可接案';
    case 'category_mismatch': return '不在該服務類別範圍';
    case 'area_mismatch': return '不在服務區域';
    default: return reason;
  }
}

export default function AdminServiceRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ServiceRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [proposing, setProposing] = useState(false);

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
      if (json.success) {
        setProviders(json.data ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    if (request?.status === 'screening') {
      void fetchProviders();
    }
  }, [request?.status, fetchProviders]);

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/v1/service-requests/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, admin_note: adminNote || undefined }),
      });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      if (json.success) {
        await fetchDetail();
      } else {
        setError(json.error?.message ?? '更新失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setUpdating(false);
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
        await fetchDetail();
      } else {
        setError(json.error?.message ?? '取消失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setUpdating(false);
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
        await fetchDetail();
        setSelectedProviderId('');
      } else {
        setError(json.error?.message ?? '提出候選失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setProposing(false);
    }
  };

  // Compute eligibility groups for the candidate dropdown (Section 3.6).
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

  if (loading) return <div className="p-6 text-gray-500">載入中...</div>;
  if (error && !request) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">
          返回列表
        </button>
      </div>
    );
  }
  if (!request) return null;

  const statusInfo = STATUS_LABELS[request.status] ?? {
    label: request.status,
    color: 'bg-gray-100 text-gray-600',
  };

  // Section 2.8 — admin status transitions from the shared constant.
  const allowedTransitions = ADMIN_STATUS_TRANSITIONS[request.status as ServiceRequestStatus] ?? [];
  const canPropose = request.status === 'screening';

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/service-requests" className="text-blue-600 hover:underline">
          &larr; 返回列表
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">需求單詳情</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">基本資訊</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">服務類別</dt>
              <dd className="font-medium text-gray-900">{request.category.name}</dd>
            </div>
            <div>
              <dt className="text-gray-500">被照護者</dt>
              <dd className="font-medium text-gray-900">{request.recipient.name}</dd>
            </div>
            <div>
              <dt className="text-gray-500">期望日期</dt>
              <dd className="text-gray-900">
                {new Date(request.preferred_date).toLocaleDateString('zh-TW')}
                {request.preferred_time_slot && ` ${TIME_SLOT_LABELS[request.preferred_time_slot] ?? request.preferred_time_slot}`}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">服務地點</dt>
              <dd className="text-gray-900">{request.location}</dd>
            </div>
            <div>
              <dt className="text-gray-500">需求描述</dt>
              <dd className="whitespace-pre-wrap text-gray-900">{request.description}</dd>
            </div>
            <div>
              <dt className="text-gray-500">建立時間</dt>
              <dd className="text-gray-900">
                {new Date(request.created_at).toLocaleString('zh-TW')}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-6">
          {request.assigned_provider && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">指派服務者</h2>
              <ProviderDetailCard provider={request.assigned_provider} />
            </div>
          )}

          {request.candidate_provider && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">候選服務人員</h2>
              <ProviderDetailCard provider={request.candidate_provider} />
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className={request.caregiver_confirmed_at ? 'text-green-600' : 'text-gray-400'}>
                    {request.caregiver_confirmed_at ? '✓' : '○'} 委託人確認
                  </span>
                  {request.caregiver_confirmed_at && (
                    <span className="text-xs text-gray-400">
                      {new Date(request.caregiver_confirmed_at).toLocaleString('zh-TW')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={request.provider_confirmed_at ? 'text-green-600' : 'text-gray-400'}>
                    {request.provider_confirmed_at ? '✓' : '○'} 服務人員確認
                  </span>
                  {request.provider_confirmed_at && (
                    <span className="text-xs text-gray-400">
                      {new Date(request.provider_confirmed_at).toLocaleString('zh-TW')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {canPropose && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">提出候選服務人員</h2>
              <select
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">&mdash; 選擇服務人員 &mdash;</option>
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
                <div className={`mb-3 rounded border p-3 text-sm ${
                  selectedProviderEligibility.result.eligible
                    ? 'border-blue-100 bg-blue-50'
                    : 'border-yellow-200 bg-yellow-50'
                }`}>
                  <p className="font-medium text-gray-900">
                    {selectedProviderEligibility.provider.name}（{selectedProviderEligibility.provider.level}）
                  </p>
                  {(selectedProviderEligibility.provider.specialties ?? []).length > 0 && (
                    <p className="text-gray-600">
                      專業：{(selectedProviderEligibility.provider.specialties).join('、')}
                    </p>
                  )}
                  {(selectedProviderEligibility.provider.certifications ?? []).length > 0 && (
                    <p className="text-gray-600">
                      證照：{(selectedProviderEligibility.provider.certifications).join('、')}
                    </p>
                  )}
                  {!selectedProviderEligibility.result.eligible && (
                    <div className="mt-2 rounded bg-yellow-100 p-2 text-xs text-yellow-800">
                      <strong>注意：此服務人員不完全符合需求</strong>
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
                disabled={!selectedProviderId || proposing}
                onClick={() => void proposeCandidate()}
                className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {proposing ? '提出中...' : '提出候選'}
              </button>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">狀態操作</h2>
            <div className="mb-4">
              <label className="mb-1 block text-sm text-gray-600">管理員備註</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                rows={3}
                placeholder="選填備註..."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {allowedTransitions.length === 0 ? (
                <p className="text-sm text-gray-500">此狀態無可用操作</p>
              ) : (
                allowedTransitions.map((next) => {
                  const onClick = next === 'cancelled'
                    ? () => void cancelRequest()
                    : () => void updateStatus(next);
                  return (
                    <button
                      key={next}
                      disabled={updating}
                      onClick={onClick}
                      className={`rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                        statusActionClassName(next)
                      }`}
                    >
                      {statusActionLabel(request.status, next)}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatProviderOptionLabel(p: ProviderOption): string {
  const parts: string[] = [`${p.name}（${p.level}）`];
  if (p.experience_years != null) parts.push(`${p.experience_years}年`);
  const areas = p.service_areas ?? [];
  if (areas.length > 0) parts.push(areas.slice(0, 2).join('、'));
  return parts.join(' · ');
}

const LEVEL_LABELS: Record<string, string> = { L1: '初級', L2: '中級', L3: '資深' };

function ProviderDetailCard({ provider }: { provider: ProviderOptionFull }) {
  return (
    <dl className="space-y-2 text-sm">
      <div><dt className="text-gray-500">姓名</dt><dd className="font-medium text-gray-900">{provider.name}</dd></div>
      <div><dt className="text-gray-500">等級</dt><dd className="text-gray-900">{provider.level}（{LEVEL_LABELS[provider.level] ?? provider.level}）</dd></div>
      {provider.phone && <div><dt className="text-gray-500">電話</dt><dd className="text-gray-900">{provider.phone}</dd></div>}
      {provider.experience_years != null && <div><dt className="text-gray-500">年資</dt><dd className="text-gray-900">{provider.experience_years} 年</dd></div>}
      {(provider.specialties ?? []).length > 0 && (
        <div><dt className="text-gray-500">專業</dt><dd className="text-gray-900">{(provider.specialties as string[]).join('、')}</dd></div>
      )}
      {(provider.certifications ?? []).length > 0 && (
        <div><dt className="text-gray-500">證照</dt><dd className="text-gray-900">{(provider.certifications as string[]).join('、')}</dd></div>
      )}
      {(provider.service_areas ?? []).length > 0 && (
        <div><dt className="text-gray-500">服務區域</dt><dd className="text-gray-900">{(provider.service_areas as string[]).join('、')}</dd></div>
      )}
    </dl>
  );
}
