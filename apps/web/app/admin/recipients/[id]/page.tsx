/**
 * Admin Recipient detail / edit page (Section 1.8.2).
 *
 * Two purposes:
 *   1. View full recipient state (mirrors mobile edit screen content)
 *   2. Override patient binding — fix mistakes caregivers can't (e.g. wrong patient bound)
 *
 * Patient binding flow:
 *   - Read-only "current binding" pill (email + patient name) when bound
 *   - Search box invokes typeahead (debounced) against /api/v1/admin/users?role=patient&search=
 *   - Selecting a result fills the email field; Submit → PUT /admin/recipients/[id]
 *   - "解除連結" button → submit `patient_user_email: null`
 *
 * Edits to other recipient fields use the same PUT endpoint with partial body.
 */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

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

export default function AdminRecipientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [recipient, setRecipient] = useState<RecipientWithCaregiver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Patient binding state — separate from main edit form so binding has its own submit cycle.
  const [bindEmail, setBindEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientUser[]>([]);
  const [searching, setSearching] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRecipient = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Read via /api/v1/recipients/[id] (admin role passes through; this endpoint already
      // returns include patient_user). Avoid /admin/recipients (list-only) for individual fetch.
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

  // Debounced typeahead search against admin/users.
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
      const res = await fetch(`/api/v1/admin/users?${params.toString()}`, {
        signal: controller.signal,
      });
      const json = (await res.json()) as { success: boolean; data: PatientUser[] };
      if (json.success) {
        setSearchResults(json.data ?? []);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setSearchResults([]);
      }
    } finally {
      setSearching(false);
    }
  }

  async function submitBinding(emailOrNull: string | null) {
    if (!recipient) return;
    setSubmitting(true);
    setActionError('');
    setActionSuccess('');
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
        setActionSuccess(emailOrNull ? '已連結被照護者帳號' : '已解除連結');
      } else {
        setActionError(json.error?.message ?? '操作失敗');
      }
    } catch {
      setActionError('網路錯誤');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">載入中...</div>;
  }

  if (error || !recipient) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error || '找不到此被照護者'}
        </div>
        <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Link href="/admin/recipients" className="mb-4 inline-block text-sm text-blue-600 hover:underline">
        &larr; 返回列表
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-gray-900">{recipient.name}</h1>

      {actionError && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
      )}
      {actionSuccess && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{actionSuccess}</div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic information (read-only summary) */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">基本資料</h2>
          <dl className="space-y-3 text-sm">
            <Row label="姓名" value={recipient.name} />
            <Row label="性別" value={
              recipient.gender === 'male' ? '男' :
                recipient.gender === 'female' ? '女' :
                  recipient.gender === 'other' ? '其他' : null
            } />
            <Row label="生日" value={recipient.date_of_birth} />
            <Row label="與委託人關係" value={
              recipient.relationship ? (RELATIONSHIP_LABELS[recipient.relationship] ?? recipient.relationship) : null
            } />
            <Row label="地址" value={recipient.address} />
            <Row label="緊急聯絡人" value={
              recipient.emergency_contact_name && recipient.emergency_contact_phone
                ? `${recipient.emergency_contact_name}（${recipient.emergency_contact_phone}）`
                : (recipient.emergency_contact_name ?? recipient.emergency_contact_phone ?? null)
            } />
            <div>
              <dt className="text-gray-500">疾病標籤</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {recipient.medical_tags.length > 0 ? (
                  recipient.medical_tags.map((tag) => (
                    <span key={tag} className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">{tag}</span>
                  ))
                ) : <span className="text-gray-400">-</span>}
              </dd>
            </div>
            <Row label="備註" value={recipient.notes} />
            <Row label="建立時間" value={new Date(recipient.created_at).toLocaleString('zh-TW')} />
          </dl>
        </div>

        {/* Patient binding override (admin tool) */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">連結被照護者帳號</h2>

          {recipient.patient_user_email ? (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3">
              <div className="text-xs uppercase tracking-wide text-green-700">已連結</div>
              <div className="mt-1 font-medium text-green-900">
                {recipient.patient_user_name ?? '(無名稱)'}（{recipient.patient_user_email}）
              </div>
              <button
                disabled={submitting}
                onClick={() => void submitBinding(null)}
                className="mt-3 rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
              >
                {submitting ? '處理中...' : '解除連結'}
              </button>
            </div>
          ) : (
            <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
              此被照護者尚未連結任何帳號
            </div>
          )}

          <label className="mb-1 block text-sm text-gray-600">
            搜尋被照護者帳號（依姓名或 Email）
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="輸入至少 2 個字元..."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          {searching && <div className="mt-2 text-xs text-gray-400">搜尋中...</div>}
          {!searching && searchResults.length > 0 && (
            <ul className="mt-2 max-h-48 overflow-y-auto rounded border border-gray-200">
              {searchResults.map((u) => (
                <li
                  key={u.id}
                  className={`cursor-pointer px-3 py-2 text-sm hover:bg-blue-50 ${
                    bindEmail === u.email ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setBindEmail(u.email)}
                >
                  <div className="font-medium text-gray-900">{u.name}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </li>
              ))}
            </ul>
          )}
          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="mt-2 text-xs text-gray-400">查無符合的被照護者帳號</div>
          )}

          {bindEmail && (
            <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-2 text-sm">
              已選：<span className="font-medium">{bindEmail}</span>
            </div>
          )}

          <button
            disabled={submitting || !bindEmail || bindEmail === recipient.patient_user_email}
            onClick={() => void submitBinding(bindEmail)}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '套用中...' : '套用連結'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value || <span className="text-gray-400">-</span>}</dd>
    </div>
  );
}
