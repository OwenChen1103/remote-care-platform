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

/** Map AI status_label to a left-border accent color */
const AI_STATUS_ACCENT: Record<string, string> = {
  stable: colors.success,
  attention: colors.warning,
  consult_doctor: colors.danger,
};

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

  // Fetch latest health_summary for each recipient (parallel, lightweight)
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
          // Non-critical — card will show "尚未生成" state
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
          style={styles.logoutButton}
          onPress={() => { void logout().then(() => router.replace('/(auth)/login')); }}
        >
          <Text style={styles.logoutText}>登出</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>你好，{user?.name ?? ''}！</Text>
          {recipients.length > 0 && (
            <Text style={styles.sectionHint}>今日家人安心報</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => router.push('/(tabs)/home/notifications')}
            accessibilityLabel={`通知${unreadCount > 0 ? `，${unreadCount} 則未讀` : ''}`}
          >
            <Text style={styles.bellIcon}>{'\uD83D\uDD14'}</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => { void logout().then(() => router.replace('/(auth)/login')); }}
          >
            <Text style={styles.logoutText}>登出</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recipient List or Empty State */}
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
            const accentColor = report
              ? (AI_STATUS_ACCENT[report.status_label] ?? colors.success)
              : colors.borderDefault;

            return (
              <Card style={[styles.recipientCard, { borderLeftColor: accentColor }]}>
                {/* Header: name + age + AI status → tap to detail */}
                <TouchableOpacity
                  style={styles.cardHeaderTouchable}
                  onPress={() => router.push(`/(tabs)/home/${item.id}`)}
                  accessibilityLabel={`查看 ${item.name} 的詳細資料`}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardNameGroup}>
                      <Text style={styles.cardName}>{item.name}</Text>
                      {item.date_of_birth && (
                        <Text style={styles.cardAge}>{calculateAge(item.date_of_birth)} 歲</Text>
                      )}
                    </View>
                    {report && (
                      <StatusPill status={report.status_label} type="aiHealth" />
                    )}
                    {!report && !reportsLoading && null}
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

                {/* Divider */}
                <View style={styles.cardDivider} />

                {/* AI Summary Section */}
                {reportsLoading && !report ? (
                  <View style={styles.summaryLoading}>
                    <ActivityIndicator size="small" color={colors.textDisabled} />
                    <Text style={styles.summaryLoadingText}>載入近況中...</Text>
                  </View>
                ) : report ? (
                  <TouchableOpacity
                    style={styles.summarySection}
                    onPress={() => router.push('/(tabs)/ai')}
                    accessibilityLabel={`查看 ${item.name} 的安心報`}
                  >
                    <Text style={styles.reportDate}>{formatReportDate(report.generated_at)}</Text>
                    <Text style={styles.summaryText} numberOfLines={2}>
                      {report.summary}
                    </Text>
                    <Text style={styles.viewDetail}>查看安心報 ›</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.summarySection}
                    onPress={() => router.push('/(tabs)/ai')}
                  >
                    <Text style={styles.noReportText}>尚未生成安心報</Text>
                    <Text style={styles.viewDetail}>前往查看 ›</Text>
                  </TouchableOpacity>
                )}
              </Card>
            );
          }}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/home/add-recipient')}
        accessibilityLabel="新增被照護者"
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>＋</Text>
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

  // ─── Header ───────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingRight: spacing.lg,
    paddingTop: spacing.sm,
  },
  welcome: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: typography.headingLg.fontWeight,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  sectionHint: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxs,
    paddingBottom: spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  bellButton: {
    position: 'relative',
    padding: spacing.sm,
  },
  bellIcon: {
    fontSize: 22,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.danger,
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  badgeText: {
    color: colors.white,
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
  },
  logoutButton: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgSurface,
  },
  logoutText: {
    color: colors.textTertiary,
    fontSize: typography.bodySm.fontSize,
    fontWeight: '500',
  },

  // ─── List ─────────────────────────────────────────────────
  list: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },

  // ─── Recipient Card ───────────────────────────────────────
  recipientCard: {
    marginBottom: spacing.md,
    padding: 0,          // override Card default padding — inner sections handle their own
    overflow: 'hidden',  // allow left-border accent to clip
    borderLeftWidth: 4,
  },
  cardHeaderTouchable: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardName: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: typography.headingMd.fontWeight,
    color: colors.textPrimary,
  },
  cardAge: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tag: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tagText: {
    fontSize: typography.caption.fontSize,
    color: colors.primaryText,
  },

  // ─── Divider ──────────────────────────────────────────────
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderDefault,
    marginHorizontal: spacing.lg,
  },

  // ─── Summary Section ─────────────────────────────────────
  summarySection: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  reportDate: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginBottom: spacing.xs,
  },
  summaryText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
    lineHeight: typography.bodyMd.fontSize * 1.5,
  },
  viewDetail: {
    fontSize: typography.bodySm.fontSize,
    color: colors.primary,
    fontWeight: '500',
    marginTop: spacing.sm,
  },
  summaryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
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
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.high,
  },
  fabText: {
    fontSize: 28,
    color: colors.white,
    lineHeight: 32,
  },
});
