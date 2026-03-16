import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
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
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

export default function ProviderConfirmScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ServiceRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [providerNote, setProviderNote] = useState('');

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

  const handleConfirm = (confirm: boolean) => {
    const title = confirm ? '確認接案' : '拒絕接案';
    const message = confirm
      ? '確定接受此服務案件嗎？'
      : '確定拒絕嗎？案件將回到待媒合狀態。';
    Alert.alert(title, message, [
      { text: '返回', style: 'cancel' },
      {
        text: confirm ? '確認接案' : '確定拒絕',
        style: confirm ? 'default' : 'destructive',
        onPress: async () => {
          setConfirming(true);
          try {
            await api.put(`/service-requests/${requestId}/confirm-provider`, {
              confirm,
              provider_note: providerNote || undefined,
            });
            Alert.alert('完成', confirm ? '已確認接案' : '已拒絕接案', [
              { text: '確定', onPress: () => router.back() },
            ]);
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
          <Text style={styles.linkText}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canConfirm = request.status === 'caregiver_confirmed';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>案件資訊</Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>需求描述</Text>
        <Text style={styles.descriptionText}>{request.description}</Text>
      </View>

      {canConfirm && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>回覆備註（選填）</Text>
          <TextInput
            style={styles.noteInput}
            multiline
            numberOfLines={3}
            value={providerNote}
            onChangeText={setProviderNote}
            placeholder="填寫備註，例如預計到達時間..."
            placeholderTextColor="#9CA3AF"
          />
          <View style={styles.confirmButtons}>
            <TouchableOpacity
              style={[styles.confirmButton, confirming && styles.disabledButton]}
              onPress={() => handleConfirm(true)}
              disabled={confirming}
            >
              <Text style={styles.confirmButtonText}>
                {confirming ? '處理中...' : '確認接案'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectButton, confirming && styles.disabledButton]}
              onPress={() => handleConfirm(false)}
              disabled={confirming}
            >
              <Text style={styles.rejectButtonText}>拒絕接案</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!canConfirm && (
        <View style={styles.statusNote}>
          <Text style={styles.statusNoteText}>
            目前狀態不需要您的操作。
          </Text>
        </View>
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
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    maxWidth: '60%' as unknown as number,
    textAlign: 'right',
  },
  descriptionText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  noteInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 16,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
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
  disabledButton: { opacity: 0.6 },
  statusNote: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statusNoteText: { color: '#6B7280', fontSize: 14 },
});
