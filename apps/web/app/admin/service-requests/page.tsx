'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ServiceRequest {
  id: string;
  status: string;
  preferred_date: string;
  preferred_time_slot: string | null;
  location: string;
  description: string;
  created_at: string;
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
}

interface PaginatedResponse {
  success: boolean;
  data: ServiceRequest[];
  meta: { page: number; limit: number; total: number };
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

export default function AdminServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const limit = 20;

  const fetchRequests = useCallback(
    async (p: number, status: string) => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ page: String(p), limit: String(limit) });
        if (status) params.set('status', status);
        const res = await fetch(`/api/v1/service-requests?${params}`);
        const json = (await res.json()) as PaginatedResponse;
        if (json.success) {
          setRequests(json.data);
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
    void fetchRequests(page, statusFilter);
  }, [page, statusFilter, fetchRequests]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">服務需求管理</h1>

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
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button
            className="ml-2 text-red-900 underline"
            onClick={() => void fetchRequests(page, statusFilter)}
          >
            重試
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">載入中...</div>
      ) : requests.length === 0 ? (
        <div className="text-gray-500">目前沒有服務需求</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">狀態</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    服務類別
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    被照護者
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    期望日期
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">地點</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    建立時間
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {requests.map((req) => {
                  const statusInfo = STATUS_LABELS[req.status] ?? {
                    label: req.status,
                    color: 'bg-gray-100 text-gray-600',
                  };
                  return (
                    <tr key={req.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {req.category.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {req.recipient.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {new Date(req.preferred_date).toLocaleDateString('zh-TW')}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-600">
                        {req.location}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {new Date(req.created_at).toLocaleDateString('zh-TW')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <Link
                          href={`/admin/service-requests/${req.id}`}
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
