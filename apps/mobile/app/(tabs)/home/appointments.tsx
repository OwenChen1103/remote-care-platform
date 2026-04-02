import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';

interface Appointment {
  id: string;
  recipient_id: string;
  recipient: { id: string; name: string };
  title: string;
  hospital_name: string | null;
  department: string | null;
  doctor_name: string | null;
  appointment_date: string;
  note: string | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekDay = weekDays[d.getDay()];
  return `${month}/${day}（${weekDay}）`;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function AppointmentsScreen() {
  const { recipientId } = useLocalSearchParams<{ recipientId: string }>();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const query = recipientId ? `?recipient_id=${recipientId}&limit=50` : '?limit=50';
      const data = await api.get<Appointment[]>(`/appointments${query}`);
      setAppointments(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('載入行程失敗');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [recipientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: Appointment }) => {
    const days = daysUntil(item.appointment_date);
    const isPast = days < 0;
    const isToday = days === 0;
    const daysLabel = isToday ? '今天' : isPast ? `${Math.abs(days)} 天前` : `${days} 天後`;
    const daysColor = isPast ? colors.textDisabled : isToday ? colors.danger : days <= 3 ? colors.warning : colors.success;

    return (
      <View style={[styles.card, isPast && styles.cardPast]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={[styles.daysLabel, { color: daysColor }]}>{daysLabel}</Text>
        </View>
        <Text style={styles.cardDate}>{formatDate(item.appointment_date)}</Text>
        {item.hospital_name && (
          <Text style={styles.cardDetail}>
            {item.hospital_name}
            {item.department ? ` — ${item.department}` : ''}
          </Text>
        )}
        {item.doctor_name && (
          <Text style={styles.cardDetail}>醫師：{item.doctor_name}</Text>
        )}
        {item.note && <Text style={styles.cardNote}>{item.note}</Text>}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={appointments.length === 0 ? styles.center : styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>尚無行程</Text>}
      />

      {/* Add button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() =>
          router.push(`/(tabs)/home/add-appointment?recipientId=${recipientId ?? ''}`)
        }
      >
        <Text style={styles.addButtonText}>+ 新增行程</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  list: { padding: spacing.lg, paddingBottom: 80 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  loadingText: { marginTop: spacing.sm, color: colors.textSecondary, ...typography.bodyMd },
  errorText: { color: colors.danger, ...typography.bodyLg },
  emptyText: { color: colors.textDisabled, ...typography.bodyLg },

  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    ...shadows.low,
  },
  cardPast: { opacity: 0.6 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: { ...typography.bodyLg, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  daysLabel: { ...typography.bodySm, fontWeight: '600' },
  cardDate: { ...typography.bodyMd, color: colors.primary, marginBottom: spacing.sm - 2 },
  cardDetail: { ...typography.bodySm, color: colors.textSecondary, marginBottom: spacing.xxs },
  cardNote: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.sm - 2, fontStyle: 'italic' },

  addButton: {
    position: 'absolute',
    bottom: spacing['2xl'],
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    ...shadows.high,
  },
  addButtonText: { color: colors.white, ...typography.bodyLg, fontWeight: '600' },
});
