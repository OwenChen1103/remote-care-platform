'use client';

import { useState, useEffect, useCallback } from 'react';

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PreviewData {
  user: { id: string; name: string; email: string; role: string; phone: string | null };
  // Caregiver
  recipients?: { id: string; name: string; date_of_birth: string | null; medical_tags: string[] }[];
  recent_requests?: { id: string; status: string; category_name: string; recipient_name: string; created_at: string }[];
  // Patient
  recipient?: { id: string; name: string; date_of_birth: string | null; medical_tags: string[] } | null;
  recent_measurements?: { id: string; type: string; systolic: number | null; diastolic: number | null; glucose_value: number | null; is_abnormal: boolean; measured_at: string }[];
  // Provider
  provider?: { id: string; name: string; level: string; review_status: string; specialties: string[]; certifications: string[]; availability_status: string } | null;
  recent_tasks?: { id: string; status: string; category_name: string; recipient_name: string; created_at: string }[];
}

const ROLE_LABELS: Record<string, string> = {
  caregiver: '委託人',
  patient: '被照護者',
  provider: '服務人員',
};

const STATUS_LABELS: Record<string, string> = {
  submitted: '已送出', screening: '審核中', candidate_proposed: '已推薦',
  caregiver_confirmed: '家屬確認', provider_confirmed: '服務者確認',
  arranged: '已安排', in_service: '服務中', completed: '已完成', cancelled: '已取消',
};

export default function AdminPreviewPage() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/preview');
      const json = (await res.json()) as { success: boolean; data: { users: UserOption[] } };
      if (json.success) setUsers(json.data.users);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  const fetchPreview = useCallback(async (userId: string) => {
    setLoading(true);
    setPreview(null);
    try {
      const res = await fetch(`/api/v1/admin/preview?user_id=${userId}`);
      const json = (await res.json()) as { success: boolean; data: PreviewData };
      if (json.success) setPreview(json.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const filteredUsers = selectedRole
    ? users.filter((u) => u.role === selectedRole)
    : users;

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    if (userId) void fetchPreview(userId);
    else setPreview(null);
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">角色資料預覽</h1>
      <p className="mb-6 text-sm text-gray-500">以管理員身份查看各角色帳號的核心資料（唯讀）。</p>

      {/* Selector */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-sm text-gray-600">角色篩選</label>
          <select
            value={selectedRole}
            onChange={(e) => { setSelectedRole(e.target.value); setSelectedUserId(''); setPreview(null); }}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">全部角色</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">選擇帳號</label>
          <select
            value={selectedUserId}
            onChange={(e) => handleUserSelect(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">— 選擇帳號 —</option>
            {filteredUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}（{ROLE_LABELS[u.role] ?? u.role}）{u.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && <div className="text-sm text-gray-400">載入中...</div>}

      {/* Preview Content */}
      {preview && (
        <div className="space-y-6">
          {/* User Info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">帳號資訊</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <div><dt className="text-gray-500">姓名</dt><dd className="font-medium text-gray-900">{preview.user.name}</dd></div>
              <div><dt className="text-gray-500">Email</dt><dd className="text-gray-900">{preview.user.email}</dd></div>
              <div><dt className="text-gray-500">角色</dt><dd className="text-gray-900">{ROLE_LABELS[preview.user.role] ?? preview.user.role}</dd></div>
              <div><dt className="text-gray-500">電話</dt><dd className="text-gray-900">{preview.user.phone ?? '-'}</dd></div>
            </dl>
          </div>

          {/* Caregiver Preview */}
          {preview.recipients && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">
                被照護者（{preview.recipients.length} 位）
              </h2>
              {preview.recipients.length === 0 ? (
                <p className="text-sm text-gray-400">尚無被照護者</p>
              ) : (
                <div className="space-y-3">
                  {preview.recipients.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 rounded bg-gray-50 px-4 py-3">
                      <span className="font-medium text-gray-900">{r.name}</span>
                      {r.date_of_birth && <span className="text-xs text-gray-500">{r.date_of_birth}</span>}
                      {((r.medical_tags ?? []) as string[]).map((t) => (
                        <span key={t} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{t}</span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {preview.recent_requests && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">近期服務需求</h2>
              {preview.recent_requests.length === 0 ? (
                <p className="text-sm text-gray-400">尚無需求單</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-gray-500">
                    <th className="pb-2">類別</th><th className="pb-2">被照護者</th>
                    <th className="pb-2">狀態</th><th className="pb-2">建立時間</th>
                  </tr></thead>
                  <tbody>
                    {preview.recent_requests.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="py-2 font-medium text-gray-900">{r.category_name}</td>
                        <td className="py-2 text-gray-600">{r.recipient_name}</td>
                        <td className="py-2">{STATUS_LABELS[r.status] ?? r.status}</td>
                        <td className="py-2 text-gray-400">{new Date(r.created_at).toLocaleDateString('zh-TW')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Patient Preview */}
          {preview.user.role === 'patient' && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">綁定的被照護者</h2>
              {preview.recipient ? (
                <div className="flex items-center gap-3 rounded bg-gray-50 px-4 py-3">
                  <span className="font-medium text-gray-900">{preview.recipient.name}</span>
                  {preview.recipient.date_of_birth && <span className="text-xs text-gray-500">{preview.recipient.date_of_birth}</span>}
                  {((preview.recipient.medical_tags ?? []) as string[]).map((t) => (
                    <span key={t} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{t}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">尚未綁定</p>
              )}
            </div>
          )}

          {preview.recent_measurements && preview.recent_measurements.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">近期量測</h2>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-gray-500">
                  <th className="pb-2">類型</th><th className="pb-2">數值</th>
                  <th className="pb-2">異常</th><th className="pb-2">時間</th>
                </tr></thead>
                <tbody>
                  {preview.recent_measurements.map((m) => (
                    <tr key={m.id} className="border-b border-gray-100">
                      <td className="py-2">{m.type === 'blood_pressure' ? '血壓' : '血糖'}</td>
                      <td className="py-2 font-medium">
                        {m.type === 'blood_pressure' ? `${m.systolic}/${m.diastolic} mmHg` : `${m.glucose_value} mg/dL`}
                      </td>
                      <td className="py-2">{m.is_abnormal ? <span className="text-red-600">異常</span> : '正常'}</td>
                      <td className="py-2 text-gray-400">{new Date(m.measured_at).toLocaleDateString('zh-TW')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Provider Preview */}
          {preview.provider && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">服務人員資料</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <div><dt className="text-gray-500">等級</dt><dd className="text-gray-900">{preview.provider.level}</dd></div>
                <div><dt className="text-gray-500">審核狀態</dt><dd className="text-gray-900">{preview.provider.review_status}</dd></div>
                <div><dt className="text-gray-500">接案狀態</dt><dd className="text-gray-900">{preview.provider.availability_status}</dd></div>
              </dl>
              {((preview.provider.specialties ?? []) as string[]).length > 0 && (
                <div className="mt-3">
                  <span className="text-sm text-gray-500">專業：</span>
                  {((preview.provider.specialties ?? []) as string[]).map((s) => (
                    <span key={s} className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{s}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {preview.recent_tasks && preview.recent_tasks.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">近期任務</h2>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-gray-500">
                  <th className="pb-2">類別</th><th className="pb-2">被照護者</th>
                  <th className="pb-2">狀態</th><th className="pb-2">建立時間</th>
                </tr></thead>
                <tbody>
                  {preview.recent_tasks.map((t) => (
                    <tr key={t.id} className="border-b border-gray-100">
                      <td className="py-2 font-medium text-gray-900">{t.category_name}</td>
                      <td className="py-2 text-gray-600">{t.recipient_name}</td>
                      <td className="py-2">{STATUS_LABELS[t.status] ?? t.status}</td>
                      <td className="py-2 text-gray-400">{new Date(t.created_at).toLocaleDateString('zh-TW')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
