'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  Calendar,
  ClipboardList,
  Eye,
  Heart,
  Info,
  Mail,
  Phone,
  Stethoscope,
  User,
  UserCircle,
} from 'lucide-react';
import { PROVIDER_LEVEL_DISPLAY } from '@remote-care/shared';
import {
  Avatar,
  LoadingState,
  PageHeader,
  ProviderAvailabilityBadge,
  ProviderReviewStatusBadge,
  SectionCard,
  ServiceRequestStatusBadge,
} from '@/components/admin';

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PreviewData {
  user: { id: string; name: string; email: string; role: string; phone: string | null };
  recipients?: { id: string; name: string; date_of_birth: string | null; medical_tags: string[] }[];
  recent_requests?: { id: string; status: string; category_name: string; recipient_name: string; created_at: string }[];
  recipient?: { id: string; name: string; date_of_birth: string | null; medical_tags: string[] } | null;
  recent_measurements?: { id: string; type: string; systolic: number | null; diastolic: number | null; glucose_value: number | null; is_abnormal: boolean; measured_at: string }[];
  provider?: { id: string; name: string; level: string; review_status: string; specialties: string[]; certifications: string[]; availability_status: string } | null;
  recent_tasks?: { id: string; status: string; category_name: string; recipient_name: string; created_at: string }[];
}

const ROLE_LABELS: Record<string, string> = {
  caregiver: '委託人',
  patient: '被照護者',
  provider: '服務人員',
};

// Typed Record over the known role keys so noUncheckedIndexedAccess doesn't
// require optional-chaining at every lookup site.
const ROLE_CONFIG: Record<
  'caregiver' | 'patient' | 'provider',
  { Icon: React.ComponentType<{ className?: string }>; gradient: string }
> = {
  caregiver: { Icon: User,        gradient: 'from-brand-500 to-brand-400' },
  patient:   { Icon: Heart,       gradient: 'from-accent-500 to-accent-400' },
  provider:  { Icon: Stethoscope, gradient: 'from-brand-600 to-accent-500' },
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

  // Count users per role for the role-picker cards.
  const counts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    if (userId) void fetchPreview(userId);
    else setPreview(null);
  };

  return (
    <div>
      <PageHeader
        title="角色資料預覽"
        description="以管理員身份查看各角色帳號的核心資料（唯讀）"
      />

      {/* Slim privacy notice */}
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
        <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>提醒：每次預覽會記錄至審核日誌</span>
      </div>

      {/* Role picker — 3 prominent cards */}
      <section className="mb-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">選擇角色</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(['caregiver', 'patient', 'provider'] as const).map((role) => {
            const config = ROLE_CONFIG[role];
            const Icon = config.Icon;
            const active = selectedRole === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => {
                  setSelectedRole(active ? '' : role);
                  setSelectedUserId('');
                  setPreview(null);
                }}
                className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200 ${
                  active
                    ? `border-transparent bg-gradient-to-br ${config.gradient} text-white shadow-brand-md`
                    : 'border-outline bg-white hover:border-brand-200 hover:shadow-brand-low'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${active ? 'text-white/90' : 'text-ink-500'}`}>
                      {ROLE_LABELS[role]}
                    </p>
                    <p className={`mt-1 text-2xl font-bold ${active ? 'text-white' : 'text-ink-900'}`}>
                      {counts[role] ?? 0}
                      <span className={`ml-1 text-xs font-normal ${active ? 'text-white/80' : 'text-ink-500'}`}>位帳號</span>
                    </p>
                  </div>
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      active ? 'bg-white/20' : 'bg-brand-50 group-hover:bg-brand-100'
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${active ? 'text-white' : 'text-brand-600'}`} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Account picker — appears after role is chosen */}
      {selectedRole && (
        <section className="mb-6">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-500">
            選擇帳號
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => handleUserSelect(e.target.value)}
            className="block w-full max-w-md rounded-xl border border-outline bg-white px-3 py-2.5 text-sm shadow-brand-low focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="">— 選擇 {ROLE_LABELS[selectedRole]} 帳號 —</option>
            {filteredUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}（{u.email}）
              </option>
            ))}
          </select>
        </section>
      )}

      {loading && <LoadingState />}

      {preview && (
        <>
          {/* Currently-previewing banner */}
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4">
            <Avatar name={preview.user.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">正在預覽</p>
              <p className="text-base font-bold text-ink-900">
                {ROLE_LABELS[preview.user.role] ?? preview.user.role}：{preview.user.name}
              </p>
              <p className="text-sm text-ink-700">{preview.user.email}</p>
            </div>
            <Eye className="h-5 w-5 text-brand-500" aria-hidden="true" />
          </div>

          <div className="space-y-6">
            {/* Account meta */}
            <SectionCard icon={UserCircle} title="帳號資訊">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MetaField icon={User}  label="姓名" value={preview.user.name} />
                <MetaField icon={Mail}  label="Email" value={preview.user.email} />
                <MetaField icon={User}  label="角色" value={ROLE_LABELS[preview.user.role] ?? preview.user.role} />
                <MetaField icon={Phone} label="電話" value={preview.user.phone} />
              </dl>
            </SectionCard>

            {/* Caregiver */}
            {preview.recipients && (
              <SectionCard
                icon={Heart}
                title={`被照護者（${preview.recipients.length} 位）`}
              >
                {preview.recipients.length === 0 ? (
                  <p className="text-sm text-ink-500">尚無被照護者</p>
                ) : (
                  <ul className="space-y-2">
                    {preview.recipients.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 rounded-xl bg-surface-alt px-4 py-3">
                        <Avatar name={r.name} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-ink-900">{r.name}</p>
                          <p className="text-xs text-ink-500">
                            {r.date_of_birth ?? '生日未提供'}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          {(r.medical_tags ?? []).slice(0, 3).map((t) => (
                            <span key={t} className="inline-block rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                              {t}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            )}

            {preview.recent_requests && (
              <SectionCard icon={ClipboardList} title="近期服務需求">
                {preview.recent_requests.length === 0 ? (
                  <p className="text-sm text-ink-500">尚無需求單</p>
                ) : (
                  <ul className="space-y-2">
                    {preview.recent_requests.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 rounded-xl bg-surface-alt px-4 py-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                          <ClipboardList className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-ink-900">{r.category_name}</p>
                          <p className="text-xs text-ink-500">{r.recipient_name}</p>
                        </div>
                        <div className="text-right">
                          <ServiceRequestStatusBadge status={r.status} />
                          <p className="mt-1 text-xs text-ink-500">{new Date(r.created_at).toLocaleDateString('zh-TW')}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            )}

            {/* Patient */}
            {preview.user.role === 'patient' && (
              <SectionCard icon={Heart} title="綁定的被照護者">
                {preview.recipient ? (
                  <div className="flex items-center gap-3 rounded-xl bg-surface-alt px-4 py-3">
                    <Avatar name={preview.recipient.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink-900">{preview.recipient.name}</p>
                      <p className="text-xs text-ink-500">{preview.recipient.date_of_birth ?? '生日未提供'}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {(preview.recipient.medical_tags ?? []).map((t) => (
                        <span key={t} className="inline-block rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{t}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-ink-500">尚未綁定</p>
                )}
              </SectionCard>
            )}

            {preview.recent_measurements && preview.recent_measurements.length > 0 && (
              <SectionCard icon={Activity} title="近期量測">
                <ul className="space-y-2">
                  {preview.recent_measurements.map((m) => (
                    <li
                      key={m.id}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                        m.is_abnormal ? 'bg-danger-soft' : 'bg-surface-alt'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          m.is_abnormal ? 'bg-danger text-white' : 'bg-brand-100 text-brand-700'
                        }`}
                      >
                        {m.is_abnormal ? <AlertCircle className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink-900">
                          {m.type === 'blood_pressure' ? '血壓' : '血糖'}
                          <span className="ml-2 text-sm font-normal text-ink-700">
                            {m.type === 'blood_pressure'
                              ? `${m.systolic}/${m.diastolic} mmHg`
                              : `${m.glucose_value} mg/dL`}
                          </span>
                        </p>
                        <p className="text-xs text-ink-500 inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(m.measured_at).toLocaleDateString('zh-TW')}
                        </p>
                      </div>
                      {m.is_abnormal && (
                        <span className="rounded-md bg-danger px-2 py-0.5 text-xs font-medium text-white">異常</span>
                      )}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* Provider */}
            {preview.provider && (
              <SectionCard icon={Stethoscope} title="服務人員資料">
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <MetaField
                    icon={Stethoscope}
                    label="等級"
                    value={PROVIDER_LEVEL_DISPLAY[preview.provider.level]?.label ?? preview.provider.level}
                  />
                  <div>
                    <p className="text-xs font-medium text-ink-500">審核狀態</p>
                    <div className="mt-1"><ProviderReviewStatusBadge status={preview.provider.review_status} /></div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-ink-500">接案狀態</p>
                    <div className="mt-1"><ProviderAvailabilityBadge status={preview.provider.availability_status} /></div>
                  </div>
                </dl>
                {((preview.provider.specialties ?? []) as string[]).length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium text-ink-500">專業</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(preview.provider.specialties as string[]).map((s) => (
                        <span key={s} className="inline-block rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            )}

            {preview.recent_tasks && preview.recent_tasks.length > 0 && (
              <SectionCard icon={ClipboardList} title="近期任務">
                <ul className="space-y-2">
                  {preview.recent_tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 rounded-xl bg-surface-alt px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                        <ClipboardList className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink-900">{t.category_name}</p>
                        <p className="text-xs text-ink-500">{t.recipient_name}</p>
                      </div>
                      <div className="text-right">
                        <ServiceRequestStatusBadge status={t.status} />
                        <p className="mt-1 text-xs text-ink-500">{new Date(t.created_at).toLocaleDateString('zh-TW')}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MetaField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="inline-flex items-center gap-1 text-xs font-medium text-ink-500">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-sm text-ink-900">{value || <span className="text-ink-300">—</span>}</p>
    </div>
  );
}
