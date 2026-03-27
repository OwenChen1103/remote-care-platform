import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';

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
  candidate_proposed: { label: '待確認', color: '#7C3AED', bg: '#EDE9FE' },
  provider_confirmed: { label: '已確認', color: '#0F766E', bg: '#CCFBF1' },
  arranged: { label: '已安排', color: '#0E7490', bg: '#CFFAFE' },
  in_service: { label: '服務中', color: '#C2410C', bg: '#FFEDD5' },
  completed: { label: '已完成', color: '#15803D', bg: '#DCFCE7' },
};

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

const FILTER_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待處理' },
  { value: 'in_service', label: '進行中' },
  { value: 'completed', label: '已完成' },
] as const;

const PENDING_STATUSES = ['candidate_proposed', 'provider_confirmed', 'arranged'];

export default function ProviderTasksScreen() {
  const router = useRouter();
  const [tasks, setTasks] = useState<ProviderTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  // Build 7-day date bar (today + next 6 days)
  const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  const weekDates = useMemo(() => {
    const dates: { key: string; dayLabel: string; dateNum: number; hasTasks: boolean }[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const key = toLocalDateStr(d);
      const hasTasks = tasks.some((t) => {
        const tDate = toLocalDateStr(new Date(t.preferred_date));
        return tDate === key;
      });
      dates.push({
        key,
        dayLabel: DAY_LABELS[d.getDay()]!,
        dateNum: d.getDate(),
        hasTasks,
      });
    }
    return dates;
  }, [tasks]);

  const filteredTasks = tasks.filter((t) => {
    // Status filter
    if (filter) {
      if (filter === 'pending' && !PENDING_STATUSES.includes(t.status)) return false;
      if (filter !== 'pending' && filter !== '' && t.status !== filter) return false;
    }
    // Date filter
    if (selectedDate) {
      const tDate = toLocalDateStr(new Date(t.preferred_date));
      if (tDate !== selectedDate) return false;
    }
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Filter Chips */}
      {tasks.length > 0 && (
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((opt) => {
            const isActive = filter === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setFilter(opt.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Date Bar */}
      {tasks.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateBarScroll}
          contentContainerStyle={styles.dateBarContent}
        >
          {weekDates.map((d) => {
            const isActive = selectedDate === d.key;
            return (
              <TouchableOpacity
                key={d.key}
                style={[styles.dateCell, isActive && styles.dateCellActive]}
                onPress={() => setSelectedDate(isActive ? null : d.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.dateDayLabel, isActive && styles.dateDayLabelActive]}>
                  {d.dayLabel}
                </Text>
                <Text style={[styles.dateDateNum, isActive && styles.dateDateNumActive]}>
                  {d.dateNum}
                </Text>
                {d.hasTasks && <View style={[styles.dateDot, isActive && styles.dateDotActive]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

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
      ) : filteredTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>此分類下沒有任務</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
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
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.lg - spacing.xxs,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgSurface,
  },
  filterChipActive: {
    borderColor: colors.primaryText,
    backgroundColor: colors.primaryLight,
  },
  filterChipText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
  },
  filterChipTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  // ─── Date Bar ────────────────────────────────────────────
  dateBarScroll: {
    maxHeight: 80,
  },
  dateBarContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dateCell: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    minWidth: 44,
  },
  dateCellActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateDayLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginBottom: spacing.xxs,
  },
  dateDayLabelActive: {
    color: colors.white,
  },
  dateDateNum: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dateDateNumActive: {
    color: colors.white,
  },
  dateDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: spacing.xxs,
  },
  dateDotActive: {
    backgroundColor: colors.white,
  },

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
