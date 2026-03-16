'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Provider {
  id: string;
  name: string;
  phone: string | null;
  level: string;
  specialties: string[];
  availability_status: string;
  review_status: string;
}

interface PaginatedResponse {
  success: boolean;
  data: Provider[];
  meta: { page: number; limit: number; total: number };
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

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const limit = 20;

  const fetchProviders = useCallback(
    async (p: number, reviewStatus: string) => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ page: String(p), limit: String(limit) });
        if (reviewStatus) params.set('review_status', reviewStatus);
        const res = await fetch(`/api/v1/providers?${params}`);
        const json = (await res.json()) as PaginatedResponse;
        if (json.success) {
          setProviders(json.data);
          setTotal(json.meta.total);
        } else {
          setError('載入失敗');
        }
      } catch {
        setError('網路錯誤');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchProviders(page, statusFilter);
  }, [page, statusFilter, fetchProviders]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">服務人員管理</h1>

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">全部狀態</option>
          <option value="pending">待審核</option>
          <option value="approved">已核准</option>
          <option value="suspended">已停權</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button
            className="ml-2 text-red-900 underline"
            onClick={() => void fetchProviders(page, statusFilter)}
          >
            重試
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">載入中...</div>
      ) : providers.length === 0 ? (
        <div className="text-gray-500">目前沒有服務人員</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">姓名</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">電話</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">等級</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    審核狀態
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">可用性</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {providers.map((provider) => {
                  const statusInfo = REVIEW_STATUS_LABELS[provider.review_status] ?? {
                    label: provider.review_status,
                    color: 'bg-gray-100 text-gray-600',
                  };
                  return (
                    <tr key={provider.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {provider.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {provider.phone ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {LEVEL_LABELS[provider.level] ?? provider.level}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {AVAILABILITY_LABELS[provider.availability_status] ??
                          provider.availability_status}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <Link
                          href={`/admin/providers/${provider.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          查看
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>共 {total} 筆</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded border px-3 py-1 disabled:opacity-50"
                >
                  上一頁
                </button>
                <span className="px-2 py-1">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border px-3 py-1 disabled:opacity-50"
                >
                  下一頁
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
