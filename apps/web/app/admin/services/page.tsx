'use client';

import { useState, useEffect, useCallback } from 'react';

interface ServiceCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse {
  success: boolean;
  data: ServiceCategory[];
  meta: { page: number; limit: number; total: number };
}

export default function AdminServiceCategoriesPage() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/admin/service-categories?limit=100');
      const json = (await res.json()) as PaginatedResponse;
      if (json.success) {
        setCategories(json.data);
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
    void fetchCategories();
  }, [fetchCategories]);

  const toggleActive = async (cat: ServiceCategory) => {
    setToggling(cat.id);
    try {
      const res = await fetch(`/api/v1/admin/service-categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !cat.is_active }),
      });
      const json = (await res.json()) as { success: boolean };
      if (json.success) {
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, is_active: !c.is_active } : c)),
        );
      }
    } catch {
      setError('切換失敗');
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">服務類別管理</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button
            className="ml-2 text-red-900 underline"
            onClick={() => void fetchCategories()}
          >
            重試
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">載入中...</div>
      ) : categories.length === 0 ? (
        <div className="text-gray-500">目前沒有服務類別</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">排序</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">代碼</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">名稱</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">說明</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">狀態</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {categories.map((cat) => (
                <tr key={cat.id} className={cat.is_active ? '' : 'bg-gray-50 opacity-60'}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {cat.sort_order}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-600">
                    {cat.code}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {cat.name}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-600">
                    {cat.description ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        cat.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {cat.is_active ? '啟用' : '停用'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <button
                      disabled={toggling === cat.id}
                      onClick={() => void toggleActive(cat)}
                      className={`rounded px-3 py-1 text-xs font-medium ${
                        cat.is_active
                          ? 'bg-red-50 text-red-700 hover:bg-red-100'
                          : 'bg-green-50 text-green-700 hover:bg-green-100'
                      } disabled:opacity-50`}
                    >
                      {toggling === cat.id ? '處理中...' : cat.is_active ? '停用' : '啟用'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
