'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Calendar, ChevronRight, MapPin } from 'lucide-react';
import { SERVICE_REQUEST_STATUS_DISPLAY } from '@remote-care/shared';
import {
  AdminTable,
  LoadingState,
  PageHeader,
  ServiceRequestStatusBadge,
} from '@/components/admin';
import type { AdminTableColumn, SortState } from '@/components/admin';

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

interface CategoryOption {
  id: string;
  name: string;
}

export default function AdminServiceRequestsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ServiceRequestsPageInner />
    </Suspense>
  );
}

function ServiceRequestsPageInner() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams?.get('status') ?? '';

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [sort, setSort] = useState<SortState>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const limit = 20;

  // Load service-category options once for the filter dropdown.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/v1/admin/service-categories?limit=100');
        const json = (await res.json()) as { success: boolean; data: CategoryOption[] };
        if (json.success) setCategories(json.data ?? []);
      } catch { /* non-fatal */ }
    })();
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category_id', categoryFilter);
      if (sort) params.set('sort', `${sort.key}:${sort.order}`);
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
  }, [page, statusFilter, categoryFilter, sort]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const columns: AdminTableColumn<ServiceRequest>[] = [
    {
      key: 'status',
      header: '狀態',
      sortKey: 'status',
      cell: (r) => <ServiceRequestStatusBadge status={r.status} />,
    },
    {
      key: 'category',
      header: '服務類別',
      cell: (r) => (
        <div>
          <p className="font-medium text-ink-900">{r.category.name}</p>
          <p className="text-xs text-ink-500">{r.recipient.name}</p>
        </div>
      ),
    },
    {
      key: 'preferred_date',
      header: '期望日期',
      sortKey: 'preferred_date',
      cell: (r) => (
        <div className="flex items-center gap-1.5 text-ink-700">
          <Calendar className="h-3.5 w-3.5 text-ink-500" aria-hidden="true" />
          {new Date(r.preferred_date).toLocaleDateString('zh-TW')}
        </div>
      ),
    },
    {
      key: 'location',
      header: '地點',
      whitespaceNowrap: false,
      cellClassName: 'max-w-xs',
      cell: (r) => (
        <div className="flex items-start gap-1.5">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500" aria-hidden="true" />
          <span className="truncate text-ink-700">{r.location}</span>
        </div>
      ),
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
          href={`/admin/service-requests/${r.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
        >
          查看
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ),
    },
  ];

  const statusOptions = [
    { value: '', label: '全部狀態' },
    ...Object.entries(SERVICE_REQUEST_STATUS_DISPLAY).map(([key, { label }]) => ({
      value: key,
      label,
    })),
  ];

  return (
    <div>
      <PageHeader
        title="服務需求管理"
        description="審核需求、推薦候選人、追蹤狀態，必要時可強制取消"
      />

      {/* Filters — status + category side by side */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">狀態</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-outline bg-white px-3 py-1.5 text-sm shadow-brand-low focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">服務類別</label>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-outline bg-white px-3 py-1.5 text-sm shadow-brand-low focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="">全部類別</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <AdminTable
        data={requests}
        columns={columns}
        rowKey={(r) => r.id}
        loading={loading}
        error={error || null}
        onRetry={() => void fetchRequests()}
        emptyTitle="目前沒有符合條件的服務需求"
        emptyDescription={!statusFilter && !categoryFilter ? '委託人從 App 建立需求單後會出現在這裡' : undefined}
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
