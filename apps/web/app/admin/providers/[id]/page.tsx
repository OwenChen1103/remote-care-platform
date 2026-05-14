'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { PROVIDER_LEVEL_DISPLAY } from '@remote-care/shared';
import {
  ConfirmModal,
  ErrorBanner,
  Field,
  LoadingState,
  ProviderAvailabilityBadge,
  ProviderReviewStatusBadge,
  SectionCard,
  useToast,
} from '@/components/admin';

interface Provider {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  level: string;
  specialties: string[];
  certifications: string[];
  experience_years: number | null;
  service_areas: string[];
  availability_status: string;
  review_status: string;
  admin_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface ApiResponse {
  success: boolean;
  data: Provider;
  error?: { code: string; message: string };
}

type ReviewAction = 'approved' | 'rejected' | 'suspended';

const ACTION_LABELS: Record<ReviewAction, { verb: string; tone: 'primary' | 'warning' | 'danger' }> = {
  approved:  { verb: '核准',         tone: 'primary' },
  rejected:  { verb: '拒絕並退回',   tone: 'warning' },
  suspended: { verb: '停權',         tone: 'danger' },
};

export default function AdminProviderDetailPage() {
  const params = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);

  const fetchProvider = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/providers/${params.id}`);
      const json = (await res.json()) as ApiResponse;
      if (json.success) {
        setProvider(json.data);
        setAdminNote(json.data.admin_note ?? '');
      } else {
        setError(json.error?.message ?? '載入失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void fetchProvider();
  }, [fetchProvider]);

  const submitReview = async (reviewStatus: ReviewAction) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/providers/${params.id}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_status: reviewStatus, admin_note: adminNote }),
      });
      const json = (await res.json()) as ApiResponse;
      if (json.success) {
        setProvider(json.data);
        showToast({
          tone: 'success',
          message: `已${ACTION_LABELS[reviewStatus].verb}「${json.data.name}」`,
        });
      } else {
        showToast({ tone: 'error', message: json.error?.message ?? '操作失敗' });
      }
    } catch {
      showToast({ tone: 'error', message: '網路錯誤' });
    } finally {
      setSubmitting(false);
      setPendingAction(null);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorBanner message={error} onRetry={() => void fetchProvider()} />;
  if (!provider) return null;

  // Button enable rules per Section 4.1.7 + state machine guards in API:
  const canApprove = provider.review_status !== 'approved';
  const canReject = provider.review_status === 'pending' && adminNote.trim().length > 0;
  const canSuspend = provider.review_status === 'approved' && adminNote.trim().length > 0;

  const levelLabel = PROVIDER_LEVEL_DISPLAY[provider.level]?.label ?? provider.level;

  return (
    <div>
      <Link href="/admin/providers" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition-colors hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </Link>

      {/* Hero with photo */}
      <section className="relative overflow-hidden rounded-2xl border border-outline bg-hero-gradient p-6 shadow-brand-low sm:p-8">
        <div className="flex flex-wrap items-center gap-6">
          {provider.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={provider.photo_url}
              alt={`${provider.name} 個人照片`}
              className="h-24 w-24 rounded-2xl object-cover shadow-brand-md ring-2 ring-white"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-brand-100 text-3xl font-bold text-brand-700 shadow-brand-md ring-2 ring-white">
              {provider.name.charAt(0) || '?'}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-ink-900">{provider.name}</h1>
              <ProviderReviewStatusBadge status={provider.review_status} size="md" />
            </div>
            <p className="mt-1 text-sm text-ink-700">
              {levelLabel}
              {provider.experience_years != null && ` ・ 年資 ${provider.experience_years} 年`}
              {' ・ '}
              <span className="inline-flex items-center gap-1">
                可用性：<ProviderAvailabilityBadge status={provider.availability_status} />
              </span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-500">
              {provider.submitted_at && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> 送審 {new Date(provider.submitted_at).toLocaleDateString('zh-TW')}
                </span>
              )}
              {provider.reviewed_at && (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> 審核 {new Date(provider.reviewed_at).toLocaleDateString('zh-TW')}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> 建立 {new Date(provider.created_at).toLocaleDateString('zh-TW')}
              </span>
            </div>
          </div>
        </div>
        {/* Photo guidance — only relevant when reviewing */}
        {provider.review_status === 'pending' && (
          <p className="mt-5 inline-flex items-start gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-ink-700 ring-1 ring-brand-100">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 text-brand-500" />
            照片需為正面、露出耳朵。若不符合請先「拒絕並退回」並要求重傳。
          </p>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Contact + meta */}
        <SectionCard icon={Briefcase} title="基本資訊">
          <dl className="space-y-4 text-sm">
            <Field icon={Phone} label="電話" value={provider.phone} />
            <Field icon={Mail}  label="Email" value={provider.email} />
            <Field icon={Award} label="等級" value={levelLabel} />
            <Field
              icon={Clock}
              label="年資"
              value={provider.experience_years != null ? `${provider.experience_years} 年` : null}
            />
          </dl>
        </SectionCard>

        {/* Skills + certs + areas */}
        <SectionCard icon={Sparkles} title="專業與服務區域">
          <div className="space-y-5 text-sm">
            <ChipsField label="專長" items={provider.specialties} tone="brand" />
            <ChipsField label="證照" items={provider.certifications.filter((c) => c !== ';')} tone="accent" />
            <ChipsField icon={MapPin} label="服務區域" items={provider.service_areas} tone="brand" />
          </div>
        </SectionCard>
      </div>

      {/* Review action card */}
      <div className="mt-6 rounded-2xl border border-outline bg-white p-6 shadow-brand-low">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50">
            <ShieldCheck className="h-4 w-4 text-brand-600" />
          </span>
          <h2 className="text-base font-semibold text-ink-900">審核操作</h2>
        </div>

        <label htmlFor="admin-note" className="mb-1.5 block text-sm font-medium text-ink-900">
          管理備註
          <span className="ml-2 text-xs font-normal text-ink-500">（拒絕或停權時必填，會通知服務人員）</span>
        </label>
        <textarea
          id="admin-note"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={3}
          placeholder="填寫審核備註…"
          className="block w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm shadow-brand-low transition-colors placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <ReviewButton
            label="核准"
            icon={CheckCircle2}
            disabled={submitting || !canApprove}
            onClick={() => setPendingAction('approved')}
            tone="positive"
          />
          <ReviewButton
            label="拒絕並退回"
            icon={XCircle}
            disabled={submitting || !canReject}
            onClick={() => setPendingAction('rejected')}
            tone="warning"
            title={
              provider.review_status !== 'pending'
                ? '僅待審核的服務人員可被拒絕'
                : !adminNote.trim() ? '請先填寫管理備註說明拒絕原因' : undefined
            }
          />
          <ReviewButton
            label="停權"
            icon={XCircle}
            disabled={submitting || !canSuspend}
            onClick={() => setPendingAction('suspended')}
            tone="danger"
            title={
              provider.review_status !== 'approved'
                ? '僅已核准的服務人員可被停權'
                : !adminNote.trim() ? '請先填寫停權原因' : undefined
            }
          />
        </div>

        {provider.review_status === 'rejected' && (
          <p className="mt-4 text-xs text-ink-500">
            服務人員可透過 App 重新送審。送審後將回到「待審核」狀態。
          </p>
        )}
        {provider.review_status === 'suspended' && (
          <p className="mt-4 text-xs text-ink-500">
            停權後僅管理員可恢復（重新核准）。
          </p>
        )}
      </div>

      <ConfirmModal
        open={pendingAction !== null}
        title={pendingAction ? `${ACTION_LABELS[pendingAction].verb}「${provider.name}」` : ''}
        description={
          pendingAction === 'approved'
            ? '核准後此服務人員可以開始接案，並會收到通知。'
            : pendingAction === 'rejected'
              ? `備註會傳給服務人員作為退回原因。\n\n${adminNote.trim()}`
              : pendingAction === 'suspended'
                ? `停權後此服務人員無法再被指派任何任務。\n\n停權原因：${adminNote.trim()}`
                : undefined
        }
        confirmLabel={pendingAction ? ACTION_LABELS[pendingAction].verb : ''}
        tone={pendingAction ? ACTION_LABELS[pendingAction].tone : 'primary'}
        submitting={submitting}
        onClose={() => setPendingAction(null)}
        onConfirm={async () => {
          if (pendingAction) await submitReview(pendingAction);
        }}
      />

    </div>
  );
}

function ChipsField({
  icon: Icon,
  label,
  items,
  tone,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  items: string[];
  tone: 'brand' | 'accent';
}) {
  const chipClass = tone === 'accent'
    ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-100'
    : 'bg-brand-50 text-brand-700 ring-1 ring-brand-100';
  return (
    <div>
      <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-ink-500">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {label}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-ink-300">—</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${chipClass}`}>
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewButton({
  label,
  icon: Icon,
  tone,
  onClick,
  disabled,
  title,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'positive' | 'warning' | 'danger';
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const toneClass: Record<typeof tone, string> = {
    positive: 'bg-positive text-white hover:bg-accent-600',
    warning:  'bg-warning text-white hover:bg-orange-500',
    danger:   'bg-danger text-white hover:bg-rose-600',
  } as Record<'positive' | 'warning' | 'danger', string>;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold shadow-brand-md transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${toneClass[tone]}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
