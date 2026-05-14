/**
 * Admin Recipient detail / edit page (Section 1.8.2).
 *
 * Two purposes:
 *   1. View full recipient state (mirrors mobile edit screen content)
 *   2. Override patient binding — fix mistakes caregivers can't (e.g. wrong patient bound)
 */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Check,
  Heart,
  Link2,
  Link2Off,
  MapPin,
  Phone,
  Search,
  StickyNote,
  UserCircle,
} from 'lucide-react';
import {
  Avatar,
  ConfirmModal,
  ErrorBanner,
  Field,
  LoadingState,
  SectionCard,
  useToast,
} from '@/components/admin';

interface LifestyleHabits {
  water_intake?: string;
  exercise_frequency?: string;
  exercise_intensity?: string;
  starch_intake?: string;
  protein_intake?: string;
  manager_fill?: boolean;
}

interface Recipient {
  id: string;
  caregiver_id: string;
  patient_user_id: string | null;
  patient_user_email: string | null;
  patient_user_name: string | null;
  name: string;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  relationship: string | null;
  medical_tags: string[];
  lifestyle_habits: LifestyleHabits;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PatientUser {
  id: string;
  email: string;
  name: string;
  role: string;
  suspended_at: string | null;
}

interface Caregiver {
  id: string;
  name: string;
  email: string;
}

interface RecipientWithCaregiver extends Recipient {
  caregiver?: Caregiver | null;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  father: '父親',
  mother: '母親',
  grandfather: '祖父/外公',
  grandmother: '祖母/外婆',
  spouse: '配偶',
  sibling: '兄弟姊妹',
  child: '子女',
  other: '其他',
};

const GENDER_LABELS: Record<string, string> = {
  male: '男',
  female: '女',
  other: '其他',
};

export default function AdminRecipientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const [recipient, setRecipient] = useState<RecipientWithCaregiver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [bindEmail, setBindEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRecipient = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/recipients/${id}`);
      const json = (await res.json()) as { success: boolean; data: RecipientWithCaregiver; error?: { message: string } };
      if (json.success) {
        setRecipient(json.data);
      } else {
        setError(json.error?.message ?? '載入失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchRecipient();
  }, [fetchRecipient]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    searchDebounceRef.current = setTimeout(() => {
      void doSearch(searchQuery.trim());
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  async function doSearch(query: string) {
    if (searchAbortRef.current) searchAbortRef.current.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);
    try {
      const params = new URLSearchParams({
        role: 'patient',
        search: query,
        limit: '10',
        suspended: 'false',
      });
      const res = await fetch(`/api/v1/admin/users?${params.toString()}`, { signal: controller.signal });
      const json = (await res.json()) as { success: boolean; data: PatientUser[] };
      if (json.success) {
        setSearchResults(json.data ?? []);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function submitBinding(emailOrNull: string | null) {
    if (!recipient) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/admin/recipients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_user_email: emailOrNull }),
      });
      const json = (await res.json()) as { success: boolean; data: RecipientWithCaregiver; error?: { message: string } };
      if (json.success) {
        setRecipient(json.data);
        setBindEmail('');
        setSearchQuery('');
        setSearchResults([]);
        showToast({
          tone: 'success',
          message: emailOrNull ? '已連結被照護者帳號' : '已解除連結',
        });
      } else {
        showToast({ tone: 'error', message: json.error?.message ?? '操作失敗' });
      }
    } catch {
      showToast({ tone: 'error', message: '網路錯誤' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState />;

  if (error || !recipient) {
    return (
      <div>
        <ErrorBanner message={error || '找不到此被照護者'} />
        <button
          onClick={() => router.back()}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </button>
      </div>
    );
  }

  const lh = recipient.lifestyle_habits ?? {};
  const habitParts: string[] = [];
  if (lh.water_intake) habitParts.push(`喝水量：${lh.water_intake}`);
  if (lh.exercise_frequency) habitParts.push(`運動頻次：${lh.exercise_frequency}`);
  if (lh.exercise_intensity) habitParts.push(`運動強度：${lh.exercise_intensity}`);
  if (lh.starch_intake) habitParts.push(`澱粉：${lh.starch_intake}`);
  if (lh.protein_intake) habitParts.push(`蛋白質：${lh.protein_intake}`);
  const habitSummary = lh.manager_fill ? '由健康管家代填中' : (habitParts.length > 0 ? habitParts.join('；') : null);

  return (
    <div>
      <Link href="/admin/recipients" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition-colors hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </Link>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-outline bg-hero-gradient p-8 shadow-brand-low">
        <div className="flex flex-wrap items-center gap-6">
          <Avatar name={recipient.name} size="lg" ring />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold text-ink-900">{recipient.name}</h1>
            <p className="mt-1 text-sm text-ink-700">
              {recipient.gender ? GENDER_LABELS[recipient.gender] : '—'}
              {recipient.date_of_birth && ` ・ ${recipient.date_of_birth}`}
              {recipient.relationship && ` ・ ${RELATIONSHIP_LABELS[recipient.relationship] ?? recipient.relationship}`}
            </p>
            {recipient.medical_tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {recipient.medical_tags.map((tag) => (
                  <span key={tag} className="inline-block rounded-md bg-white/70 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {recipient.patient_user_email ? (
            <div className="rounded-xl bg-positive-soft px-3 py-2 text-sm text-positive">
              <p className="text-[10px] font-semibold uppercase tracking-wider">已連結帳號</p>
              <p className="mt-0.5 font-medium">{recipient.patient_user_email}</p>
            </div>
          ) : (
            <span className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">尚未連結帳號</span>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Basic info */}
        <SectionCard icon={UserCircle} title="基本資料">
          <dl className="space-y-4 text-sm">
            <Field icon={MapPin}  label="地址"          value={recipient.address} />
            <Field icon={Phone}   label="主要聯絡人"    value={
              recipient.emergency_contact_name && recipient.emergency_contact_phone
                ? `${recipient.emergency_contact_name}（${recipient.emergency_contact_phone}）`
                : (recipient.emergency_contact_name ?? recipient.emergency_contact_phone ?? null)
            } />
            <Field icon={Heart}   label="生活習慣"      value={habitSummary} />
            <Field icon={StickyNote} label="備註"        value={recipient.notes} />
            <Field icon={Calendar} label="建立時間"     value={new Date(recipient.created_at).toLocaleString('zh-TW')} />
          </dl>
        </SectionCard>

        {/* Patient binding */}
        <SectionCard icon={Link2} title="連結被照護者帳號">
          {recipient.patient_user_email ? (
            <div className="mb-4 rounded-xl border border-positive/30 bg-positive-soft p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-positive text-white">
                  <Check className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">已連結帳號</p>
                  <p className="mt-0.5 text-sm font-medium text-ink-900">
                    {recipient.patient_user_name ?? '(無名稱)'}
                  </p>
                  <p className="text-xs text-ink-700">{recipient.patient_user_email}</p>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setUnlinkOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-danger ring-1 ring-danger/20 transition-colors hover:bg-danger-soft disabled:opacity-50"
                >
                  <Link2Off className="h-3.5 w-3.5" />
                  解除連結
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-dashed border-outline-strong bg-surface-subtle p-4 text-sm text-ink-500">
              此被照護者尚未連結任何帳號
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋帳號姓名或 Email…（至少 2 字元）"
              className="block w-full rounded-xl border border-outline bg-white py-2.5 pl-10 pr-3 text-sm shadow-brand-low transition-colors placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {searching && (
            <p className="mt-2 text-xs text-ink-500">搜尋中…</p>
          )}
          {!searching && searchResults.length > 0 && (
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-outline bg-white p-1">
              {searchResults.map((u) => (
                <li
                  key={u.id}
                  className={`cursor-pointer rounded-lg px-3 py-2 text-sm transition-colors ${
                    bindEmail === u.email ? 'bg-brand-50' : 'hover:bg-surface-alt'
                  }`}
                  onClick={() => setBindEmail(u.email)}
                >
                  <div className="font-medium text-ink-900">{u.name}</div>
                  <div className="text-xs text-ink-500">{u.email}</div>
                </li>
              ))}
            </ul>
          )}
          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <p className="mt-2 text-xs text-ink-500">查無符合的被照護者帳號</p>
          )}

          {bindEmail && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
              <Check className="h-3.5 w-3.5" />
              已選：<span className="font-medium">{bindEmail}</span>
            </div>
          )}

          <button
            type="button"
            disabled={submitting || !bindEmail || bindEmail === recipient.patient_user_email}
            onClick={() => void submitBinding(bindEmail)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-brand-md transition-all duration-150 hover:bg-brand-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Link2 className="h-4 w-4" />
            {submitting ? '套用中...' : '套用連結'}
          </button>
        </SectionCard>
      </div>

      <ConfirmModal
        open={unlinkOpen}
        title={`解除「${recipient.name}」的帳號連結`}
        description={
          recipient.patient_user_email
            ? `解除後 ${recipient.patient_user_email}（${recipient.patient_user_name ?? '此被照護者'}）將無法再從 App 看到自己的健康資料。可隨時重新連結。`
            : undefined
        }
        confirmLabel="解除連結"
        tone="danger"
        submitting={submitting}
        onClose={() => setUnlinkOpen(false)}
        onConfirm={async () => {
          await submitBinding(null);
          setUnlinkOpen(false);
        }}
      />

    </div>
  );
}

