'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface ServiceRequestDetail {
  id: string;
  caregiver_id: string;
  status: string;
  preferred_date: string;
  preferred_time_slot: string | null;
  location: string;
  description: string;
  admin_note: string | null;
  provider_note: string | null;
  created_at: string;
  updated_at: string;
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
  assigned_provider: { id: string; name: string; phone: string | null } | null;
  candidate_provider: { id: string; name: string } | null;
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

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

export default function AdminServiceRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ServiceRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [adminNote, setAdminNote] = useState('');

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/service-requests/${id}`);
      const json = (await res.json()) as { success: boolean; data: ServiceRequestDetail };
      if (json.success) {
        setRequest(json.data);
        setAdminNote(json.data.admin_note ?? '');
      } else {
        setError('載入失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/v1/service-requests/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, admin_note: adminNote || undefined }),
      });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      if (json.success) {
        await fetchDetail();
      } else {
        setError(json.error?.message ?? '更新失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setUpdating(false);
    }
  };

  const cancelRequest = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/v1/service-requests/${id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: adminNote || undefined }),
      });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      if (json.success) {
        await fetchDetail();
      } else {
        setError(json.error?.message ?? '取消失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">載入中...</div>;
  if (error && !request) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">
          返回列表
        </button>
      </div>
    );
  }
  if (!request) return null;

  const statusInfo = STATUS_LABELS[request.status] ?? {
    label: request.status,
    color: 'bg-gray-100 text-gray-600',
  };

  // Actions available based on current status
  const canScreening = request.status === 'submitted';
  const canReturnToSubmitted = request.status === 'screening';
  const canCancel = !['completed', 'cancelled'].includes(request.status);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/service-requests" className="text-blue-600 hover:underline">
          &larr; 返回列表
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">需求單詳情</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">基本資訊</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">服務類別</dt>
              <dd className="font-medium text-gray-900">{request.category.name}</dd>
            </div>
            <div>
              <dt className="text-gray-500">被照護者</dt>
              <dd className="font-medium text-gray-900">{request.recipient.name}</dd>
            </div>
            <div>
              <dt className="text-gray-500">期望日期</dt>
              <dd className="text-gray-900">
                {new Date(request.preferred_date).toLocaleDateString('zh-TW')}
                {request.preferred_time_slot && ` ${TIME_SLOT_LABELS[request.preferred_time_slot] ?? request.preferred_time_slot}`}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">服務地點</dt>
              <dd className="text-gray-900">{request.location}</dd>
            </div>
            <div>
              <dt className="text-gray-500">需求描述</dt>
              <dd className="whitespace-pre-wrap text-gray-900">{request.description}</dd>
            </div>
            <div>
              <dt className="text-gray-500">建立時間</dt>
              <dd className="text-gray-900">
                {new Date(request.created_at).toLocaleString('zh-TW')}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-6">
          {request.assigned_provider && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">指派服務者</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">姓名</dt>
                  <dd className="text-gray-900">{request.assigned_provider.name}</dd>
                </div>
                {request.assigned_provider.phone && (
                  <div>
                    <dt className="text-gray-500">電話</dt>
                    <dd className="text-gray-900">{request.assigned_provider.phone}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">狀態操作</h2>
            <div className="mb-4">
              <label className="mb-1 block text-sm text-gray-600">管理員備註</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                rows={3}
                placeholder="選填備註..."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {canScreening && (
                <button
                  disabled={updating}
                  onClick={() => void updateStatus('screening')}
                  className="rounded bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
                >
                  開始審核
                </button>
              )}
              {canReturnToSubmitted && (
                <button
                  disabled={updating}
                  onClick={() => void updateStatus('submitted')}
                  className="rounded bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  退回重審
                </button>
              )}
              {canCancel && (
                <button
                  disabled={updating}
                  onClick={() => void cancelRequest()}
                  className="rounded bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  取消需求
                </button>
              )}
              {!canScreening && !canReturnToSubmitted && !canCancel && (
                <p className="text-sm text-gray-500">此狀態無可用操作</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
