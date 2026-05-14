'use client';

import { useState, useEffect, useCallback } from 'react';
import { Info } from 'lucide-react';
import {
  ActiveBadge,
  AdminTable,
  ConfirmModal,
  PageHeader,
  useToast,
} from '@/components/admin';
import type { AdminTableColumn } from '@/components/admin';

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
  const [confirmTarget, setConfirmTarget] = useState<ServiceCategory | null>(null);
  const { showToast } = useToast();

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

  const performToggle = async (cat: ServiceCategory) => {
    setToggling(cat.id);
    try {
      const res = await fetch(`/api/v1/admin/service-categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !cat.is_active }),
      });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      if (json.success) {
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, is_active: !c.is_active } : c)),
        );
        showToast({
          tone: 'success',
          message: `已${cat.is_active ? '停用' : '啟用'}「${cat.name}」`,
        });
      } else {
        showToast({ tone: 'error', message: json.error?.message ?? '切換失敗' });
      }
    } catch {
      showToast({ tone: 'error', message: '網路錯誤' });
    } finally {
      setToggling(null);
      setConfirmTarget(null);
    }
  };

  const columns: AdminTableColumn<ServiceCategory>[] = [
    {
      key: 'name',
      header: '名稱',
      cell: (c) => <span className="font-medium text-ink-900">{c.name}</span>,
    },
    {
      key: 'description',
      header: '說明',
      whitespaceNowrap: false,
      cellClassName: 'max-w-md',
      cell: (c) => <span className="text-ink-700">{c.description ?? <span className="text-ink-300">—</span>}</span>,
    },
    {
      key: 'status',
      header: '狀態',
      cell: (c) => <ActiveBadge active={c.is_active} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) => (
        <button
          type="button"
          disabled={toggling === c.id}
          onClick={() => setConfirmTarget(c)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
            c.is_active
              ? 'bg-danger-soft text-danger hover:bg-danger hover:text-white'
              : 'bg-positive-soft text-positive hover:bg-positive hover:text-white'
          }`}
        >
          {toggling === c.id ? '處理中...' : c.is_active ? '停用' : '啟用'}
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="服務類別啟用 / 停用"
        description="本頁可開關平台對外提供的服務類別"
      />

      {/* Scope clarification — preserved from previous redesign */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-outline bg-white p-4 text-sm text-ink-700 shadow-brand-low">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50">
          <Info className="h-4 w-4 text-brand-600" aria-hidden="true" />
        </span>
        <div>
          <p>
            <strong className="font-medium">停用</strong>後，此類別不會再出現在委託人建立新需求的選項中；
            <strong className="font-medium">既有需求</strong>不受影響，仍可正常進行與完成。
          </p>
          <p className="mt-1 text-ink-500">
            若需新增、刪除類別或修改類別名稱、說明、排序，請聯繫工程團隊（涉及程式碼設定）。
          </p>
        </div>
      </div>

      <AdminTable
        data={categories}
        columns={columns}
        rowKey={(c) => c.id}
        loading={loading}
        error={error || null}
        onRetry={() => void fetchCategories()}
        emptyTitle="目前沒有服務類別"
      />

      <ConfirmModal
        open={confirmTarget !== null}
        title={
          confirmTarget
            ? `${confirmTarget.is_active ? '停用' : '啟用'}服務類別「${confirmTarget.name}」`
            : ''
        }
        description={
          confirmTarget
            ? confirmTarget.is_active
              ? '停用後此類別不再出現在新需求建立流程，現有需求不受影響。'
              : '啟用後此類別將重新出現在需求建立選項中。'
            : undefined
        }
        confirmLabel={confirmTarget?.is_active ? '停用' : '啟用'}
        tone={confirmTarget?.is_active ? 'danger' : 'primary'}
        submitting={toggling === confirmTarget?.id}
        onClose={() => setConfirmTarget(null)}
        onConfirm={async () => {
          if (confirmTarget) await performToggle(confirmTarget);
        }}
      />
    </div>
  );
}
