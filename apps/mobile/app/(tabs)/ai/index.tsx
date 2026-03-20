import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

// ─── Types ────────────────────────────────────────────────────

interface Recipient {
  id: string;
  name: string;
}

interface ReportResult {
  id: string;
  recipient_id: string;
  report_type: string;
  status_label: string;
  summary: string;
  reasons: string[];
  suggestions: string[];
  detail: Record<string, unknown>;
  disclaimer: string;
  is_fallback: boolean;
  generated_at: string;
}

interface ChatResult {
  task: string;
  result: Record<string, unknown>;
  disclaimer: string;
  is_fallback: boolean;
}

interface HistoricalReport {
  id: string;
  report_type: string;
  status_label: string;
  summary: string;
  reasons: string[];
  suggestions: string[];
  disclaimer: string;
  generated_at: string;
}

// ─── Constants ────────────────────────────────────────────────

const REPORT_TYPES = [
  { key: 'health_summary', label: '安心報' },
  { key: 'trend_analysis', label: '趨勢說明' },
  { key: 'visit_prep', label: '看診準備' },
  { key: 'family_update', label: '家人摘要' },
] as const;

const CHAT_TASKS = [
  { key: 'trend_explanation', label: '趨勢說明' },
  { key: 'family_update', label: '家人近況' },
  { key: 'visit_questions', label: '看診問題' },
] as const;

// ─── Component ────────────────────────────────────────────────

export default function AiReportScreen() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('health_summary');
  const [showMore, setShowMore] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string>('trend_explanation');

  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [chatResult, setChatResult] = useState<ChatResult | null>(null);
  const [error, setError] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [lastFailedAction, setLastFailedAction] = useState<'report' | 'chat' | null>(null);

  const [history, setHistory] = useState<HistoricalReport[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Fetch recipients
  useEffect(() => {
    void (async () => {
      try {
        const result = await api.get<Recipient[]>('/recipients');
        setRecipients(result);
        if (result[0] && !selectedRecipientId) {
          setSelectedRecipientId(result[0].id);
        }
      } catch {
        // Silent
      }
    })();
  }, [selectedRecipientId]);

  // Fetch history when recipient changes
  const fetchHistory = useCallback(async () => {
    if (!selectedRecipientId) return;
    setHistoryLoading(true);
    try {
      const result = await api.get<HistoricalReport[]>(
        `/ai/reports?recipient_id=${selectedRecipientId}&limit=10`,
      );
      setHistory(result);

      // Auto-load latest health_summary as the current report view
      if (!report && !chatResult) {
        const latestSummary = result.find((r) => r.report_type === 'health_summary');
        if (latestSummary) {
          setReport({
            id: latestSummary.id,
            recipient_id: selectedRecipientId,
            report_type: latestSummary.report_type,
            status_label: latestSummary.status_label,
            summary: latestSummary.summary,
            reasons: latestSummary.reasons,
            suggestions: latestSummary.suggestions,
            detail: {},
            disclaimer: latestSummary.disclaimer,
            is_fallback: false,
            generated_at: latestSummary.generated_at,
          });
        }
      }
    } catch {
      // Non-critical
    } finally {
      setHistoryLoading(false);
      setInitialLoading(false);
    }
  }, [selectedRecipientId, report, chatResult]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  // Reset when switching recipient
  const handleSelectRecipient = (id: string) => {
    setSelectedRecipientId(id);
    setReport(null);
    setChatResult(null);
    setError('');
    setRateLimited(false);
    setLastFailedAction(null);
    setShowMore(false);
    setInitialLoading(true);
  };

  // Generate report
  const handleGenerateReport = async () => {
    if (!selectedRecipientId) return;
    setGenerating(true);
    setError('');
    setRateLimited(false);
    setLastFailedAction(null);
    setReport(null);
    setChatResult(null);
    try {
      const result = await api.post<ReportResult>('/ai/health-report', {
        recipient_id: selectedRecipientId,
        report_type: selectedType,
      });
      setReport(result);
      void fetchHistory();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'AI_RATE_LIMITED') {
          setRateLimited(true);
        } else {
          setError(e.message);
          setLastFailedAction('report');
        }
      } else {
        setError('更新失敗，請稍後再試');
        setLastFailedAction('report');
      }
    } finally {
      setGenerating(false);
    }
  };

  // Generate chat
  const handleGenerateChat = async () => {
    if (!selectedRecipientId) return;
    setGenerating(true);
    setError('');
    setRateLimited(false);
    setLastFailedAction(null);
    setReport(null);
    setChatResult(null);
    try {
      const result = await api.post<ChatResult>('/ai/chat', {
        recipient_id: selectedRecipientId,
        task: selectedTask,
      });
      setChatResult(result);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'AI_RATE_LIMITED') {
          setRateLimited(true);
        } else {
          setError(e.message);
          setLastFailedAction('chat');
        }
      } else {
        setError('更新失敗，請稍後再試');
        setLastFailedAction('chat');
      }
    } finally {
      setGenerating(false);
    }
  };

  // Share
  const handleShare = async (text: string) => {
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(text);
      return;
    }
    await Share.share({ message: text });
  };

  const buildShareText = (): string => {
    const recipientName = recipients.find((r) => r.id === selectedRecipientId)?.name ?? '';

    if (report) {
      const lines = [
        `【${recipientName} ${REPORT_TYPES.find((t) => t.key === report.report_type)?.label ?? report.report_type}】`,
        report.summary,
        '',
        '最近觀察：',
        ...report.reasons.map((r) => `• ${r}`),
        '',
        '溫馨提醒：',
        ...report.suggestions.map((s) => `• ${s}`),
        '',
        report.disclaimer,
      ];
      return lines.join('\n');
    }
    if (chatResult) {
      const result = chatResult.result;
      const parts: string[] = [`【${recipientName} 快問快答】`];
      if (typeof result.explanation === 'string') parts.push(result.explanation);
      if (typeof result.message === 'string') parts.push(result.message);
      if (Array.isArray(result.questions)) {
        parts.push('', '建議問題：');
        (result.questions as string[]).forEach((q) => parts.push(`• ${q}`));
      }
      if (Array.isArray(result.key_points)) {
        parts.push('', '重點：');
        (result.key_points as string[]).forEach((p) => parts.push(`• ${p}`));
      }
      if (Array.isArray(result.highlights)) {
        parts.push('', '重點：');
        (result.highlights as string[]).forEach((h) => parts.push(`• ${h}`));
      }
      parts.push('', chatResult.disclaimer);
      return parts.join('\n');
    }
    return '';
  };

  const selectedRecipientName = recipients.find((r) => r.id === selectedRecipientId)?.name ?? '';

  // ─── Render ──────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Page title */}
      <Text style={styles.pageTitle}>安心報</Text>

      {/* Recipient selector */}
      {recipients.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.selectorRow}
          contentContainerStyle={styles.selectorContent}
        >
          {recipients.map((r) => {
            const isActive = r.id === selectedRecipientId;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => handleSelectRecipient(r.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`選擇 ${r.name}`}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {r.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Initial loading */}
      {initialLoading && (
        <View style={styles.initialLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.initialLoadingText}>載入近況中...</Text>
        </View>
      )}

      {/* Report result — auto-loaded or freshly generated */}
      {!initialLoading && report && (
        <Card style={styles.reportCard}>
          {/* Header: recipient name + AI status */}
          <View style={styles.reportHeader}>
            <Text style={styles.reportRecipientName}>{selectedRecipientName} 的近況</Text>
            <StatusPill status={report.status_label} type="aiHealth" />
          </View>

          {/* Summary */}
          <Text style={styles.reportSummary}>{report.summary}</Text>

          {/* Reasons */}
          {report.reasons.length > 0 && (
            <View style={styles.reportSection}>
              <Text style={styles.reportSectionLabel}>最近觀察</Text>
              {report.reasons.map((r, i) => (
                <Text key={i} style={styles.reportItem}>• {r}</Text>
              ))}
            </View>
          )}

          {/* Suggestions */}
          {report.suggestions.length > 0 && (
            <View style={styles.reportSection}>
              <Text style={styles.reportSectionLabel}>溫馨提醒</Text>
              {report.suggestions.map((s, i) => (
                <Text key={i} style={styles.reportItem}>• {s}</Text>
              ))}
            </View>
          )}

          {/* Fallback note */}
          {report.is_fallback && (
            <Text style={styles.fallbackNote}>（AI 暫時無法回應，以上為預設文字）</Text>
          )}

          {/* Disclaimer — always visible, non-dismissible */}
          <Text style={styles.disclaimer}>{report.disclaimer}</Text>

          {/* Share */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => void handleShare(buildShareText())}
              accessibilityLabel="分享安心報給家人"
            >
              <Text style={styles.shareText}>分享給家人</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* Chat result */}
      {!initialLoading && chatResult && (
        <Card style={styles.reportCard}>
          <Text style={styles.reportRecipientName}>{selectedRecipientName}</Text>

          {typeof chatResult.result.explanation === 'string' && (
            <Text style={styles.reportSummary}>{chatResult.result.explanation}</Text>
          )}
          {typeof chatResult.result.message === 'string' && (
            <Text style={styles.reportSummary}>{chatResult.result.message}</Text>
          )}
          {Array.isArray(chatResult.result.key_points) && (
            <View style={styles.reportSection}>
              <Text style={styles.reportSectionLabel}>重點</Text>
              {(chatResult.result.key_points as string[]).map((p, i) => (
                <Text key={i} style={styles.reportItem}>• {p}</Text>
              ))}
            </View>
          )}
          {Array.isArray(chatResult.result.highlights) && (
            <View style={styles.reportSection}>
              <Text style={styles.reportSectionLabel}>重點</Text>
              {(chatResult.result.highlights as string[]).map((h, i) => (
                <Text key={i} style={styles.reportItem}>• {h}</Text>
              ))}
            </View>
          )}
          {Array.isArray(chatResult.result.questions) && (
            <View style={styles.reportSection}>
              <Text style={styles.reportSectionLabel}>建議問題</Text>
              {(chatResult.result.questions as string[]).map((q, i) => (
                <Text key={i} style={styles.reportItem}>• {q}</Text>
              ))}
            </View>
          )}
          {Array.isArray(chatResult.result.reminders) && (
            <View style={styles.reportSection}>
              <Text style={styles.reportSectionLabel}>提醒</Text>
              {(chatResult.result.reminders as string[]).map((r, i) => (
                <Text key={i} style={styles.reportItem}>• {r}</Text>
              ))}
            </View>
          )}

          {chatResult.is_fallback && (
            <Text style={styles.fallbackNote}>（AI 暫時無法回應，以上為預設文字）</Text>
          )}

          <Text style={styles.disclaimer}>{chatResult.disclaimer}</Text>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => void handleShare(buildShareText())}
              accessibilityLabel="分享快問快答給家人"
            >
              <Text style={styles.shareText}>分享給家人</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* Empty state — no report at all */}
      {!initialLoading && !report && !chatResult && !generating && !error && !rateLimited && (
        <EmptyState
          title="尚無安心報"
          description={`點擊下方「更新近況」，為${selectedRecipientName || '被照護者'}生成第一份安心報。`}
        />
      )}

      {/* Rate limit — info banner, NOT error styling */}
      {rateLimited && (
        <View style={styles.rateLimitBanner}>
          <Text style={styles.rateLimitText}>已達更新上限（每小時 3 次），請稍後再試</Text>
        </View>
      )}

      {/* Error — with retry */}
      {error ? (
        <View style={styles.errorContainer}>
          <ErrorState
            message={error}
            onRetry={() => void (lastFailedAction === 'chat' ? handleGenerateChat() : handleGenerateReport())}
          />
        </View>
      ) : null}

      {/* Generate button */}
      {!initialLoading && (
        <TouchableOpacity
          style={[styles.generateButton, generating && styles.generateButtonDisabled]}
          disabled={generating || !selectedRecipientId}
          onPress={() => void handleGenerateReport()}
          accessibilityRole="button"
          accessibilityLabel={generating ? '正在整理近況' : '更新近況'}
        >
          {generating ? (
            <View style={styles.generatingRow}>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.generateText}>正在整理近況...</Text>
            </View>
          ) : (
            <Text style={styles.generateText}>
              {showMore ? `生成${REPORT_TYPES.find((t) => t.key === selectedType)?.label ?? '報告'}` : '更新近況'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* "More features" expandable section */}
      {!initialLoading && (
        <View style={styles.moreSection}>
          <TouchableOpacity
            style={styles.moreToggle}
            onPress={() => setShowMore(!showMore)}
            accessibilityLabel={showMore ? '收起更多功能' : '展開更多功能'}
          >
            <Text style={styles.moreToggleText}>{showMore ? '收起更多功能' : '更多功能'}</Text>
            <Text style={styles.moreToggleArrow}>{showMore ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showMore && (
            <Card style={styles.moreContent}>
              {/* Report type selector */}
              <Text style={styles.moreSectionLabel}>近況摘要</Text>
              <View style={styles.typeRow}>
                {REPORT_TYPES.map((t) => {
                  const isActive = selectedType === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.typeChip, isActive && styles.typeChipActive]}
                      onPress={() => { setSelectedType(t.key); setChatResult(null); }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={[styles.typeChipText, isActive && styles.typeChipTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Chat task selector */}
              <Text style={styles.moreSectionLabel}>快問快答</Text>
              <View style={styles.typeRow}>
                {CHAT_TASKS.map((t) => {
                  const isActive = selectedTask === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.taskChip, isActive && styles.taskChipActive]}
                      onPress={() => setSelectedTask(t.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={[styles.typeChipText, isActive && styles.taskChipTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[styles.chatButton, generating && styles.generateButtonDisabled]}
                disabled={generating || !selectedRecipientId}
                onPress={() => void handleGenerateChat()}
                accessibilityRole="button"
                accessibilityLabel={generating ? '正在整理' : '快問快答'}
              >
                {generating ? (
                  <View style={styles.generatingRow}>
                    <ActivityIndicator size="small" color={colors.success} />
                    <Text style={styles.chatButtonText}>正在整理...</Text>
                  </View>
                ) : (
                  <Text style={styles.chatButtonText}>快問快答</Text>
                )}
              </TouchableOpacity>
            </Card>
          )}
        </View>
      )}

      {/* History */}
      {!initialLoading && history.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>過去的安心報</Text>
          {historyLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            history.map((h) => (
              <Card key={h.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyType}>
                    {REPORT_TYPES.find((t) => t.key === h.report_type)?.label ?? h.report_type}
                  </Text>
                  <StatusPill status={h.status_label} type="aiHealth" />
                  <Text style={styles.historyDate}>
                    {new Date(h.generated_at).toLocaleDateString('zh-TW')}
                  </Text>
                </View>
                <Text style={styles.historySummary} numberOfLines={2}>
                  {h.summary}
                </Text>
              </Card>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'] + spacing.sm,
  },
  pageTitle: {
    fontSize: typography.headingXl.fontSize,
    fontWeight: typography.headingXl.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },

  // ─── Recipient Selector ───────────────────────────────────
  selectorRow: {
    maxHeight: 44,
    marginBottom: spacing.md,
  },
  selectorContent: {
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurfaceAlt,
  },
  chipActive: {
    backgroundColor: colors.primaryLight,
  },
  chipText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },

  // ─── Initial Loading ──────────────────────────────────────
  initialLoading: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'] + spacing.sm,
    gap: spacing.md,
  },
  initialLoadingText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textDisabled,
  },

  // ─── Report Card ──────────────────────────────────────────
  reportCard: {
    padding: spacing.xl,    // 20px — AI report specific wider padding
    marginBottom: spacing.lg,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  reportRecipientName: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: typography.headingSm.fontWeight,
    color: colors.textSecondary,
  },
  reportSummary: {
    fontSize: typography.bodyLg.fontSize,
    color: colors.textPrimary,
    lineHeight: typography.bodyLg.fontSize * 1.5,
    marginBottom: spacing.md,
  },
  reportSection: {
    marginBottom: spacing.sm + spacing.xxs,
  },
  reportSectionLabel: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  reportItem: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
    lineHeight: typography.bodyMd.fontSize * 1.5 + 1,
  },
  fallbackNote: {
    fontSize: typography.caption.fontSize,
    color: colors.textDisabled,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },

  // ─── Disclaimer ───────────────────────────────────────────
  disclaimer: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    lineHeight: typography.captionSm.fontSize * 1.45,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderDefault,
    paddingTop: spacing.sm + spacing.xxs,
    marginTop: spacing.sm + spacing.xxs,
  },

  // ─── Share Action ─────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  shareButton: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + spacing.xxs,
    alignItems: 'center',
  },
  shareText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.primaryText,
  },

  // ─── Rate Limit Banner ────────────────────────────────────
  rateLimitBanner: {
    backgroundColor: colors.infoLight,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  rateLimitText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.primaryText,
    textAlign: 'center',
  },

  // ─── Error ────────────────────────────────────────────────
  errorContainer: {
    marginBottom: spacing.md,
  },

  // ─── Generate Button ──────────────────────────────────────
  generateButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg - spacing.xxs,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateText: {
    color: colors.white,
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // ─── More Features Section ────────────────────────────────
  moreSection: {
    marginBottom: spacing.lg,
  },
  moreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  moreToggleText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textTertiary,
  },
  moreToggleArrow: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
  },
  moreContent: {
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  moreSectionLabel: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeChip: {
    paddingHorizontal: spacing.lg - spacing.xxs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bgSurfaceAlt,
  },
  typeChipActive: {
    backgroundColor: colors.primaryLight,
  },
  typeChipText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textSecondary,
  },
  typeChipTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  taskChip: {
    paddingHorizontal: spacing.lg - spacing.xxs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bgSurfaceAlt,
  },
  taskChipActive: {
    backgroundColor: colors.successLight,
  },
  taskChipTextActive: {
    color: colors.success,
    fontWeight: '600',
  },
  chatButton: {
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  chatButtonText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.success,
  },

  // ─── History Section ──────────────────────────────────────
  historySection: {
    marginTop: spacing.sm,
  },
  historyTitle: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: typography.headingSm.fontWeight,
    color: colors.textSecondary,
    marginBottom: spacing.sm + spacing.xxs,
  },
  historyCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  historyType: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  historyDate: {
    fontSize: typography.caption.fontSize,
    color: colors.textDisabled,
    marginLeft: 'auto',
  },
  historySummary: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
    lineHeight: typography.bodySm.fontSize * 1.5 + 1,
  },
});
