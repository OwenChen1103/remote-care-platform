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

interface ServiceRequest {
  id: string;
  status: string;
  preferred_date: string;
  preferred_time_slot: string | null;
  location: string;
  description: string;
  created_at: string;
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
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

export default function ServicesScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<ServiceRequest[]>('/service-requests?limit=50');
      setRequests(result);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const renderItem = ({ item }: { item: ServiceRequest }) => {
    const status = STATUS_CONFIG[item.status] ?? {
      label: item.status,
      color: '#6B7280',
      bg: '#F3F4F6',
    };
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(tabs)/services/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.categoryName}>{item.category.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.recipientName}>{item.recipient.name}</Text>
        <Text style={styles.date}>
          期望日期：{new Date(item.preferred_date).toLocaleDateString('zh-TW')}
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
          <TouchableOpacity onPress={() => void fetchRequests()}>
            <Text style={styles.retryText}>重試</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />
      ) : requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>尚無服務需求</Text>
          <Text style={styles.emptySubText}>點擊下方按鈕新增第一筆需求</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={() => void fetchRequests()}
          refreshing={loading}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/services/new-request')}
      >
        <Text style={styles.fabText}>+ 新增需求</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  list: { padding: 16, paddingBottom: 80 },
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
  emptyText: { fontSize: 16, color: '#6B7280', marginBottom: 4 },
  emptySubText: { fontSize: 14, color: '#9CA3AF' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#2563EB',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
