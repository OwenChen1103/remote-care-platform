import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  TextInput,
  Alert,
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

interface Reminder {
  id: string;
  recipient_id: string;
  reminder_type: string;
  reminder_time: string;
  is_enabled: boolean;
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
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [editingTime, setEditingTime] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRecipient = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<Recipient>(`/recipients/${recipientId}`);
      setRecipient(data);
      // Fetch recent measurements and reminders (best-effort, don't block on failure)
      try {
        const measurements = await api.get<RecentMeasurement[]>(
          `/measurements?recipient_id=${recipientId}&limit=5`,
        );
        setRecentMeasurements(measurements);
      } catch {
        // Non-critical — don't block detail view
      }
      try {
        const reminderData = await api.get<Reminder[]>(`/recipients/${recipientId}/reminders`);
        setReminders(reminderData);
      } catch {
        // Non-critical
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

  const toggleReminder = useCallback(async (type: string, enabled: boolean) => {
    try {
      const updated = await api.put<Reminder>(`/recipients/${recipientId}/reminders/${type}`, { is_enabled: enabled });
      setReminders((prev) => prev.map((r) => (r.reminder_type === type ? updated : r)));
    } catch {
      Alert.alert('更新失敗', '無法更新提醒設定，請稍後再試');
    }
  }, [recipientId]);

  const saveReminderTime = useCallback(async (type: string) => {
    const time = editingTime[type];
    if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      Alert.alert('格式錯誤', '時間格式須為 HH:mm（例如 08:00）');
      return;
    }
    try {
      const updated = await api.put<Reminder>(`/recipients/${recipientId}/reminders/${type}`, { reminder_time: time });
      setReminders((prev) => prev.map((r) => (r.reminder_type === type ? updated : r)));
      setEditingTime((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
    } catch {
      Alert.alert('更新失敗', '無法更新提醒時間，請稍後再試');
    }
  }, [recipientId, editingTime]);

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

      {/* Reminder settings */}
      {reminders.length > 0 && (
        <View style={styles.reminderSection}>
          <Text style={styles.recentTitle}>量測提醒</Text>
          {reminders.map((r) => {
            const label = r.reminder_type === 'morning' ? '早上提醒' : '晚上提醒';
            const isEditing = editingTime[r.reminder_type] !== undefined;
            return (
              <View key={r.reminder_type} style={styles.reminderCard}>
                <View style={styles.reminderRow}>
                  <Text style={styles.reminderLabel}>{label}</Text>
                  <Switch
                    value={r.is_enabled}
                    onValueChange={(val) => void toggleReminder(r.reminder_type, val)}
                    trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                    thumbColor={r.is_enabled ? '#3b82f6' : '#9ca3af'}
                  />
                </View>
                <View style={styles.reminderTimeRow}>
                  {isEditing ? (
                    <>
                      <TextInput
                        style={styles.timeInput}
                        value={editingTime[r.reminder_type]}
                        onChangeText={(text) => setEditingTime((prev) => ({ ...prev, [r.reminder_type]: text }))}
                        placeholder="HH:mm"
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                      <TouchableOpacity style={styles.timeSaveButton} onPress={() => void saveReminderTime(r.reminder_type)}>
                        <Text style={styles.timeSaveText}>儲存</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingTime((prev) => { const next = { ...prev }; delete next[r.reminder_type]; return next; })}>
                        <Text style={styles.timeCancelText}>取消</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity onPress={() => setEditingTime((prev) => ({ ...prev, [r.reminder_type]: r.reminder_time }))}>
                      <Text style={styles.reminderTime}>{r.reminder_time}</Text>
                      <Text style={styles.reminderTimeHint}>點擊修改時間</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
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
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  label: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  value: { fontSize: 16, color: '#1f2937' },
  quickActions: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 },
  quickButton: {
    flex: 1, backgroundColor: '#dbeafe', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  quickButtonText: { fontSize: 14, fontWeight: '600', color: '#1d4ed8' },
  recentSection: { marginTop: 8, marginBottom: 8 },
  recentTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 },
  measurementRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  measurementAbnormal: { borderLeftWidth: 3, borderLeftColor: '#dc2626' },
  measurementType: { fontSize: 13, color: '#6b7280', width: 36 },
  measurementValue: { fontSize: 15, fontWeight: '600', color: '#1f2937', flex: 1 },
  abnormalBadge: {
    fontSize: 11, fontWeight: '600', color: '#dc2626',
    backgroundColor: '#fef2f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  measurementTime: { fontSize: 12, color: '#9ca3af' },
  reminderSection: { marginTop: 16, marginBottom: 8 },
  reminderCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  reminderRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  reminderLabel: { fontSize: 15, fontWeight: '600' as const, color: '#374151' },
  reminderTimeRow: { marginTop: 8, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  reminderTime: { fontSize: 20, fontWeight: '700' as const, color: '#1f2937' },
  reminderTimeHint: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  timeInput: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, fontSize: 18, fontWeight: '600' as const,
    color: '#1f2937', width: 80, textAlign: 'center' as const,
  },
  timeSaveButton: { backgroundColor: '#3b82f6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  timeSaveText: { color: '#fff', fontSize: 14, fontWeight: '600' as const },
  timeCancelText: { color: '#6b7280', fontSize: 14 },
  editButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  editButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { fontSize: 14, color: '#dc2626', backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, textAlign: 'center', marginBottom: 12, overflow: 'hidden' },
  retryButton: { backgroundColor: '#3b82f6', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
});
