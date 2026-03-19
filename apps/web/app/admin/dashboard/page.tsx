'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface DashboardStats {
  total_caregivers: number;
  total_recipients: number;
  total_measurements_today: number;
  pending_service_requests: number;
  pending_provider_reviews: number;
  abnormal_alerts_today: number;
}

interface PendingRequest {
  id: string;
  category_name: string;
  recipient_name: string;
  preferred_date: string;
  created_at: string;
}

interface AbnormalAlert {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

interface DashboardData {
  stats: DashboardStats;
  recent_pending_requests: PendingRequest[];
  recent_abnormal_alerts: AbnormalAlert[];
}

const STAT_CARDS: { key: keyof DashboardStats; label: string; color: string }[] = [
  { key: 'total_caregivers', label: '委託人數', color: 'text-blue-600' },
  { key: 'total_recipients', label: '被照護者數', color: 'text-green-600' },
  { key: 'total_measurements_today', label: '今日量測數', color: 'text-teal-600' },
  { key: 'pending_service_requests', label: '待處理需求單', color: 'text-orange-600' },
  { key: 'pending_provider_reviews', label: '待審核服務人員', color: 'text-purple-600' },
  { key: 'abnormal_alerts_today', label: '今日異常通知', color: 'text-red-600' },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/admin/dashboard');
      const json = (await res.json()) as { success: boolean; data: DashboardData; error?: { message: string } };
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message ?? '載入失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-6">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="mt-3 h-8 w-16 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
        <button
          onClick={() => void fetchDashboard()}
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          重試
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STAT_CARDS.map((card) => (
          <div key={card.key} className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.color}`}>
              {data.stats[card.key]}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Lists */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Pending Requests */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">待處理需求單</h2>
            <Link href="/admin/service-requests" className="text-sm text-blue-600 hover:underline">
              查看全部
            </Link>
          </div>
          {data.recent_pending_requests.length === 0 ? (
            <p className="text-sm text-gray-400">目前沒有待處理的需求單</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.recent_pending_requests.map((req) => (
                <li key={req.id}>
                  <Link
                    href={`/admin/service-requests/${req.id}`}
                    className="block py-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {req.category_name}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          {req.recipient_name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(req.preferred_date).toLocaleDateString('zh-TW')}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Abnormal Alerts */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">異常通知</h2>
          </div>
          {data.recent_abnormal_alerts.length === 0 ? (
            <p className="text-sm text-gray-400">目前沒有異常通知</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.recent_abnormal_alerts.map((alert) => (
                <li key={alert.id} className="py-3">
                  <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(alert.created_at).toLocaleString('zh-TW')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
