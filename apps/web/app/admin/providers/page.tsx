'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { PROVIDER_LEVEL_DISPLAY } from '@remote-care/shared';
import {
  AdminTable,
  Avatar,
  FilterChips,
  LoadingState,
  PageHeader,
  ProviderAvailabilityBadge,
  ProviderReviewStatusBadge,
} from '@/components/admin';
import type { AdminTableColumn, SortState } from '@/components/admin';

interface Provider {
  id: string;
  name: string;
  phone: string | null;
  level: string;
  specialties: string[];
  availability_status: string;
  review_status: string;
  photo_url?: string | null;
}

interface PaginatedResponse {
  success: boolean;
  data: Provider[];
  meta: { page: number; limit: number; total: number };
}

const REVIEW_STATUS_OPTIONS = [
  { value: '',          label: '全部' },
  { value: 'pending',   label: '待審核' },
  { value: 'approved',  label: '已核准' },
  { value: 'rejected',  label: '未通過' },
  { value: 'suspended', label: '已停權' },
];

const AVAILABILITY_OPTIONS = [
  { value: '',          label: '全部' },
  { value: 'available', label: '可接案' },
  { value: 'busy',      label: '忙碌中' },
  { value: 'offline',   label: '離線' },
];

export default function AdminProvidersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ProvidersPageInner />
    </Suspense>
  );
}

function ProvidersPageInner() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams?.get('status') ?? '';

  const [providers, setProviders] = useState<Provider[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [availabilityFilter, setAvailabilityFilter] = useState('');
  const [sort, setSort] = useState<SortState>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const limit = 20;

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('review_status', statusFilter);
      if (availabilityFilter) params.set('availability_status', availabilityFilter);
      if (sort) params.set('sort', `${sort.key}:${sort.order}`);
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
  }, [page, statusFilter, availabilityFilter, sort]);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  const columns: AdminTableColumn<Provider>[] = [
    {
      key: 'name',
      header: '服務人員',
      sortKey: 'name',
      cell: (p) => (
        <div className="flex items-center gap-3">
          <Avatar src={p.photo_url} name={p.name} size="md" />
          <div className="min-w-0">
            <p className="font-medium text-ink-900">{p.name}</p>
            <p className="text-xs text-ink-500">
              {PROVIDER_LEVEL_DISPLAY[p.level]?.label ?? p.level}
              {p.phone && ` ・ ${p.phone}`}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'specialties',
      header: '專長',
      whitespaceNowrap: false,
      cell: (p) =>
        p.specialties && p.specialties.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {p.specialties.slice(0, 3).map((s) => (
              <span key={s} className="inline-block rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                {s}
              </span>
            ))}
            {p.specialties.length > 3 && (
              <span className="text-xs text-ink-500">+{p.specialties.length - 3}</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-ink-300">—</span>
        ),
    },
    {
      key: 'review_status',
      header: '審核狀態',
      cell: (p) => <ProviderReviewStatusBadge status={p.review_status} />,
    },
    {
      key: 'availability_status',
      header: '可用性',
      cell: (p) => <ProviderAvailabilityBadge status={p.availability_status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <Link
          href={`/admin/providers/${p.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
        >
          查看
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="服務人員管理"
        description="審核新申請、停權違規帳號；停權後不可再被指派任務"
      />

      <div className="mb-3 space-y-3">
        <FilterChips
          label="審核狀態"
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          options={REVIEW_STATUS_OPTIONS}
        />
        <FilterChips
          label="可用性"
          value={availabilityFilter}
          onChange={(v) => { setAvailabilityFilter(v); setPage(1); }}
          options={AVAILABILITY_OPTIONS}
        />
      </div>

      <AdminTable
        data={providers}
        columns={columns}
        rowKey={(p) => p.id}
        loading={loading}
        error={error || null}
        onRetry={() => void fetchProviders()}
        emptyTitle="目前沒有符合條件的服務人員"
        emptyDescription="服務人員透過 App 註冊送審後會出現在這裡"
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
