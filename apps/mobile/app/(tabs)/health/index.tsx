import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';

interface Recipient {
  id: string;
  name: string;
}

interface Measurement {
  id: string;
  type: string;
  systolic: number | null;
  diastolic: number | null;
  glucose_value: number | null;
  glucose_timing: string | null;
  is_abnormal: boolean;
  measured_at: string;
}

export default function HealthScreen() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRecipients = useCallback(async () => {
    try {
      const result = await api.get<Recipient[]>('/recipients');
      setRecipients(result);
      const first = result[0];
      if (first && !selectedRecipientId) {
        setSelectedRecipientId(first.id);
      }
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗，請稍後再試');
    }
  }, [selectedRecipientId]);

  const fetchMeasurements = useCallback(async () => {
    if (!selectedRecipientId) return;
    setLoading(true);
    try {
      const result = await api.get<Measurement[]>(
        `/measurements?recipient_id=${selectedRecipientId}&limit=10`,
      );
      setMeasurements(result);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [selectedRecipientId]);

  useEffect(() => {
    void fetchRecipients();
  }, [fetchRecipients]);

  useEffect(() => {
    void fetchMeasurements();
  }, [fetchMeasurements]);

  const selectedName = recipients.find((r) => r.id === selectedRecipientId)?.name ?? '';

  if (error && recipients.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Recipient selector */}
      {recipients.length > 1 && (
        <FlatList
          horizontal
          data={recipients}
          keyExtractor={(item) => item.id}
          style={styles.selectorList}
          contentContainerStyle={styles.selectorContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.selectorChip, item.id === selectedRecipientId && styles.selectorChipActive]}
              onPress={() => setSelectedRecipientId(item.id)}
            >
              <Text style={[styles.selectorText, item.id === selectedRecipientId && styles.selectorTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {selectedName ? (
        <Text style={styles.title}>{selectedName} 的健康紀錄</Text>
      ) : null}

      {/* Quick actions */}
      {selectedRecipientId && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${selectedRecipientId}&type=blood_pressure`)}
          >
            <Text style={styles.actionText}>記錄血壓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${selectedRecipientId}&type=blood_glucose`)}
          >
            <Text style={styles.actionText}>記錄血糖</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/(tabs)/health/trends?recipientId=${selectedRecipientId}`)}
          >
            <Text style={styles.actionText}>看趨勢</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/health/export')}
          >
            <Text style={styles.actionText}>匯出</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recent measurements */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : measurements.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>尚無量測資料，請先記錄健康數據。</Text>
        </View>
      ) : (
        <FlatList
          data={measurements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.card, item.is_abnormal && styles.cardAbnormal]}>
              <View style={styles.cardRow}>
                <Text style={styles.cardType}>
                  {item.type === 'blood_pressure' ? '血壓' : '血糖'}
                </Text>
                {item.is_abnormal && <Text style={styles.abnormalBadge}>異常</Text>}
              </View>
              <Text style={styles.cardValue}>
                {item.type === 'blood_pressure'
                  ? `${item.systolic}/${item.diastolic} mmHg`
                  : `${item.glucose_value} mg/dL (${formatTiming(item.glucose_timing)})`}
              </Text>
              <Text style={styles.cardTime}>
                {new Date(item.measured_at).toLocaleString('zh-TW')}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

function formatTiming(timing: string | null): string {
  switch (timing) {
    case 'before_meal': return '餐前';
    case 'after_meal': return '餐後';
    case 'fasting': return '空腹';
    case 'random': return '隨機';
    default: return '';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 18, fontWeight: '600', color: '#1f2937', paddingHorizontal: 16, paddingTop: 12 },
  selectorList: { maxHeight: 50 },
  selectorContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  selectorChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  selectorChipActive: { backgroundColor: '#3b82f6' },
  selectorText: { fontSize: 14, color: '#374151' },
  selectorTextActive: { color: '#fff', fontWeight: '600' },
  actionsRow: { flexDirection: 'row', padding: 12, gap: 8 },
  actionButton: {
    flex: 1,
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionText: { fontSize: 14, fontWeight: '600', color: '#1d4ed8' },
  list: { padding: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardAbnormal: { borderLeftColor: '#dc2626' },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardType: { fontSize: 14, fontWeight: '600', color: '#374151' },
  abnormalBadge: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardValue: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 2 },
  cardTime: { fontSize: 12, color: '#6b7280' },
  emptyText: { fontSize: 16, color: '#9ca3af', textAlign: 'center' },
  errorText: { fontSize: 14, color: '#dc2626', backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, textAlign: 'center', overflow: 'hidden' },
});
