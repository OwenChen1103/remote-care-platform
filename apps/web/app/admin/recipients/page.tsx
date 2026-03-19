'use client';

import { useState, useEffect, useCallback } from 'react';

interface Recipient {
  id: string;
  caregiver_id: string;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
  medical_tags: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string;
}

interface PaginatedResponse {
  success: boolean;
  data: Recipient[];
  meta: { page: number; limit: number; total: number };
}

export default function AdminRecipientsPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const limit = 20;

  const fetchRecipients = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/admin/recipients?page=${p}&limit=${limit}`);
      const json = (await res.json()) as PaginatedResponse;
      if (json.success) {
        setRecipients(json.data);
        setTotal(json.meta.total);
      } else {
        setError('載入失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecipients(page);
  }, [page, fetchRecipients]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">被照護者總覽</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button
            className="ml-2 text-red-900 underline"
            onClick={() => void fetchRecipients(page)}
          >
            重試
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">載入中...</div>
      ) : recipients.length === 0 ? (
        <div className="text-gray-500">目前沒有被照護者資料</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">姓名</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">性別</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">生日</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">疾病標籤</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">緊急聯絡人</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">建立時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {recipients.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {r.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {r.gender === 'male' ? '男' : r.gender === 'female' ? '女' : r.gender === 'other' ? '其他' : '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {r.date_of_birth ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex flex-wrap gap-1">
                        {r.medical_tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {r.emergency_contact_name ?? '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {new Date(r.created_at).toLocaleDateString('zh-TW')}
                    </td>
                  </tr>
                ))}
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
