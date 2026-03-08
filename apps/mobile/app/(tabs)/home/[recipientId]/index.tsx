import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';

interface RecentMeasurement {
  id: string;
  type: string;
  systolic: number | null;
  diastolic: number | null;
  glucose_value: number | null;
  glucose_timing: string | null;
  is_abnormal: boolean;
  measured_at: string;
}

interface Recipient {
  id: string;
  caregiver_id: string;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
  medical_tags: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function formatGender(g: string | null): string {
  if (g === 'male') return '男';
  if (g === 'female') return '女';
  if (g === 'other') return '其他';
  return '-';
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export default function RecipientDetailScreen() {
  const { recipientId } = useLocalSearchParams<{ recipientId: string }>();
  const router = useRouter();
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [recentMeasurements, setRecentMeasurements] = useState<RecentMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRecipient = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<Recipient>(`/recipients/${recipientId}`);
      setRecipient(data);
      // Fetch recent measurements (best-effort, don't block on failure)
      try {
        const measurements = await api.get<RecentMeasurement[]>(
          `/measurements?recipient_id=${recipientId}&limit=5`,
        );
        setRecentMeasurements(measurements);
      } catch {
        // Non-critical — don't block detail view
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('載入失敗，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  }, [recipientId]);

  useEffect(() => {
    void fetchRecipient();
  }, [fetchRecipient]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (error || !recipient) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || '找不到此被照護者'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void fetchRecipient()}>
          <Text style={styles.retryText}>重試</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.name}>{recipient.name}</Text>
        {recipient.date_of_birth && (
          <Text style={styles.age}>{calculateAge(recipient.date_of_birth)} 歲</Text>
        )}
      </View>

      {recipient.medical_tags.length > 0 && (
        <View style={styles.tagsRow}>
          {recipient.medical_tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>性別</Text>
        <Text style={styles.value}>{formatGender(recipient.gender)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>生日</Text>
        <Text style={styles.value}>{recipient.date_of_birth ?? '-'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>緊急聯絡人</Text>
        <Text style={styles.value}>
          {recipient.emergency_contact_name ?? '-'}
          {recipient.emergency_contact_phone ? `  ${recipient.emergency_contact_phone}` : ''}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>備註</Text>
        <Text style={styles.value}>{recipient.notes ?? '-'}</Text>
      </View>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickButton}
          onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${recipientId}&type=blood_pressure`)}
        >
          <Text style={styles.quickButtonText}>記錄血壓</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickButton}
          onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${recipientId}&type=blood_glucose`)}
        >
          <Text style={styles.quickButtonText}>記錄血糖</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickButton}
          onPress={() => router.push(`/(tabs)/health/trends?recipientId=${recipientId}`)}
        >
          <Text style={styles.quickButtonText}>看趨勢</Text>
        </TouchableOpacity>
      </View>

      {/* Recent measurements */}
      {recentMeasurements.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>最近量測</Text>
          {recentMeasurements.map((m) => (
            <View key={m.id} style={[styles.measurementRow, m.is_abnormal && styles.measurementAbnormal]}>
              <Text style={styles.measurementType}>
                {m.type === 'blood_pressure' ? '血壓' : '血糖'}
              </Text>
              <Text style={styles.measurementValue}>
                {m.type === 'blood_pressure'
                  ? `${m.systolic}/${m.diastolic}`
                  : `${m.glucose_value}`}
              </Text>
              {m.is_abnormal && <Text style={styles.abnormalBadge}>異常</Text>}
              <Text style={styles.measurementTime}>
                {new Date(m.measured_at).toLocaleDateString('zh-TW')}
              </Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.editButton}
        onPress={() => router.push(`/(tabs)/home/${recipientId}/edit`)}
      >
        <Text style={styles.editButtonText}>編輯</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  name: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  age: { fontSize: 16, color: '#6b7280', marginLeft: 10 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  tag: { backgroundColor: '#dbeafe', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 13, color: '#1d4ed8' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  label: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  value: { fontSize: 16, color: '#1f2937' },
  quickActions: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 },
  quickButton: {
    flex: 1, backgroundColor: '#dbeafe', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  quickButtonText: { fontSize: 14, fontWeight: '600', color: '#1d4ed8' },
  recentSection: { marginTop: 8, marginBottom: 8 },
  recentTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 },
  measurementRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 8, padding: 10, marginBottom: 4,
  },
  measurementAbnormal: { borderLeftWidth: 3, borderLeftColor: '#dc2626' },
  measurementType: { fontSize: 13, color: '#6b7280', width: 36 },
  measurementValue: { fontSize: 15, fontWeight: '600', color: '#1f2937', flex: 1 },
  abnormalBadge: {
    fontSize: 11, fontWeight: '600', color: '#dc2626',
    backgroundColor: '#fef2f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  measurementTime: { fontSize: 12, color: '#9ca3af' },
  editButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  editButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { fontSize: 16, color: '#dc2626', marginBottom: 12 },
  retryButton: { backgroundColor: '#3b82f6', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
});
