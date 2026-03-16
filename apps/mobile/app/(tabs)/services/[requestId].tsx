import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
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
  created_at: string;
  updated_at: string;
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
  assigned_provider: { id: string; name: string; phone: string | null } | null;
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
          <InfoRow label="姓名" value={request.assigned_provider.name} />
          {request.assigned_provider.phone && (
            <InfoRow label="電話" value={request.assigned_provider.phone} />
          )}
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
});
