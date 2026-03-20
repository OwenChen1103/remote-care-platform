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
import { useAuth } from '@/lib/auth-context';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

// ─── Types ────────────────────────────────────────────────────

interface Recipient {
  id: string;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
  medical_tags: string[];
  created_at: string;
}

interface LatestReport {
  id: string;
  status_label: string;
  summary: string;
  generated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────

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

function formatReportDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `今天 ${hh}:${mm}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天';

  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return `${diffDays} 天前`;
  return d.toLocaleDateString('zh-TW');
}

/** Map AI status to a very subtle tint for card header zone */
const STATUS_TINT: Record<string, string> = {
  stable: '#F7FEF9',       // whisper green
  attention: '#FFFDF5',    // whisper amber
  consult_doctor: '#FEF8F8', // whisper red
};

/** Map AI status to accent color for the status indicator dot */
const STATUS_DOT: Record<string, string> = {
  stable: colors.success,
  attention: colors.warning,
  consult_doctor: colors.danger,
};

/** Get the first character of a name for the avatar */
function getInitial(name: string): string {
  return name.charAt(0);
}

// ─── Component ────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [latestReports, setLatestReports] = useState<Record<string, LatestReport>>({});
  const [reportsLoading, setReportsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<Recipient[]>('/recipients');
      setRecipients(result);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('載入失敗，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLatestReports = useCallback(async (recipientList: Recipient[]) => {
    if (recipientList.length === 0) return;
    setReportsLoading(true);
    const results: Record<string, LatestReport> = {};

    await Promise.all(
      recipientList.map(async (r) => {
        try {
          const reports = await api.get<LatestReport[]>(
            `/ai/reports?recipient_id=${r.id}&report_type=health_summary&limit=1`,
          );
          const first = reports[0];
          if (first) {
            results[r.id] = first;
          }
        } catch {
          // Non-critical
        }
      }),
    );

    setLatestReports(results);
    setReportsLoading(false);
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const result = await api.get<{ count: number }>('/notifications/unread-count');
      setUnreadCount(result.count);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    void fetchRecipients();
    void fetchUnreadCount();
  }, [fetchRecipients, fetchUnreadCount]);

  useEffect(() => {
    if (recipients.length > 0) {
      void fetchLatestReports(recipients);
    }
  }, [recipients, fetchLatestReports]);

  // ─── Loading State ────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  // ─── Error State ──────────────────────────────────────────────

  if (error) {
    return (
      <View style={styles.center}>
        <ErrorState message={error} onRetry={() => void fetchRecipients()} />
        <TouchableOpacity
          style={styles.logoutButtonStandalone}
          onPress={() => { void logout().then(() => router.replace('/(auth)/login')); }}
        >
          <Text style={styles.logoutText}>登出</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const firstName = user?.name?.charAt(0) ?? '';

  // ─── Main Render ──────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* ── Elevated Header Zone ─────────────────────────────── */}
      <View style={styles.headerZone}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            {/* User avatar initial */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{firstName}</Text>
            </View>
            <View>
              <Text style={styles.welcome}>你好，{user?.name ?? ''}！</Text>
              {recipients.length > 0 && (
                <Text style={styles.sectionHint}>今日家人安心報</Text>
              )}
            </View>
          </View>

          <View style={styles.headerRight}>
            {/* Bell — custom drawn, no emoji */}
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => router.push('/(tabs)/home/notifications')}
              accessibilityLabel={`通知${unreadCount > 0 ? `，${unreadCount} 則未讀` : ''}`}
            >
              <View style={styles.bellIcon}>
                {/* Bell body */}
                <View style={styles.bellBody} />
                {/* Bell clapper */}
                <View style={styles.bellClapper} />
              </View>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => { void logout().then(() => router.replace('/(auth)/login')); }}
            >
              <Text style={styles.logoutText}>登出</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick stats strip */}
        {recipients.length > 0 && (
          <View style={styles.statsStrip}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{recipients.length}</Text>
              <Text style={styles.statLabel}>位照護對象</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {Object.values(latestReports).filter((r) => r.status_label === 'stable').length}
              </Text>
              <Text style={styles.statLabel}>狀況穩定</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[
                styles.statNumber,
                Object.values(latestReports).some((r) => r.status_label !== 'stable')
                  ? { color: colors.warning }
                  : undefined,
              ]}>
                {Object.values(latestReports).filter((r) => r.status_label !== 'stable').length}
              </Text>
              <Text style={styles.statLabel}>需留意</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Recipient List or Empty State ────────────────────── */}
      {recipients.length === 0 ? (
        <EmptyState
          title="尚無被照護者"
          description="新增您的家人或照護對象，即可開始記錄健康數據與追蹤狀況。"
          actionLabel="新增被照護者"
          onAction={() => router.push('/(tabs)/home/add-recipient')}
        />
      ) : (
        <FlatList
          data={recipients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const report = latestReports[item.id];
            const statusKey = report?.status_label ?? '';
            const headerTint = STATUS_TINT[statusKey] ?? colors.bgSurfaceAlt;
            const dotColor = STATUS_DOT[statusKey] ?? colors.textDisabled;

            return (
              <Card style={styles.recipientCard}>
                {/* ── Card Header Zone (tinted) ─────────────── */}
                <TouchableOpacity
                  style={[styles.cardHeaderZone, { backgroundColor: headerTint }]}
                  onPress={() => router.push(`/(tabs)/home/${item.id}`)}
                  accessibilityLabel={`查看 ${item.name} 的詳細資料`}
                  activeOpacity={0.7}
                >
                  {/* Name row with avatar + status */}
                  <View style={styles.cardNameRow}>
                    <View style={styles.cardIdentity}>
                      {/* Recipient avatar */}
                      <View style={[styles.recipientAvatar, { borderColor: dotColor }]}>
                        <Text style={[styles.recipientAvatarText, { color: dotColor }]}>
                          {getInitial(item.name)}
                        </Text>
                      </View>
                      <View style={styles.nameBlock}>
                        <Text style={styles.cardName}>{item.name}</Text>
                        {item.date_of_birth && (
                          <Text style={styles.cardAge}>{calculateAge(item.date_of_birth)} 歲</Text>
                        )}
                      </View>
                    </View>
                    {report && (
                      <StatusPill status={report.status_label} type="aiHealth" />
                    )}
                  </View>

                  {/* Medical tags */}
                  {item.medical_tags.length > 0 && (
                    <View style={styles.tagsRow}>
                      {item.medical_tags.map((tag) => (
                        <View key={tag} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>

                {/* ── AI Summary Zone ───────────────────────── */}
                {reportsLoading && !report ? (
                  <View style={styles.summaryLoading}>
                    <ActivityIndicator size="small" color={colors.textDisabled} />
                    <Text style={styles.summaryLoadingText}>載入近況中...</Text>
                  </View>
                ) : report ? (
                  <TouchableOpacity
                    style={styles.summaryZone}
                    onPress={() => router.push('/(tabs)/ai')}
                    accessibilityLabel={`查看 ${item.name} 的安心報`}
                    activeOpacity={0.7}
                  >
                    <View style={styles.summaryHeader}>
                      <Text style={styles.summaryLabel}>AI 近況摘要</Text>
                      <Text style={styles.reportDate}>{formatReportDate(report.generated_at)}</Text>
                    </View>
                    <Text style={styles.summaryText} numberOfLines={2}>
                      {report.summary}
                    </Text>
                    <View style={styles.viewReportButton}>
                      <Text style={styles.viewReportText}>查看安心報</Text>
                      <Text style={styles.viewReportArrow}>→</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.summaryZone}
                    onPress={() => router.push('/(tabs)/ai')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.noReportText}>尚未生成安心報</Text>
                    <View style={styles.viewReportButton}>
                      <Text style={styles.viewReportText}>前往查看</Text>
                      <Text style={styles.viewReportArrow}>→</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </Card>
            );
          }}
        />
      )}

      {/* ── FAB ──────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/home/add-recipient')}
        accessibilityLabel="新增被照護者"
        accessibilityRole="button"
        activeOpacity={0.85}
      >
        <Text style={styles.fabPlus}>＋</Text>
        <Text style={styles.fabLabel}>新增</Text>
      </TouchableOpacity>
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

  // ─── Header Zone ──────────────────────────────────────────
  headerZone: {
    backgroundColor: colors.bgSurface,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    ...shadows.low,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.primaryText,
  },
  welcome: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: typography.headingMd.fontWeight,
    color: colors.textPrimary,
  },
  sectionHint: {
    fontSize: typography.caption.fontSize,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bellButton: {
    position: 'relative',
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  bellIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
  },
  bellBody: {
    width: 14,
    height: 12,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: colors.textTertiary,
  },
  bellClapper: {
    width: 6,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.textTertiary,
    marginTop: 1,
  },
  badge: {
    position: 'absolute',
    top: spacing.xxs,
    right: spacing.xxs,
    backgroundColor: colors.danger,
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderWidth: 2,
    borderColor: colors.bgSurface,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  logoutButton: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  logoutButtonStandalone: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgSurface,
    marginTop: spacing.lg,
  },
  logoutText: {
    color: colors.textDisabled,
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
  },

  // ─── Stats Strip ──────────────────────────────────────────
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  statNumber: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.borderDefault,
  },

  // ─── List ─────────────────────────────────────────────────
  list: {
    padding: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 90,
  },

  // ─── Recipient Card ───────────────────────────────────────
  recipientCard: {
    marginBottom: spacing.lg,
    padding: 0,
    overflow: 'hidden',
    borderRadius: radius.lg,
  },

  // ── Card Header Zone (tinted) ─────────────────────────────
  cardHeaderZone: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm + spacing.xxs,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recipientAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + spacing.xxs,
  },
  recipientAvatarText: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
  },
  nameBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  cardName: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardAge: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginLeft: 30 + spacing.sm + spacing.xxs, // align with name (after avatar)
  },
  tag: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + spacing.xxs,
    paddingVertical: spacing.xxs + 1,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  tagText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '500',
    color: colors.textTertiary,
  },

  // ── Summary Zone ──────────────────────────────────────────
  summaryZone: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bgSurface,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  reportDate: {
    fontSize: 10,
    color: colors.textDisabled,
    fontWeight: '400',
  },
  summaryText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
    lineHeight: typography.bodyMd.fontSize * 1.6,
  },
  viewReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    gap: spacing.xs,
  },
  viewReportText: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.primaryText,
  },
  viewReportArrow: {
    fontSize: typography.bodySm.fontSize,
    color: colors.primaryText,
  },
  summaryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bgSurface,
  },
  summaryLoadingText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textDisabled,
  },
  noReportText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textDisabled,
    marginBottom: spacing.xs,
  },

  // ─── FAB ──────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing['2xl'] + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md + spacing.xxs,
    paddingVertical: spacing.sm + spacing.xxs,
    borderRadius: spacing['2xl'],
    gap: spacing.xs,
    ...shadows.high,
  },
  fabPlus: {
    fontSize: typography.headingSm.fontSize,
    color: colors.white,
    fontWeight: '600',
  },
  fabLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.white,
    fontWeight: '600',
  },
});
