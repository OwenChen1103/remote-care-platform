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

interface ProviderTask {
  id: string;
  status: string;
  preferred_date: string;
  preferred_time_slot: string | null;
  location: string;
  description: string;
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  arranged: { label: '已安排', color: '#0E7490', bg: '#CFFAFE' },
  in_service: { label: '服務中', color: '#C2410C', bg: '#FFEDD5' },
  completed: { label: '已完成', color: '#15803D', bg: '#DCFCE7' },
};

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

export default function ProviderTasksScreen() {
  const router = useRouter();
  const [tasks, setTasks] = useState<ProviderTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<ProviderTask[]>('/provider/tasks?limit=50');
      setTasks(result);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const renderItem = ({ item }: { item: ProviderTask }) => {
    const status = STATUS_CONFIG[item.status] ?? {
      label: item.status,
      color: '#6B7280',
      bg: '#F3F4F6',
    };
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          router.push(`/(tabs)/services/provider-task-detail?taskId=${item.id}`)
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.categoryName}>{item.category.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.recipientName}>{item.recipient.name}</Text>
        <Text style={styles.date}>
          {new Date(item.preferred_date).toLocaleDateString('zh-TW')}
          {item.preferred_time_slot
            ? ` ${TIME_SLOT_LABELS[item.preferred_time_slot] ?? item.preferred_time_slot}`
            : ''}
        </Text>
        <Text style={styles.location} numberOfLines={1}>
          {item.location}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void fetchTasks()}>
            <Text style={styles.retryText}>重試</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />
      ) : tasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>目前沒有指派的任務</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={() => void fetchTasks()}
          refreshing={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  statusBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 12, fontWeight: '500' },
  recipientName: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  date: { fontSize: 13, color: '#9CA3AF', marginBottom: 2 },
  location: { fontSize: 13, color: '#9CA3AF' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#DC2626', fontSize: 14, marginBottom: 8 },
  retryText: { color: '#2563EB', fontSize: 14, textDecorationLine: 'underline' },
  loader: { flex: 1, justifyContent: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#6B7280' },
});
