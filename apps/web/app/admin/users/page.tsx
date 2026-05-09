/**
 * Admin user management page (Section 3.6).
 *
 * Lists all users with role / suspended-state filters and admin-driven suspend/unsuspend toggle.
 *
 * Self-suspension guard: the current admin's row has its action button disabled (server also rejects
 * suspending self with 400, but UI prevents the click).
 *
 * Status pill semantics:
 *   - suspended_at IS NULL → green "使用中"
 *   - suspended_at non-null → red "已停權（YYYY-MM-DD）"
 */
'use client';

import { useState, useEffect, useCallback } from 'react';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  suspended_at: string | null;
  created_at: string;
}

interface PaginatedResponse {
  success: boolean;
  data: AdminUser[];
  meta: { page: number; limit: number; total: number };
}

interface MeResponse {
  success: boolean;
  data?: { id: string };
}

const ROLE_LABELS: Record<string, string> = {
  caregiver: '委託人',
  patient: '被照護者',
  provider: '服務人員',
  admin: '管理員',
};

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部角色' },
  { value: 'caregiver', label: '委託人' },
  { value: 'patient', label: '被照護者' },
  { value: 'provider', label: '服務人員' },
  { value: 'admin', label: '管理員' },
];

const SUSPENDED_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部狀態' },
  { value: 'false', label: '使用中' },
  { value: 'true', label: '已停權' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [suspendedFilter, setSuspendedFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Track which row's action is in flight (prevents double-clicks across rows).
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Current admin identity — for the "can't suspend self" guard.
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);

  const limit = 20;

  // Fetch current admin's id (suspend-self guard).
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/v1/auth/me');
        const json = (await res.json()) as MeResponse;
        if (json.success && json.data) {
          setCurrentAdminId(json.data.id);
        }
      } catch { /* fail silent — guard is also enforced server-side */ }
    })();
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (roleFilter) params.set('role', roleFilter);
      if (suspendedFilter) params.set('suspended', suspendedFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/v1/admin/users?${params.toString()}`);
      const json = (await res.json()) as PaginatedResponse;
      if (json.success) {
        setUsers(json.data);
        setTotal(json.meta.total);
      } else {
        setError('載入失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, suspendedFilter, search]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function toggleSuspension(user: AdminUser) {
    if (user.id === currentAdminId) return; // shouldn't happen — button disabled
    const willSuspend = user.suspended_at === null;
    const verb = willSuspend ? '停權' : '恢復';
    if (!confirm(`確定要${verb}使用者「${user.name}」（${user.email}）？`)) return;

    setSubmittingId(user.id);
    setActionError('');
    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}/suspension`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: willSuspend }),
      });
      const json = (await res.json()) as { success: boolean; data?: { suspended_at: string | null }; error?: { message: string } };
      if (json.success) {
        // Update list locally without refetching to avoid filter reset.
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id ? { ...u, suspended_at: json.data?.suspended_at ?? null } : u,
          ),
        );
      } else {
        setActionError(json.error?.message ?? `${verb}失敗`);
      }
    } catch {
      setActionError('網路錯誤');
    } finally {
      setSubmittingId(null);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">使用者管理</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button className="ml-2 text-red-900 underline" onClick={() => void fetchUsers()}>
            重試
          </button>
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">角色</label>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          >
            {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">狀態</label>
          <select
            value={suspendedFilter}
            onChange={(e) => { setSuspendedFilter(e.target.value); setPage(1); }}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          >
            {SUSPENDED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <form onSubmit={applySearch} className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-gray-500">搜尋（姓名或 Email）</label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="..."
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            搜尋
          </button>
        </form>
      </div>

      {loading ? (
        <div className="text-gray-500">載入中...</div>
      ) : users.length === 0 ? (
        <div className="text-gray-500">沒有符合條件的使用者</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">姓名</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">角色</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">狀態</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">建立時間</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {users.map((u) => {
                  const isSuspended = u.suspended_at !== null;
                  const isSelf = currentAdminId !== null && u.id === currentAdminId;
                  return (
                    <tr key={u.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {u.name}
                        {isSelf && <span className="ml-2 text-xs text-blue-600">（您自己）</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{u.email}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {isSuspended ? (
                          <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">
                            已停權（{new Date(u.suspended_at as string).toLocaleDateString('zh-TW')}）
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                            使用中
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {new Date(u.created_at).toLocaleDateString('zh-TW')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <button
                          disabled={isSelf || submittingId === u.id}
                          onClick={() => void toggleSuspension(u)}
                          title={isSelf ? '不可停權自己' : ''}
                          className={`rounded px-3 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                            isSuspended
                              ? 'bg-green-600 hover:bg-green-700'
                              : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          {submittingId === u.id ? '處理中...' : (isSuspended ? '恢復' : '停權')}
                        </button>
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
                <span className="px-2 py-1">{page} / {totalPages}</span>
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
