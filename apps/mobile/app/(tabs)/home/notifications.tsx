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
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NOTIFICATION_TYPE_DISPLAY } from '@remote-care/shared';

// ─── Types ────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));

  if (diffMin < 1) return '剛剛';
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} 小時前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} 天前`;
  return d.toLocaleDateString('zh-TW');
}

function getTypeIcon(type: string): string {
  return NOTIFICATION_TYPE_DISPLAY[type]?.icon ?? '🔔';
}

// ─── Component ────────────────────────────────────────────────

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchNotifications = useCallback(async () => {
    setError('');
    try {
      const result = await api.get<Notification[]>('/notifications?limit=50');
      setNotifications(result);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('載入失敗，請稍後再試');
      }
    }
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    await fetchNotifications();
    setLoading(false);
  }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    } catch {
      // Non-critical
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.put('/notifications/read-all', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // Non-critical
    }
  }, []);

  const hasUnread = notifications.some((n) => !n.is_read);

  // ─── Loading ──────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  // ─── Error ────────────────────────────────────────────────

  if (error) {
    return (
      <View style={styles.center}>
        <ErrorState message={error} onRetry={() => void loadInitial()} />
      </View>
    );
  }

  // ─── Main Render ──────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Mark all as read bar */}
      {hasUnread && (
        <TouchableOpacity
          style={styles.markAllBar}
          onPress={() => void markAllRead()}
          accessibilityLabel="全部標為已讀"
        >
          <Text style={styles.markAllText}>全部標為已讀</Text>
        </TouchableOpacity>
      )}

      {/* Notification list or empty state */}
      {notifications.length === 0 ? (
        <EmptyState
          title="尚無通知"
          description="當有新的量測提醒、異常通知或服務更新時，會在這裡顯示。"
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
          renderItem={({ item }) => (
            <Card
              style={[styles.notificationCard, !item.is_read && styles.notificationCardUnread]}
              onPress={!item.is_read ? () => void markAsRead(item.id) : undefined}
            >
              {/* Icon */}
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>{getTypeIcon(item.type)}</Text>
              </View>

              {/* Content */}
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text
                    style={[styles.cardTitle, !item.is_read && styles.cardTitleUnread]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={styles.cardTime}>{formatTime(item.created_at)}</Text>
                </View>
                <Text style={styles.cardBody} numberOfLines={2}>
                  {item.body}
                </Text>
              </View>

              {/* Unread dot */}
              {!item.is_read && <View style={styles.unreadDot} />}
            </Card>
          )}
        />
      )}
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
  list: {
    padding: spacing.lg,
  },

  // ─── Mark All Bar ─────────────────────────────────────────
  markAllBar: {
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.sm + spacing.xxs,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderDefault,
  },
  markAllText: {
    color: colors.primaryText,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    textAlign: 'right',
  },

  // ─── Notification Card ────────────────────────────────────
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg - spacing.xxs,
    marginBottom: spacing.sm,
  },
  notificationCardUnread: {
    backgroundColor: colors.infoLight,
  },

  // ─── Icon ─────────────────────────────────────────────────
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgSurfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: spacing.xxs,
  },
  icon: {
    fontSize: 18,
  },

  // ─── Content ──────────────────────────────────────────────
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '500',
    color: colors.textSecondary,
    flex: 1,
  },
  cardTitleUnread: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardTime: {
    fontSize: typography.caption.fontSize,
    color: colors.textDisabled,
    marginLeft: spacing.sm,
  },
  cardBody: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
    lineHeight: typography.bodySm.fontSize * 1.5,
  },

  // ─── Unread Dot ───────────────────────────────────────────
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
    marginTop: spacing.sm,
  },
});
