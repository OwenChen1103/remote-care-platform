import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { navigateNotification, type Role } from '@/lib/notification-deeplink';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
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

// ─── Type → SVG icon + color ──────────────────────────────────

interface IconConfig {
  bg: string;
  fg: string;
  render: (color: string) => React.ReactElement;
}

const TYPE_ICONS: Record<string, IconConfig> = {
  measurement_reminder: {
    bg: '#E5F2FB',
    fg: '#1B6DA0',
    render: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={1.8} />
        <Path d="M12 6v6l4 2" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    ),
  },
  abnormal_alert: {
    bg: '#FDECEA',
    fg: '#D9534F',
    render: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2L2 22h20L12 2z" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d="M12 9v5M12 17h.01" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    ),
  },
  appointment_reminder: {
    bg: '#EDF7E8',
    fg: '#3F7F2E',
    render: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="5" width="18" height="16" rx="2" stroke={c} strokeWidth={1.8} />
        <Path d="M3 9h18M8 3v4M16 3v4" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    ),
  },
  service_request_update: {
    bg: '#F0EEFF',
    fg: '#5B52E0',
    render: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Rect x="6" y="4" width="12" height="18" rx="2" stroke={c} strokeWidth={1.8} />
        <Path d="M9 2h6v4H9z" stroke={c} strokeWidth={1.8} />
        <Path d="M9 12h6M9 16h4" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    ),
  },
  ai_report_ready: {
    bg: '#FEF3D9',
    fg: '#B07000',
    render: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2l2.5 6.5L21 10l-5 4.5L17 22l-5-3-5 3 1-7.5L3 10l6.5-1.5L12 2z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
      </Svg>
    ),
  },
};

const DEFAULT_ICON: IconConfig = {
  bg: colors.bgSurfaceAlt,
  fg: colors.textTertiary,
  render: (c) => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M13.7 21a2 2 0 01-3.4 0" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  ),
};

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
  return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

function getDateGroup(dateStr: string): '今天' | '昨天' | '本週' | '更早' {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - targetDay.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return '本週';
  return '更早';
}

interface ListSection {
  type: 'header' | 'item';
  key: string;
  title?: string;
  notification?: Notification;
}

function buildSections(notifications: Notification[]): ListSection[] {
  const groups: Record<string, Notification[]> = { 今天: [], 昨天: [], 本週: [], 更早: [] };
  notifications.forEach((n) => {
    const g = getDateGroup(n.created_at);
    groups[g]!.push(n);
  });
  const sections: ListSection[] = [];
  (['今天', '昨天', '本週', '更早'] as const).forEach((g) => {
    if (groups[g]!.length > 0) {
      sections.push({ type: 'header', key: `h-${g}`, title: g });
      groups[g]!.forEach((n) => {
        sections.push({ type: 'item', key: n.id, notification: n });
      });
    }
  });
  return sections;
}

// ─── Component ────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
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
      setError(e instanceof ApiError ? e.message : '載入失敗，請稍後再試');
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

  useEffect(() => { void loadInitial(); }, [loadInitial]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`, {});
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch { /* */ }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.put('/notifications/read-all', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch { /* */ }
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <ErrorState message={error} onRetry={() => void loadInitial()} />
      </View>
    );
  }

  const sections = buildSections(notifications);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Top action bar — only show when there are unread items */}
      {unreadCount > 0 && (
        <View style={s.topBar}>
          <Text style={s.topBarText}>
            <Text style={s.unreadCount}>{unreadCount}</Text> 則未讀
          </Text>
          <TouchableOpacity
            onPress={() => void markAllRead()}
            style={s.markAllBtn}
            accessibilityLabel="全部標為已讀"
          >
            <Text style={s.markAllText}>全部標為已讀</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List — always renders so pull-to-refresh works even when empty.
          - style={flex:1} on the FlatList itself: forces it to fill the parent
            (the container View). Without this, when data + ListHeader are
            both absent, FlatList shrinks to content height and the pull
            gesture has no scroll surface to recognise.
          - flexGrow:1 on contentContainerStyle: pushes the empty component
            to vertical center while still letting the scroll view scroll. */}
      <FlatList
          data={sections}
          keyExtractor={(item) => item.key}
          style={s.flatList}
          contentContainerStyle={[s.list, sections.length === 0 && s.listEmpty]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <EmptyState
                title="尚無通知"
                description="當有新的量測提醒、異常通知或服務更新時，會在這裡顯示。"
              />
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={s.sectionHeader}>{item.title}</Text>;
            }
            const n = item.notification!;
            const cfg = TYPE_ICONS[n.type] ?? DEFAULT_ICON;
            const typeLabel = NOTIFICATION_TYPE_DISPLAY[n.type]?.label ?? '通知';
            return (
              <TouchableOpacity
                style={[s.card, !n.is_read && s.cardUnread]}
                onPress={() => {
                  // Always mark unread → read on tap; navigate via role-aware deep-link.
                  // Section 2.9.3: caregiver/provider/patient each have their own destination per type.
                  if (!n.is_read) void markAsRead(n.id);
                  navigateNotification(router, n.type, n.data, (user?.role ?? 'caregiver') as Role);
                }}
                activeOpacity={0.7}
              >
                <View style={[s.iconWrap, { backgroundColor: cfg.bg }]}>
                  {cfg.render(cfg.fg)}
                </View>
                <View style={s.content}>
                  <View style={s.headerRow}>
                    <Text style={[s.typeLabel, { color: cfg.fg }]}>{typeLabel}</Text>
                    <Text style={s.time}>{formatTime(n.created_at)}</Text>
                  </View>
                  <Text style={[s.title, !n.is_read && s.titleUnread]} numberOfLines={1}>
                    {n.title}
                  </Text>
                  <Text style={s.body} numberOfLines={2}>
                    {n.body}
                  </Text>
                </View>
                {!n.is_read && <View style={s.unreadDot} />}
              </TouchableOpacity>
            );
          }}
        />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyWrap: { flex: 1, justifyContent: 'center' },

  // Top bar — pill style
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  topBarText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textSecondary,
  },
  unreadCount: {
    color: colors.primary,
    fontWeight: '700',
  },
  markAllBtn: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(46,141,201,0.2)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + spacing.xxs,
  },
  markAllText: {
    color: colors.primaryText,
    fontSize: typography.captionSm.fontSize,
    fontWeight: '600',
  },

  // List
  // flex:1 makes FlatList fill the parent View even when content (data +
  // ListHeader) is empty. Required for RefreshControl on empty state.
  flatList: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  // When sections is empty, flexGrow:1 lets the scroll view fill the viewport so
  // RefreshControl's pull gesture is recognisable. Without this, FlatList shrinks
  // to ListEmptyComponent's height and pull-to-refresh doesn't trigger.
  listEmpty: { flexGrow: 1, justifyContent: 'center' },

  // Section header (今天 / 昨天 / 本週 / 更早)
  sectionHeader: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingLeft: 4,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.bgSurface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  cardUnread: {
    backgroundColor: colors.bgSurface,
    borderColor: 'rgba(46,141,201,0.25)',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },

  // Icon
  iconWrap: {
    width: 36, height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  content: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  typeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  time: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
  },
  title: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  titleUnread: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    lineHeight: 17,
  },

  // Unread dot
  unreadDot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
});
