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

interface TaskDetail {
  id: string;
  status: string;
  preferred_date: string;
  preferred_time_slot: string | null;
  location: string;
  description: string;
  provider_note: string | null;
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

export default function ProviderTaskDetailScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [providerNote, setProviderNote] = useState('');

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<TaskDetail>(`/provider/tasks/${taskId}`);
      setTask(result);
      if (result.provider_note) setProviderNote(result.provider_note);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleProgress = (nextStatus: 'in_service' | 'completed') => {
    const isStart = nextStatus === 'in_service';
    const title = isStart ? '開始服務' : '完成服務';
    const message = isStart ? '確定要開始此服務嗎？' : '確定已完成此服務嗎？';

    Alert.alert(title, message, [
      { text: '返回', style: 'cancel' },
      {
        text: title,
        onPress: async () => {
          setSubmitting(true);
          try {
            await api.put(`/provider/tasks/${taskId}/progress`, {
              status: nextStatus,
              provider_note: providerNote || undefined,
            });
            Alert.alert('完成', isStart ? '已開始服務' : '服務已完成', [
              { text: '確定', onPress: () => void fetchDetail() },
            ]);
          } catch (e) {
            if (e instanceof ApiError) Alert.alert('錯誤', e.message);
            else Alert.alert('錯誤', '操作失敗');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;
  }

  if (error || !task) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || '載入失敗'}</Text>
        <TouchableOpacity onPress={() => void fetchDetail()}>
          <Text style={styles.linkText}>重試</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.linkText}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>案件資訊</Text>
        <InfoRow label="服務類別" value={task.category.name} />
        <InfoRow label="被照護者" value={task.recipient.name} />
        <InfoRow
          label="服務日期"
          value={`${new Date(task.preferred_date).toLocaleDateString('zh-TW')}${
            task.preferred_time_slot
              ? ` ${TIME_SLOT_LABELS[task.preferred_time_slot] ?? task.preferred_time_slot}`
              : ''
          }`}
        />
        <InfoRow label="服務地點" value={task.location} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>需求描述</Text>
        <Text style={styles.descriptionText}>{task.description}</Text>
      </View>

      {task.status === 'arranged' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>服務備註（選填）</Text>
          <TextInput
            style={styles.noteInput}
            multiline
            numberOfLines={3}
            value={providerNote}
            onChangeText={setProviderNote}
            placeholder="填寫備註..."
            placeholderTextColor="#9CA3AF"
          />
          <TouchableOpacity
            style={[styles.startButton, submitting && styles.disabledButton]}
            onPress={() => handleProgress('in_service')}
            disabled={submitting}
          >
            <Text style={styles.startButtonText}>
              {submitting ? '處理中...' : '開始服務'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {task.status === 'in_service' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>服務備註（選填）</Text>
          <TextInput
            style={styles.noteInput}
            multiline
            numberOfLines={3}
            value={providerNote}
            onChangeText={setProviderNote}
            placeholder="填寫備註..."
            placeholderTextColor="#9CA3AF"
          />
          <TouchableOpacity
            style={[styles.completeButton, submitting && styles.disabledButton]}
            onPress={() => handleProgress('completed')}
            disabled={submitting}
          >
            <Text style={styles.completeButtonText}>
              {submitting ? '處理中...' : '完成服務'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {task.status === 'completed' && (
        <View style={styles.completedNote}>
          <Text style={styles.completedNoteTitle}>此服務已完成</Text>
          {task.provider_note ? (
            <Text style={styles.completedNoteText}>{task.provider_note}</Text>
          ) : null}
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
  backLink: { marginTop: 8 },
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
  startButton: {
    backgroundColor: '#FFEDD5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonText: { color: '#C2410C', fontSize: 15, fontWeight: '600' },
  completeButton: {
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  completeButtonText: { color: '#15803D', fontSize: 15, fontWeight: '600' },
  disabledButton: { opacity: 0.6 },
  completedNote: {
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  completedNoteTitle: { color: '#15803D', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  completedNoteText: { color: '#374151', fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
