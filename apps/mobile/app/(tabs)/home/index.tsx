import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
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

/** Per-recipient highlight for the overview card */
interface RecipientHighlight {
  name: string;
  statusLabel: string;
  note: string;
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

const STATUS_TINT: Record<string, string> = {
  stable: colors.statusTintStable,
  attention: colors.statusTintAttention,
  consult_doctor: colors.statusTintConsultDoctor,
};

const STATUS_DOT: Record<string, string> = {
  stable: colors.success,
  attention: colors.warning,
  consult_doctor: colors.danger,
};

const URGENCY_ORDER: Record<string, number> = {
  consult_doctor: 0,
  attention: 1,
  stable: 2,
};
const NO_REPORT_URGENCY = 3;

function getInitial(name: string): string {
  return name.charAt(0);
}

function sortByUrgency(
  recipientList: Recipient[],
  reports: Record<string, LatestReport>,
): Recipient[] {
  return [...recipientList].sort((a, b) => {
    const reportA = reports[a.id];
    const reportB = reports[b.id];
    const urgA = reportA ? (URGENCY_ORDER[reportA.status_label] ?? NO_REPORT_URGENCY) : NO_REPORT_URGENCY;
    const urgB = reportB ? (URGENCY_ORDER[reportB.status_label] ?? NO_REPORT_URGENCY) : NO_REPORT_URGENCY;
    if (urgA !== urgB) return urgA - urgB;
    const dateA = reportA ? new Date(reportA.generated_at).getTime() : 0;
    const dateB = reportB ? new Date(reportB.generated_at).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    return a.name.localeCompare(b.name, 'zh-Hant');
  });
}

function getOverallStatus(reports: Record<string, LatestReport>): string | null {
  const all = Object.values(reports);
  if (all.length === 0) return null;
  if (all.some((r) => r.status_label === 'consult_doctor')) return 'consult_doctor';
  if (all.some((r) => r.status_label === 'attention')) return 'attention';
  return 'stable';
}

/**
 * Extract the first meaningful sentence or clause from an existing AI summary.
 * Returns up to ~60 characters, breaking at natural punctuation.
 * This relocates existing AI text, not composing new medical prose.
 */
function extractExcerpt(summary: string, maxLen = 60): string {
  if (!summary) return '';
  const short = summary.slice(0, maxLen);
  const periodIdx = short.indexOf('。');
  if (periodIdx > 0) return short.slice(0, periodIdx + 1);
  // If no period, look for a good comma break (at least 10 chars in)
  const commaIdx = short.lastIndexOf('，');
  if (commaIdx > 10) return short.slice(0, commaIdx + 1) + '...';
  if (summary.length > maxLen) return short + '...';
  return summary;
}

/**
 * Build a cohesive overview paragraph for the care summary card.
 * Uses template sentences + relayed existing AI excerpts.
 */
function buildOverviewParagraph(
  total: number,
  sorted: Recipient[],
  reports: Record<string, LatestReport>,
): string {
  const urgentRecipients = sorted.filter((r) => {
    const rpt = reports[r.id];
    return rpt && rpt.status_label !== 'stable';
  });

  // All stable — give a reassuring summary with a bit more context
  if (urgentRecipients.length === 0) {
    const firstStable = sorted[0];
    const firstReport = firstStable ? reports[firstStable.id] : undefined;
    if (firstStable && firstReport && total === 1) {
      const excerpt = extractExcerpt(firstReport.summary, 80);
      return `今天${firstStable.name}的狀況不錯。${excerpt}`;
    }
    if (firstStable && firstReport) {
      const excerpt = extractExcerpt(firstReport.summary, 60);
      return `今天 ${total} 位家人的狀況都不錯，請放心。${firstStable.name}的近況：${excerpt}`;
    }
    return `今天 ${total} 位家人近況穩定，請放心。`;
  }

  const parts: string[] = [];
  const top = urgentRecipients[0];
  const topReport = top ? reports[top.id] : undefined;

  if (urgentRecipients.length === 1 && top && topReport) {
    parts.push(`今天大部分家人狀況穩定，但${top.name}需要您多留意一下。`);
    // Show a longer excerpt from the most urgent person's AI summary
    const excerpt = extractExcerpt(topReport.summary, 100);
    if (excerpt) parts.push(excerpt);
    const stableN = total - 1;
    if (stableN === 1) {
      // Mention the stable person briefly
      const stableRecipient = sorted.find((r) => r.id !== top.id);
      const stableReport = stableRecipient ? reports[stableRecipient.id] : undefined;
      if (stableRecipient && stableReport) {
        const stableExcerpt = extractExcerpt(stableReport.summary, 40);
        parts.push(`${stableRecipient.name}目前狀況穩定${stableExcerpt ? '，' + stableExcerpt : '。'}`);
      } else {
        parts.push('另一位家人目前狀況穩定。');
      }
    } else if (stableN > 1) {
      parts.push(`其餘 ${stableN} 位家人目前都還好。`);
    }
  } else {
    // Multiple urgent
    parts.push(`今天有 ${urgentRecipients.length} 位家人需要您多關心一下。`);
    // Show excerpt for the top 2 most urgent
    const topTwo = urgentRecipients.slice(0, 2);
    for (const person of topTwo) {
      const rpt = reports[person.id];
      if (rpt) {
        const excerpt = extractExcerpt(rpt.summary, 80);
        if (excerpt) parts.push(`${person.name}：${excerpt}`);
      }
    }
    const stableN = total - urgentRecipients.length;
    if (stableN > 0) {
      parts.push(`其餘 ${stableN} 位家人目前狀況穩定。`);
    }
  }

  return parts.join('');
}

/**
 * Build per-recipient highlights for the structured section of the overview card.
 * Each highlight is one short note derived from existing data.
 */
function buildHighlights(
  sorted: Recipient[],
  reports: Record<string, LatestReport>,
): RecipientHighlight[] {
  return sorted.map((recipient) => {
    const report = reports[recipient.id];
    if (!report) {
      return { name: recipient.name, statusLabel: '', note: '還沒有近況報告' };
    }
    if (report.status_label === 'stable') {
      const stableExcerpt = extractExcerpt(report.summary, 40);
      return {
        name: recipient.name,
        statusLabel: report.status_label,
        note: stableExcerpt || '狀況不錯，請放心',
      };
    }
    // Non-stable: extract a longer key point from their existing AI summary
    const excerpt = extractExcerpt(report.summary, 45);
    return {
      name: recipient.name,
      statusLabel: report.status_label,
      note: excerpt || '建議多留意',
    };
  });
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
  const [refreshing, setRefreshing] = useState(false);

  // Spin animation for the refresh icon
  const spinAnim = useRef(new Animated.Value(0)).current;

  const startSpin = useCallback(() => {
    spinAnim.setValue(0);
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinAnim]);

  const stopSpin = useCallback(() => {
    spinAnim.stopAnimation();
    spinAnim.setValue(0);
  }, [spinAnim]);

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

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

  /** Regenerate AI reports for all recipients, then refresh the overview */
  const regenerateOverview = useCallback(async () => {
    if (refreshing || recipients.length === 0) return;
    setRefreshing(true);
    startSpin();
    try {
      // Generate a fresh health_summary for each recipient in parallel
      await Promise.all(
        recipients.map(async (r) => {
          try {
            await api.post('/ai/health-report', {
              recipient_id: r.id,
              report_type: 'health_summary',
            });
          } catch {
            // Individual failures are non-critical — rate limit or API error
          }
        }),
      );
      // Re-fetch latest reports to pick up newly generated ones
      await fetchLatestReports(recipients);
    } finally {
      setRefreshing(false);
      stopSpin();
    }
  }, [refreshing, recipients, fetchLatestReports, startSpin, stopSpin]);

  useEffect(() => {
    void fetchRecipients();
    void fetchUnreadCount();
  }, [fetchRecipients, fetchUnreadCount]);

  useEffect(() => {
    if (recipients.length > 0) {
      void fetchLatestReports(recipients);
    }
  }, [recipients, fetchLatestReports]);

  // ─── Derived Data ──────────────────────────────────────────────

  const isMultiRecipient = recipients.length >= 2;

  const sortedRecipients = useMemo(
    () => (isMultiRecipient ? sortByUrgency(recipients, latestReports) : recipients),
    [recipients, latestReports, isMultiRecipient],
  );

  const overallStatus = useMemo(
    () => getOverallStatus(latestReports),
    [latestReports],
  );

  const hasAnyReports = Object.keys(latestReports).length > 0;

  const overviewParagraph = useMemo(
    () => (isMultiRecipient && hasAnyReports
      ? buildOverviewParagraph(recipients.length, sortedRecipients, latestReports)
      : ''),
    [recipients.length, latestReports, sortedRecipients, isMultiRecipient, hasAnyReports],
  );

  const highlights = useMemo(
    () => (isMultiRecipient && hasAnyReports
      ? buildHighlights(sortedRecipients, latestReports)
      : []),
    [sortedRecipients, latestReports, isMultiRecipient, hasAnyReports],
  );

  // ─── Loading / Error ───────────────────────────────────────────

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

  // ─── Render: Large Card (single-recipient) ─────────────────────

  const renderLargeCard = ({ item }: { item: Recipient }) => {
    const report = latestReports[item.id];
    const statusKey = report?.status_label ?? '';
    const headerTint = STATUS_TINT[statusKey] ?? colors.bgSurfaceAlt;
    const dotColor = STATUS_DOT[statusKey] ?? colors.textDisabled;

    return (
      <Card style={styles.recipientCard}>
        <TouchableOpacity
          style={[styles.cardHeaderZone, { backgroundColor: headerTint }]}
          onPress={() => router.push(`/(tabs)/home/${item.id}`)}
          accessibilityLabel={`查看 ${item.name} 的詳細資料`}
          activeOpacity={0.7}
        >
          <View style={styles.cardNameRow}>
            <View style={styles.cardIdentity}>
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
            {report && <StatusPill status={report.status_label} type="aiHealth" />}
          </View>
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
            <Text style={styles.summaryText} numberOfLines={2}>{report.summary}</Text>
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
  };

  // ─── Render: Recipient Tile (navigation module) ────────────────

  const renderRecipientTile = ({ item }: { item: Recipient }) => {
    const report = latestReports[item.id];
    const dotColor = STATUS_DOT[report?.status_label ?? ''] ?? colors.textDisabled;

    return (
      <Card onPress={() => router.push(`/(tabs)/home/${item.id}`)} style={styles.tileCard}>
        <View style={styles.tileRow}>
          <View style={styles.tileLeft}>
            <View style={[styles.recipientAvatar, { borderColor: dotColor }]}>
              <Text style={[styles.recipientAvatarText, { color: dotColor }]}>
                {getInitial(item.name)}
              </Text>
            </View>
            <View style={styles.tileInfo}>
              <View style={styles.tileNameRow}>
                <Text style={styles.tileName}>{item.name}</Text>
                {item.date_of_birth && (
                  <Text style={styles.tileAge}>{calculateAge(item.date_of_birth)} 歲</Text>
                )}
              </View>
              {item.medical_tags.length > 0 && (
                <View style={styles.tileTagsRow}>
                  {item.medical_tags.slice(0, 3).map((tag) => (
                    <View key={tag} style={styles.tileTag}>
                      <Text style={styles.tileTagText}>{tag}</Text>
                    </View>
                  ))}
                  {item.medical_tags.length > 3 && (
                    <Text style={styles.tileTagOverflow}>+{item.medical_tags.length - 3}</Text>
                  )}
                </View>
              )}
            </View>
          </View>
          <View style={styles.tileRight}>
            {report ? (
              <StatusPill status={report.status_label} type="aiHealth" />
            ) : (
              <Text style={styles.tileNoReport}>未生成</Text>
            )}
          </View>
        </View>
      </Card>
    );
  };

  // ─── Render: Central AI Summary Card ───────────────────────────

  const renderCareOverview = () => {
    /** Small refresh button rendered next to the title */
    const refreshButton = (
      <TouchableOpacity
        onPress={() => { void regenerateOverview(); }}
        disabled={refreshing}
        style={styles.refreshButton}
        accessibilityLabel="重新整理安心報"
        activeOpacity={0.6}
      >
        <Animated.Text
          style={[
            styles.refreshIcon,
            { transform: [{ rotate: spinInterpolation }] },
            refreshing ? { color: colors.primary } : undefined,
          ]}
        >
          ↻
        </Animated.Text>
      </TouchableOpacity>
    );

    if (reportsLoading && !hasAnyReports) {
      return (
        <Card style={styles.overviewCard}>
          <View style={styles.overviewTitleRow}>
            <Text style={styles.overviewLabel}>今日家人安心報</Text>
          </View>
          <View style={styles.overviewLoadingRow}>
            <ActivityIndicator size="small" color={colors.textDisabled} />
            <Text style={styles.overviewLoadingText}>正在幫您整理家人的近況...</Text>
          </View>
        </Card>
      );
    }

    if (!hasAnyReports) {
      return (
        <Card style={styles.overviewCard}>
          <View style={styles.overviewTitleRow}>
            <Text style={styles.overviewLabel}>今日家人安心報</Text>
          </View>
          <Text style={styles.overviewBody}>
            還沒有家人的近況報告。生成安心報後，這裡會幫您整理每位家人的照護狀況。
          </Text>
          <TouchableOpacity
            style={styles.overviewCta}
            onPress={() => router.push('/(tabs)/ai')}
            activeOpacity={0.7}
          >
            <Text style={styles.overviewCtaText}>去看看安心報</Text>
            <Text style={styles.overviewCtaArrow}>→</Text>
          </TouchableOpacity>
        </Card>
      );
    }

    return (
      <Card style={styles.overviewCard}>
        {/* Header: label + refresh + overall pill */}
        <View style={styles.overviewHeaderRow}>
          <View style={styles.overviewTitleRow}>
            <Text style={styles.overviewLabel}>今日家人安心報</Text>
            {refreshButton}
          </View>
          {overallStatus && <StatusPill status={overallStatus} type="aiHealth" />}
        </View>

        {/* Flowing summary paragraph */}
        <Text style={styles.overviewBody}>{overviewParagraph}</Text>

        {/* Structured highlights — one line per recipient */}
        {highlights.length > 0 && (
          <View style={styles.highlightsSection}>
            {highlights.map((h) => {
              const dotColor = STATUS_DOT[h.statusLabel] ?? colors.textDisabled;
              return (
                <View key={h.name} style={styles.highlightRow}>
                  <View style={[styles.highlightDot, { backgroundColor: dotColor }]} />
                  <Text style={styles.highlightName}>{h.name}</Text>
                  <Text style={styles.highlightSep}>—</Text>
                  <Text
                    style={[
                      styles.highlightNote,
                      h.statusLabel !== 'stable' && h.statusLabel !== ''
                        ? { color: colors.textSecondary }
                        : undefined,
                    ]}
                    numberOfLines={1}
                  >
                    {h.note}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Footer */}
        <View style={styles.overviewFooter}>
          <TouchableOpacity
            style={styles.overviewCta}
            onPress={() => router.push('/(tabs)/ai')}
            activeOpacity={0.7}
          >
            <Text style={styles.overviewCtaText}>看完整安心報</Text>
            <Text style={styles.overviewCtaArrow}>→</Text>
          </TouchableOpacity>
          <Text style={styles.overviewDisclaimer}>以上為 AI 整理，僅供參考</Text>
        </View>
      </Card>
    );
  };

  // ─── Main Render ──────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header Zone */}
      <View style={styles.headerZone}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{firstName}</Text>
            </View>
            <View>
              <Text style={styles.welcome}>你好，{user?.name ?? ''}！</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => router.push('/(tabs)/home/notifications')}
              accessibilityLabel={`通知${unreadCount > 0 ? `，${unreadCount} 則未讀` : ''}`}
            >
              <View style={styles.bellIcon}>
                <View style={styles.bellBody} />
                <View style={styles.bellClapper} />
              </View>
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
      </View>

      {/* Content */}
      {recipients.length === 0 ? (
        <EmptyState
          title="尚無被照護者"
          description="新增您的家人或照護對象，即可開始記錄健康數據與追蹤狀況。"
          actionLabel="新增被照護者"
          onAction={() => router.push('/(tabs)/home/add-recipient')}
        />
      ) : recipients.length === 1 ? (
        <FlatList
          data={recipients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.singleList}
          renderItem={renderLargeCard}
        />
      ) : (
        <FlatList
          data={sortedRecipients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={renderCareOverview}
          renderItem={renderRecipientTile}
        />
      )}

      {/* FAB */}
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
  container: { flex: 1, backgroundColor: colors.bgScreen },
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

  // ─── Header ────────────────────────────────────────────────
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bellButton: { position: 'relative', padding: spacing.sm, borderRadius: radius.sm },
  bellIcon: { width: 20, height: 20, alignItems: 'center' },
  bellBody: {
    width: 14, height: 12,
    borderTopLeftRadius: 7, borderTopRightRadius: 7,
    borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
    backgroundColor: colors.textTertiary,
  },
  bellClapper: {
    width: 6, height: 3,
    borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
    backgroundColor: colors.textTertiary,
    marginTop: 1,
  },
  badge: {
    position: 'absolute', top: spacing.xxs, right: spacing.xxs,
    backgroundColor: colors.danger, borderRadius: radius.full,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xs, borderWidth: 2, borderColor: colors.bgSurface,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  logoutButton: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  logoutButtonStandalone: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: colors.bgSurface, marginTop: spacing.lg,
  },
  logoutText: {
    color: colors.textDisabled,
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
  },

  // ─── Central AI Summary Card ───────────────────────────────
  overviewCard: {
    marginBottom: spacing.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  overviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  overviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  overviewLabel: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: typography.headingSm.fontWeight,
    color: colors.textPrimary,
  },
  refreshButton: {
    padding: spacing.xs,
  },
  refreshIcon: {
    fontSize: typography.bodyLg.fontSize,
    color: colors.textDisabled,
    fontWeight: '600',
  },
  overviewBody: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
    lineHeight: typography.bodyMd.fontSize * 1.7,
  },
  overviewLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  overviewLoadingText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textDisabled,
  },

  // Structured highlights section inside overview card
  highlightsSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 1,
  },
  highlightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.sm,
  },
  highlightName: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: spacing.xs,
  },
  highlightSep: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textDisabled,
    marginRight: spacing.xs,
  },
  highlightNote: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
    flex: 1,
  },

  // Overview footer
  overviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  overviewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    gap: spacing.xs,
  },
  overviewCtaText: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.primaryText,
  },
  overviewCtaArrow: {
    fontSize: typography.bodySm.fontSize,
    color: colors.primaryText,
  },
  overviewDisclaimer: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
  },

  // ─── Recipient Tiles ───────────────────────────────────────
  tileCard: {
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  tileInfo: { flex: 1 },
  tileNameRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  tileName: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tileAge: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary },
  tileRight: { marginLeft: spacing.sm },
  tileTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tileTag: {
    backgroundColor: colors.bgSurfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  tileTagText: { fontSize: 10, fontWeight: '500', color: colors.textTertiary },
  tileTagOverflow: { fontSize: 10, color: colors.textDisabled },
  tileNoReport: { fontSize: typography.captionSm.fontSize, color: colors.textDisabled },

  // ─── Lists ─────────────────────────────────────────────────
  list: { padding: spacing.lg, paddingTop: spacing.lg, paddingBottom: 90 },
  singleList: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 90 },

  // ─── Large Card (single-recipient) ─────────────────────────
  recipientCard: {
    marginBottom: spacing.lg, padding: 0,
    overflow: 'hidden', borderRadius: radius.lg,
  },
  cardHeaderZone: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm + spacing.xxs,
  },
  cardNameRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  recipientAvatar: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1.5,
    backgroundColor: colors.bgSurface,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm + spacing.xxs,
  },
  recipientAvatarText: { fontSize: typography.bodySm.fontSize, fontWeight: '600' },
  nameBlock: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  cardName: {
    fontSize: typography.headingMd.fontSize, fontWeight: '700', color: colors.textPrimary,
  },
  cardAge: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary },
  tagsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    marginTop: spacing.sm, marginLeft: 30 + spacing.sm + spacing.xxs,
  },
  tag: {
    backgroundColor: colors.bgSurface, borderRadius: radius.full,
    paddingHorizontal: spacing.sm + spacing.xxs, paddingVertical: spacing.xxs + 1,
    borderWidth: 1, borderColor: colors.borderDefault,
  },
  tagText: {
    fontSize: typography.captionSm.fontSize, fontWeight: '500', color: colors.textTertiary,
  },

  // Large card summary zone
  summaryZone: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    paddingBottom: spacing.lg, backgroundColor: colors.bgSurface,
  },
  summaryHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'baseline', marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: 10, fontWeight: '500', color: colors.textDisabled,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  reportDate: { fontSize: 10, color: colors.textDisabled, fontWeight: '400' },
  summaryText: {
    fontSize: typography.bodyMd.fontSize, color: colors.textSecondary,
    lineHeight: typography.bodyMd.fontSize * 1.6,
  },
  viewReportButton: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    marginTop: spacing.md, backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.sm, gap: spacing.xs,
  },
  viewReportText: {
    fontSize: typography.bodySm.fontSize, fontWeight: '600', color: colors.primaryText,
  },
  viewReportArrow: { fontSize: typography.bodySm.fontSize, color: colors.primaryText },
  summaryLoading: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.lg, paddingTop: spacing.md, gap: spacing.sm,
    backgroundColor: colors.bgSurface,
  },
  summaryLoadingText: { fontSize: typography.bodySm.fontSize, color: colors.textDisabled },
  noReportText: {
    fontSize: typography.bodyMd.fontSize, color: colors.textDisabled, marginBottom: spacing.xs,
  },

  // ─── FAB ───────────────────────────────────────────────────
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing['2xl'] + spacing.sm,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md + spacing.xxs,
    paddingVertical: spacing.sm + spacing.xxs,
    borderRadius: spacing['2xl'], gap: spacing.xs,
    ...shadows.high,
  },
  fabPlus: {
    fontSize: typography.headingSm.fontSize, color: colors.white, fontWeight: '600',
  },
  fabLabel: {
    fontSize: typography.caption.fontSize, color: colors.white, fontWeight: '600',
  },
});
