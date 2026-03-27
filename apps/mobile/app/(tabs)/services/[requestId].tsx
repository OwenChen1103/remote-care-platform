import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';

interface ServiceRequestDetail {
  id: string;
  status: string;
  preferred_date: string;
  preferred_time_slot: string | null;
  location: string;
  description: string;
  admin_note: string | null;
  provider_note: string | null;
  caregiver_confirmed_at: string | null;
  provider_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
  assigned_provider: ProviderInfo | null;
  candidate_provider: ProviderInfo | null;
  provider_report: Record<string, unknown> | null;
}

interface ProviderInfo {
  id: string;
  name: string;
  phone: string | null;
  photo_url: string | null;
  level: string;
  specialties: string[];
  certifications: string[];
  experience_years: number | null;
  service_areas: string[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: '已送出', color: '#1D4ED8', bg: '#DBEAFE' },
  screening: { label: '審核中', color: '#A16207', bg: '#FEF9C3' },
  candidate_proposed: { label: '已推薦', color: '#7C3AED', bg: '#EDE9FE' },
  caregiver_confirmed: { label: '家屬確認', color: '#4338CA', bg: '#E0E7FF' },
  provider_confirmed: { label: '服務者確認', color: '#0F766E', bg: '#CCFBF1' },
  arranged: { label: '已安排', color: '#0E7490', bg: '#CFFAFE' },
  in_service: { label: '服務中', color: '#C2410C', bg: '#FFEDD5' },
  completed: { label: '已完成', color: '#15803D', bg: '#DCFCE7' },
  cancelled: { label: '已取消', color: '#6B7280', bg: '#F3F4F6' },
};

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

const CANCELLABLE = [
  'submitted',
  'screening',
  'candidate_proposed',
  'caregiver_confirmed',
  'provider_confirmed',
  'arranged',
  'in_service',
];

export default function ServiceRequestDetailScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ServiceRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<ServiceRequestDetail>(`/service-requests/${requestId}`);
      setRequest(result);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleCancel = () => {
    Alert.alert('確認取消', '確定要取消此服務需求嗎？', [
      { text: '返回', style: 'cancel' },
      {
        text: '確定取消',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await api.put(`/service-requests/${requestId}/cancel`, {});
            await fetchDetail();
          } catch (e) {
            if (e instanceof ApiError) Alert.alert('錯誤', e.message);
            else Alert.alert('錯誤', '取消失敗');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleCaregiverConfirm = (confirm: boolean) => {
    const title = confirm ? '確認候選服務人員' : '拒絕候選服務人員';
    const message = confirm
      ? `確定同意「${request?.candidate_provider?.name}」為您服務嗎？`
      : '確定拒絕候選人嗎？系統將重新為您媒合。';
    Alert.alert(title, message, [
      { text: '返回', style: 'cancel' },
      {
        text: confirm ? '確認同意' : '確定拒絕',
        style: confirm ? 'default' : 'destructive',
        onPress: async () => {
          setConfirming(true);
          try {
            await api.put(`/service-requests/${requestId}/confirm-caregiver`, { confirm });
            await fetchDetail();
          } catch (e) {
            if (e instanceof ApiError) Alert.alert('錯誤', e.message);
            else Alert.alert('錯誤', '操作失敗');
          } finally {
            setConfirming(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;
  }

  if (error || !request) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || '載入失敗'}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.linkText}>返回列表</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = STATUS_CONFIG[request.status] ?? {
    label: request.status,
    color: '#6B7280',
    bg: '#F3F4F6',
  };
  const canCancel = CANCELLABLE.includes(request.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status Badge */}
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        <Text style={styles.dateText}>
          {new Date(request.created_at).toLocaleDateString('zh-TW')}
        </Text>
      </View>

      {/* Status Timeline */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>進度時間軸</Text>
        <StatusTimeline request={request} />
      </View>

      {/* Category & Recipient */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>服務資訊</Text>
        <InfoRow label="服務類別" value={request.category.name} />
        <InfoRow label="被照護者" value={request.recipient.name} />
        <InfoRow
          label="期望日期"
          value={`${new Date(request.preferred_date).toLocaleDateString('zh-TW')}${
            request.preferred_time_slot
              ? ` ${TIME_SLOT_LABELS[request.preferred_time_slot] ?? request.preferred_time_slot}`
              : ''
          }`}
        />
        <InfoRow label="服務地點" value={request.location} />
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>需求描述</Text>
        <Text style={styles.descriptionText}>{request.description}</Text>
      </View>

      {/* Provider Info */}
      {request.assigned_provider && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>指派服務者</Text>
          <ProviderCard provider={request.assigned_provider} />
        </View>
      )}

      {/* Candidate Provider - confirm/reject (caregiver) */}
      {request.candidate_provider && request.status === 'candidate_proposed' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>候選服務人員</Text>
          <ProviderCard provider={request.candidate_provider} />
          <View style={styles.confirmButtons}>
            <TouchableOpacity
              style={[styles.confirmButton, confirming && styles.cancelButtonDisabled]}
              onPress={() => handleCaregiverConfirm(true)}
              disabled={confirming}
            >
              <Text style={styles.confirmButtonText}>
                {confirming ? '處理中...' : '同意候選'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectButton, confirming && styles.cancelButtonDisabled]}
              onPress={() => handleCaregiverConfirm(false)}
              disabled={confirming}
            >
              <Text style={styles.rejectButtonText}>拒絕候選</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Candidate Provider info (after confirmation, non-actionable) */}
      {request.candidate_provider && request.status !== 'candidate_proposed' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>候選服務人員</Text>
          <ProviderCard provider={request.candidate_provider} />
        </View>
      )}

      {/* Notes */}
      {request.admin_note && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>管理員備註</Text>
          <Text style={styles.noteText}>{request.admin_note}</Text>
        </View>
      )}

      {/* Cancel Button */}
      {canCancel && (
        <TouchableOpacity
          style={[styles.cancelButton, cancelling && styles.cancelButtonDisabled]}
          onPress={handleCancel}
          disabled={cancelling}
        >
          <Text style={styles.cancelButtonText}>
            {cancelling ? '處理中...' : '取消此需求'}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ─── Timeline ─────────────────────────────────────────────────

const TIMELINE_STEPS = [
  'submitted', 'screening', 'candidate_proposed',
  'caregiver_confirmed', 'provider_confirmed',
  'arranged', 'in_service', 'completed',
] as const;

function StatusTimeline({ request }: { request: ServiceRequestDetail }) {
  const currentIdx = TIMELINE_STEPS.indexOf(
    request.status as typeof TIMELINE_STEPS[number],
  );
  const isCancelled = request.status === 'cancelled';

  // Build time map from available timestamps
  const timeMap: Record<string, string | null> = {
    submitted: request.created_at,
    caregiver_confirmed: request.caregiver_confirmed_at,
    provider_confirmed: request.provider_confirmed_at,
  };

  return (
    <View>
      {TIMELINE_STEPS.map((step, idx) => {
        const cfg = STATUS_CONFIG[step] ?? { label: step, color: '#6B7280', bg: '#F3F4F6' };
        const isPast = !isCancelled && idx <= currentIdx;
        const isCurrent = !isCancelled && idx === currentIdx;
        const timestamp = timeMap[step];
        const isLast = idx === TIMELINE_STEPS.length - 1;

        return (
          <View key={step} style={styles.timelineRow}>
            {/* Vertical line + dot */}
            <View style={styles.timelineLeft}>
              <View style={[
                styles.timelineDot,
                isPast
                  ? { backgroundColor: cfg.color }
                  : { backgroundColor: '#E5E7EB' },
                isCurrent && { borderWidth: 2, borderColor: cfg.color, backgroundColor: '#FFFFFF' },
              ]} />
              {!isLast && (
                <View style={[
                  styles.timelineLine,
                  isPast ? { backgroundColor: cfg.color } : { backgroundColor: '#E5E7EB' },
                ]} />
              )}
            </View>
            {/* Label + time */}
            <View style={styles.timelineContent}>
              <Text style={[
                styles.timelineLabel,
                isPast ? { color: '#111827', fontWeight: '600' } : { color: '#9CA3AF' },
              ]}>
                {cfg.label}
              </Text>
              {timestamp && (
                <Text style={styles.timelineTime}>
                  {new Date(timestamp).toLocaleString('zh-TW')}
                </Text>
              )}
            </View>
          </View>
        );
      })}
      {isCancelled && (
        <View style={styles.timelineRow}>
          <View style={styles.timelineLeft}>
            <View style={[styles.timelineDot, { backgroundColor: STATUS_CONFIG.cancelled?.color ?? '#DC2626' }]} />
          </View>
          <View style={styles.timelineContent}>
            <Text style={[styles.timelineLabel, { color: '#DC2626', fontWeight: '600' }]}>
              已取消
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Provider Card ────────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = { L1: '初級', L2: '中級', L3: '資深' };

function ProviderCard({ provider }: { provider: ProviderInfo }) {
  return (
    <View>
      {/* Photo + Name row */}
      <View style={styles.providerPhotoRow}>
        {provider.photo_url ? (
          <Image source={{ uri: provider.photo_url }} style={styles.providerPhoto} />
        ) : (
          <View style={styles.providerPhotoFallback}>
            <Text style={styles.providerPhotoInitial}>{provider.name.charAt(0)}</Text>
          </View>
        )}
        <View style={styles.providerPhotoInfo}>
          <Text style={styles.providerPhotoName}>{provider.name}</Text>
          <Text style={styles.providerPhotoLevel}>{provider.level}（{LEVEL_LABELS[provider.level] ?? provider.level}）</Text>
        </View>
      </View>
      {provider.phone && <InfoRow label="電話" value={provider.phone} />}
      {provider.experience_years != null && (
        <InfoRow label="年資" value={`${provider.experience_years} 年`} />
      )}
      {((provider.specialties ?? []) as string[]).length > 0 && (
        <InfoRow label="專業" value={((provider.specialties ?? []) as string[]).join('、')} />
      )}
      {((provider.certifications ?? []) as string[]).length > 0 && (
        <InfoRow label="證照" value={((provider.certifications ?? []) as string[]).join('、')} />
      )}
      {((provider.service_areas ?? []) as string[]).length > 0 && (
        <InfoRow label="服務區域" value={((provider.service_areas ?? []) as string[]).join('、')} />
      )}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40 },
  loader: { flex: 1, justifyContent: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#DC2626', fontSize: 14, marginBottom: 12 },
  linkText: { color: '#2563EB', fontSize: 14, textDecorationLine: 'underline' },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4 },
  statusText: { fontSize: 14, fontWeight: '600' },
  dateText: { fontSize: 13, color: '#9CA3AF' },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: '500', maxWidth: '60%' as unknown as number, textAlign: 'right' },
  descriptionText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  noteText: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  cancelButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonDisabled: { opacity: 0.6 },
  cancelButtonText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
  // ─── Provider Photo ──────────────────────────────────────
  providerPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  providerPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
  },
  providerPhotoFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerPhotoInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  providerPhotoInfo: { flex: 1 },
  providerPhotoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  providerPhotoLevel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  // ─── Timeline ────────────────────────────────────────────
  timelineRow: {
    flexDirection: 'row',
    minHeight: 40,
  },
  timelineLeft: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
    marginBottom: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 12,
  },
  timelineLabel: {
    fontSize: 14,
  },
  timelineTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },

  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: { color: '#15803D', fontSize: 15, fontWeight: '600' },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  rejectButtonText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
});
