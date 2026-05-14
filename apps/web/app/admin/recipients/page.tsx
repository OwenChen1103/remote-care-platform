'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Search } from 'lucide-react';
import { AdminTable, Avatar, PageHeader } from '@/components/admin';
import type { AdminTableColumn, SortState } from '@/components/admin';

interface Recipient {
  id: string;
  caregiver_id: string;
  patient_user_id: string | null;
  patient_user_email: string | null;
  patient_user_name: string | null;
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

const GENDER_LABEL: Record<string, string> = { male: '男', female: '女', other: '其他' };

export default function AdminRecipientsPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>(null);
  const limit = 20;

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set('search', search);
      if (sort) params.set('sort', `${sort.key}:${sort.order}`);

      const res = await fetch(`/api/v1/admin/recipients?${params.toString()}`);
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
  }, [page, search, sort]);

  useEffect(() => {
    void fetchRecipients();
  }, [fetchRecipients]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  const columns: AdminTableColumn<Recipient>[] = [
    {
      key: 'name',
      header: '姓名',
      sortKey: 'name',
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.name} size="md" />
          <div className="min-w-0">
            <p className="font-medium text-ink-900">{r.name}</p>
            <p className="text-xs text-ink-500">
              {r.gender ? GENDER_LABEL[r.gender] ?? r.gender : '—'}
              {r.date_of_birth && ` ・ ${r.date_of_birth}`}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'medical_tags',
      header: '疾病標籤',
      whitespaceNowrap: false,
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.medical_tags.length > 0
            ? r.medical_tags.map((tag) => (
                <span key={tag} className="inline-block rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {tag}
                </span>
              ))
            : <span className="text-xs text-ink-300">無</span>}
        </div>
      ),
    },
    {
      key: 'binding',
      header: '連結帳號',
      cell: (r) =>
        r.patient_user_email ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-positive-soft px-2.5 py-0.5 text-xs font-medium text-positive">
            <Check className="h-3 w-3" aria-hidden="true" />
            {r.patient_user_email}
          </span>
        ) : (
          <span className="text-xs text-ink-300">未連結</span>
        ),
    },
    {
      key: 'emergency_contact',
      header: '主要聯絡人',
      cell: (r) => r.emergency_contact_name ?? <span className="text-ink-300">—</span>,
    },
    {
      key: 'created_at',
      header: '建立時間',
      sortKey: 'created_at',
      cell: (r) => <span className="text-ink-500">{new Date(r.created_at).toLocaleDateString('zh-TW')}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <Link
          href={`/admin/recipients/${r.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
        >
          編輯
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="被照護者總覽"
        description="平台所有被照護者資料；可由此覆蓋家屬綁定"
      />

      {/* Search — uses the existing `search` param on /api/v1/admin/recipients */}
      <form onSubmit={applySearch} className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜尋被照護者姓名…"
          className="block w-full rounded-xl border border-outline bg-white py-2 pl-10 pr-3 text-sm shadow-brand-low transition-colors placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </form>

      <AdminTable
        data={recipients}
        columns={columns}
        rowKey={(r) => r.id}
        loading={loading}
        error={error || null}
        onRetry={() => void fetchRecipients()}
        emptyTitle={search ? '沒有符合搜尋的被照護者' : '目前沒有被照護者資料'}
        emptyDescription={search ? undefined : '平台啟用後，委託人新增的被照護者會出現在這裡'}
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1); }}
        pagination={{
          page,
          total,
          limit,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
