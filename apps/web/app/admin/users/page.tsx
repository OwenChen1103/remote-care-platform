/**
 * Admin user management page (Section 3.6).
 *
 * Lists all users with role / suspended-state filters and admin-driven suspend/unsuspend toggle.
 *
 * Self-suspension guard: the current admin's row has its action button disabled (server also rejects
 * suspending self with 400, but UI prevents the click).
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import {
  AdminTable,
  Avatar,
  ConfirmModal,
  FilterChips,
  PageHeader,
  SuspensionBadge,
  useToast,
} from '@/components/admin';
import type { AdminTableColumn, SortState } from '@/components/admin';

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

/** Role chip filter — segmented control style. */
const ROLE_CHIPS: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'caregiver', label: '委託人' },
  { value: 'patient', label: '被照護者' },
  { value: 'provider', label: '服務人員' },
  { value: 'admin', label: '管理員' },
];

const SUSPENDED_CHIPS: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'false', label: '使用中' },
  { value: 'true', label: '已停權' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { showToast } = useToast();

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [suspendedFilter, setSuspendedFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>(null);

  // Track which row's action is in flight (prevents double-clicks across rows).
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AdminUser | null>(null);

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
      if (sort) params.set('sort', `${sort.key}:${sort.order}`);

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
  }, [page, roleFilter, suspendedFilter, search, sort]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function performSuspension(user: AdminUser) {
    if (user.id === currentAdminId) return; // shouldn't happen — button disabled
    const willSuspend = user.suspended_at === null;
    const verb = willSuspend ? '停權' : '恢復';

    setSubmittingId(user.id);
    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}/suspension`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: willSuspend }),
      });
      const json = (await res.json()) as { success: boolean; data?: { suspended_at: string | null }; error?: { message: string } };
      if (json.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id ? { ...u, suspended_at: json.data?.suspended_at ?? null } : u,
          ),
        );
        showToast({ tone: 'success', message: `已${verb}「${user.name}」` });
      } else {
        showToast({ tone: 'error', message: json.error?.message ?? `${verb}失敗` });
      }
    } catch {
      showToast({ tone: 'error', message: '網路錯誤' });
    } finally {
      setSubmittingId(null);
      setConfirmTarget(null);
    }
  }

  const columns: AdminTableColumn<AdminUser>[] = [
    {
      key: 'name',
      header: '姓名',
      sortKey: 'name',
      cell: (u) => {
        const isSelf = currentAdminId !== null && u.id === currentAdminId;
        return (
          <div className="flex items-center gap-3">
            <Avatar name={u.name} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink-900">{u.name}</span>
                {isSelf && (
                  <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                    您自己
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-500">{u.email}</p>
            </div>
          </div>
        );
      },
    },
    { key: 'role', header: '角色', cell: (u) => <span className="text-ink-700">{ROLE_LABELS[u.role] ?? u.role}</span> },
    {
      key: 'status',
      header: '狀態',
      cell: (u) => <SuspensionBadge suspendedAt={u.suspended_at} />,
    },
    {
      key: 'created_at',
      header: '建立時間',
      sortKey: 'created_at',
      cell: (u) => <span className="text-ink-500">{new Date(u.created_at).toLocaleDateString('zh-TW')}</span>,
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      cell: (u) => {
        const isSuspended = u.suspended_at !== null;
        const isSelf = currentAdminId !== null && u.id === currentAdminId;
        return (
          <button
            disabled={isSelf || submittingId === u.id}
            onClick={() => setConfirmTarget(u)}
            title={isSelf ? '不可停權自己' : ''}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-brand-low transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
              isSuspended
                ? 'bg-positive hover:bg-accent-600'
                : 'bg-danger hover:bg-rose-600'
            }`}
          >
            {submittingId === u.id ? '處理中...' : isSuspended ? '恢復' : '停權'}
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="使用者管理"
        description="停權後使用者無法登入或呼叫 API；可隨時恢復"
      />

      {/* Filters — chip groups + search */}
      <div className="mb-6 space-y-4">
        <FilterChips
          label="角色"
          value={roleFilter}
          onChange={(v) => { setRoleFilter(v); setPage(1); }}
          options={ROLE_CHIPS}
        />
        <FilterChips
          label="狀態"
          value={suspendedFilter}
          onChange={(v) => { setSuspendedFilter(v); setPage(1); }}
          options={SUSPENDED_CHIPS}
        />
        <form onSubmit={applySearch} className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜尋姓名或 Email…"
            className="block w-full rounded-xl border border-outline bg-white py-2 pl-10 pr-3 text-sm shadow-brand-low transition-colors placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </form>
      </div>

      <AdminTable
        data={users}
        columns={columns}
        rowKey={(u) => u.id}
        loading={loading}
        error={error || null}
        onRetry={() => void fetchUsers()}
        emptyTitle="沒有符合條件的使用者"
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1); }}
        pagination={{
          page,
          total,
          limit,
          onPageChange: setPage,
        }}
      />

      <ConfirmModal
        open={confirmTarget !== null}
        title={
          confirmTarget
            ? `${confirmTarget.suspended_at === null ? '停權' : '恢復'}使用者「${confirmTarget.name}」`
            : ''
        }
        description={
          confirmTarget
            ? confirmTarget.suspended_at === null
              ? `停權後 ${confirmTarget.email} 將無法登入或呼叫 API。可隨時恢復。`
              : `恢復後 ${confirmTarget.email} 將可重新登入並使用平台。`
            : undefined
        }
        confirmLabel={confirmTarget?.suspended_at === null ? '停權' : '恢復'}
        tone={confirmTarget?.suspended_at === null ? 'danger' : 'primary'}
        submitting={submittingId === confirmTarget?.id}
        onClose={() => setConfirmTarget(null)}
        onConfirm={async () => {
          if (confirmTarget) await performSuspension(confirmTarget);
        }}
      />
    </div>
  );
}

