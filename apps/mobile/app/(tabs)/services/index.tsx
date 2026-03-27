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
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

// ─── Filter Options ──────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'active', label: '處理中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
] as const;

const ACTIVE_STATUSES = [
  'submitted', 'screening', 'candidate_proposed',
  'caregiver_confirmed', 'provider_confirmed', 'arranged', 'in_service',
];

// ─── Types ────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────

export default function ServicesScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

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

  const filteredRequests = requests.filter((r) => {
    if (!filter) return true;
    if (filter === 'active') return ACTIVE_STATUSES.includes(r.status);
    return r.status === filter;
  });

  // ─── Error State ──────────────────────────────────────────

  if (error && requests.length === 0) {
    return (
      <View style={styles.center}>
        <ErrorState message={error} onRetry={() => void fetchRequests()} />
      </View>
    );
  }

  // ─── Loading State ────────────────────────────────────────

  if (loading && requests.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  // ─── Main Render ──────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Filter Chips */}
      {requests.length > 0 && (
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

      {requests.length === 0 ? (
        <EmptyState
          title="尚無服務需求"
          description="提交服務需求後，平台將為您媒合合適的服務人員。"
          actionLabel="新增需求"
          onAction={() => router.push('/(tabs)/services/new-request')}
        />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          title="沒有符合的需求"
          description="此分類下目前沒有服務需求。"
        />
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={() => void fetchRequests()}
          refreshing={loading}
          renderItem={({ item }) => (
            <Card
              style={styles.requestCard}
              onPress={() => router.push(`/(tabs)/services/${item.id}`)}
            >
              {/* Header: category + status */}
              <View style={styles.cardHeader}>
                <Text style={styles.categoryName}>{item.category.name}</Text>
                <StatusPill status={item.status} type="serviceRequest" />
              </View>

              {/* Recipient */}
              <Text style={styles.recipientName}>{item.recipient.name}</Text>

              {/* Date + location */}
              <Text style={styles.meta}>
                期望日期：{new Date(item.preferred_date).toLocaleDateString('zh-TW')}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.location}
              </Text>
            </Card>
          )}
        />
      )}

      {/* FAB */}
      <View style={styles.fab}>
        <Card
          style={styles.fabCard}
          onPress={() => router.push('/(tabs)/services/new-request')}
        >
          <Text style={styles.fabText}>+ 新增需求</Text>
        </Card>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgScreen,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
  },

  // ─── Filter Chips ────────────────────────────────────────
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

  // ─── List ─────────────────────────────────────────────────
  list: {
    padding: spacing.lg,
    paddingBottom: 80,
  },

  // ─── Request Card ─────────────────────────────────────────
  requestCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryName: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: typography.headingSm.fontWeight,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  recipientName: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  meta: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textDisabled,
    marginBottom: spacing.xxs,
  },

  // ─── FAB ──────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    bottom: spacing['2xl'],
    right: spacing['2xl'],
  },
  fabCard: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    borderWidth: 0,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg - spacing.xxs,
    ...shadows.high,
  },
  fabText: {
    color: colors.white,
    fontSize: typography.headingSm.fontSize,
    fontWeight: '600',
  },
});
