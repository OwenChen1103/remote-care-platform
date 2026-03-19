'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Provider {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  level: string;
  specialties: string[];
  certifications: string[];
  experience_years: number | null;
  service_areas: string[];
  availability_status: string;
  review_status: string;
  admin_note: string | null;
  created_at: string;
}

interface ApiResponse {
  success: boolean;
  data: Provider;
  error?: { code: string; message: string };
}

const REVIEW_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '待審核', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: '已核准', color: 'bg-green-100 text-green-800' },
  suspended: { label: '已停權', color: 'bg-red-100 text-red-800' },
};

const LEVEL_LABELS: Record<string, string> = {
  L1: '初級',
  L2: '中級',
  L3: '資深',
};

const AVAILABILITY_LABELS: Record<string, string> = {
  available: '可接案',
  busy: '忙碌中',
  offline: '離線',
};

export default function AdminProviderDetailPage() {
  const params = useParams<{ id: string }>();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

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

  const handleReview = async (reviewStatus: 'approved' | 'suspended') => {
    setSubmitting(true);
    setActionError('');
    try {
      const res = await fetch(`/api/v1/providers/${params.id}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_status: reviewStatus, admin_note: adminNote }),
      });
      const json = (await res.json()) as ApiResponse;
      if (json.success) {
        setProvider(json.data);
      } else {
        setActionError(json.error?.message ?? '操作失敗');
      }
    } catch {
      setActionError('網路錯誤');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">載入中...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button className="ml-2 text-red-900 underline" onClick={() => void fetchProvider()}>
            重試
          </button>
        </div>
      </div>
    );
  }

  if (!provider) return null;

  const statusInfo = REVIEW_STATUS_LABELS[provider.review_status] ?? {
    label: provider.review_status,
    color: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="p-6">
      <Link href="/admin/providers" className="mb-4 inline-block text-sm text-blue-600 hover:underline">
        &larr; 返回列表
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{provider.name}</h1>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="text-sm text-gray-500">電話</div>
          <div className="text-sm text-gray-900">{provider.phone ?? '-'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Email</div>
          <div className="text-sm text-gray-900">{provider.email ?? '-'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">等級</div>
          <div className="text-sm text-gray-900">
            {LEVEL_LABELS[provider.level] ?? provider.level}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">年資</div>
          <div className="text-sm text-gray-900">
            {provider.experience_years != null ? `${provider.experience_years} 年` : '-'}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">可用性</div>
          <div className="text-sm text-gray-900">
            {AVAILABILITY_LABELS[provider.availability_status] ?? provider.availability_status}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">建立時間</div>
          <div className="text-sm text-gray-900">
            {new Date(provider.created_at).toLocaleDateString('zh-TW')}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-1 text-sm text-gray-500">專長</div>
        <div className="flex flex-wrap gap-2">
          {Array.isArray(provider.specialties) && provider.specialties.length > 0 ? (
            provider.specialties.map((s) => (
              <span
                key={s}
                className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
              >
                {s}
              </span>
            ))
          ) : (
            <span className="text-sm text-gray-400">無</span>
          )}
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-1 text-sm text-gray-500">服務區域</div>
        <div className="flex flex-wrap gap-2">
          {Array.isArray(provider.service_areas) && provider.service_areas.length > 0 ? (
            provider.service_areas.map((a) => (
              <span
                key={a}
                className="inline-block rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700"
              >
                {a}
              </span>
            ))
          ) : (
            <span className="text-sm text-gray-400">無</span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">審核操作</h2>
        <div className="mb-3">
          <label htmlFor="admin-note" className="mb-1 block text-sm text-gray-600">
            管理備註
          </label>
          <textarea
            id="admin-note"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            rows={3}
            placeholder="填寫審核備註..."
          />
        </div>

        {actionError && (
          <div className="mb-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{actionError}</div>
        )}

        <div className="flex gap-3">
          <button
            disabled={submitting || provider.review_status === 'approved'}
            onClick={() => void handleReview('approved')}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            核准
          </button>
          <button
            disabled={submitting || provider.review_status === 'suspended'}
            onClick={() => void handleReview('suspended')}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            停權
          </button>
        </div>
      </div>
    </div>
  );
}
