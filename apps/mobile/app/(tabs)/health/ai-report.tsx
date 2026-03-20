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

// ─── Constants (B-05 specific labels) ─────────────────────────

const REPORT_TYPES = [
  { key: 'health_summary', label: '放心報' },
  { key: 'trend_analysis', label: '趨勢解讀' },
  { key: 'visit_prep', label: '看診問題' },
  { key: 'family_update', label: '家人摘要' },
] as const;

const CHAT_TASKS = [
  { key: 'trend_explanation', label: '趨勢解讀' },
  { key: 'family_update', label: '家人近況' },
  { key: 'visit_questions', label: '看診問題' },
] as const;

// ─── Component ────────────────────────────────────────────────

export default function AiReportScreen() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('health_summary');
  const [mode, setMode] = useState<'report' | 'chat'>('report');
  const [selectedTask, setSelectedTask] = useState<string>('trend_explanation');

  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [chatResult, setChatResult] = useState<ChatResult | null>(null);
  const [error, setError] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [lastFailedAction, setLastFailedAction] = useState<'report' | 'chat' | null>(null);

  const [history, setHistory] = useState<HistoricalReport[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
        // Silent — recipients should already be loaded elsewhere
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
    } catch {
      // Non-critical
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedRecipientId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

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
        setError('生成失敗，請稍後再試');
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
        setError('生成失敗，請稍後再試');
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
    if (report) {
      const lines = [
        `【${REPORT_TYPES.find((t) => t.key === report.report_type)?.label ?? report.report_type}】`,
        report.summary,
        '',
        '原因：',
        ...report.reasons.map((r) => `• ${r}`),
        '',
        '建議：',
        ...report.suggestions.map((s) => `• ${s}`),
        '',
        report.disclaimer,
      ];
      return lines.join('\n');
    }
    if (chatResult) {
      const result = chatResult.result;
      const parts: string[] = [];
      if (typeof result.explanation === 'string') parts.push(result.explanation);
      if (typeof result.message === 'string') parts.push(result.message);
      if (Array.isArray(result.questions)) {
        parts.push('建議問題：');
        (result.questions as string[]).forEach((q) => parts.push(`• ${q}`));
      }
      if (Array.isArray(result.key_points)) {
        parts.push('重點：');
        (result.key_points as string[]).forEach((p) => parts.push(`• ${p}`));
      }
      if (Array.isArray(result.highlights)) {
        parts.push('重點：');
        (result.highlights as string[]).forEach((h) => parts.push(`• ${h}`));
      }
      parts.push('', chatResult.disclaimer);
      return parts.join('\n');
    }
    return '';
  };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Page title */}
      <Text style={styles.pageTitle}>AI 放心報</Text>

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
                onPress={() => setSelectedRecipientId(r.id)}
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

      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'report' && styles.modeActive]}
          onPress={() => setMode('report')}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'report' }}
        >
          <Text style={[styles.modeText, mode === 'report' && styles.modeTextActive]}>報告</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'chat' && styles.modeActive]}
          onPress={() => setMode('chat')}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'chat' }}
        >
          <Text style={[styles.modeText, mode === 'chat' && styles.modeTextActive]}>快速問答</Text>
        </TouchableOpacity>
      </View>

      {/* Report type / Chat task selector */}
      {mode === 'report' ? (
        <View style={styles.typeRow}>
          {REPORT_TYPES.map((t) => {
            const isActive = selectedType === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeChip, isActive && styles.typeChipActive]}
                onPress={() => setSelectedType(t.key)}
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
      ) : (
        <View style={styles.typeRow}>
          {CHAT_TASKS.map((t) => {
            const isActive = selectedTask === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeChip, isActive && styles.typeChipActive]}
                onPress={() => setSelectedTask(t.key)}
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
      )}

      {/* Generate button */}
      <TouchableOpacity
        style={[styles.generateButton, generating && styles.generateButtonDisabled]}
        disabled={generating || !selectedRecipientId}
        onPress={() => void (mode === 'report' ? handleGenerateReport() : handleGenerateChat())}
        accessibilityRole="button"
        accessibilityLabel={generating ? 'AI 正在分析中' : (mode === 'report' ? '生成報告' : '生成')}
      >
        {generating ? (
          <View style={styles.generatingRow}>
            <ActivityIndicator size="small" color={colors.white} />
            <Text style={styles.generateText}>AI 正在分析中...</Text>
          </View>
        ) : (
          <Text style={styles.generateText}>
            {mode === 'report' ? '生成報告' : '生成'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Rate limit — info banner, NOT error styling */}
      {rateLimited && (
        <View style={styles.rateLimitBanner}>
          <Text style={styles.rateLimitText}>
            {mode === 'report' ? '已達到報告生成上限，請稍後再試' : '已達到 AI 對話上限，請稍後再試'}
          </Text>
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

      {/* Empty state */}
      {!report && !chatResult && !generating && !error && !rateLimited && (
        <EmptyState
          title="尚無報告"
          description="選擇報告類型後，點擊「生成報告」開始。"
        />
      )}

      {/* Report result */}
      {report && (
        <Card style={styles.reportCard}>
          {/* Status pill */}
          <View style={styles.reportStatusRow}>
            <StatusPill status={report.status_label} type="aiHealth" />
          </View>

          {/* Summary */}
          <Text style={styles.reportSummary}>{report.summary}</Text>

          {/* Reasons */}
          {report.reasons.length > 0 && (
            <View style={styles.reportSection}>
              <Text style={styles.reportSectionLabel}>原因</Text>
              {report.reasons.map((r, i) => (
                <Text key={i} style={styles.reportItem}>• {r}</Text>
              ))}
            </View>
          )}

          {/* Suggestions */}
          {report.suggestions.length > 0 && (
            <View style={styles.reportSection}>
              <Text style={styles.reportSectionLabel}>建議</Text>
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
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => void handleShare(buildShareText())}
            accessibilityLabel="分享報告"
          >
            <Text style={styles.shareText}>分享</Text>
          </TouchableOpacity>
        </Card>
      )}

      {/* Chat result */}
      {chatResult && (
        <Card style={styles.reportCard}>
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

          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => void handleShare(buildShareText())}
            accessibilityLabel="分享問答結果"
          >
            <Text style={styles.shareText}>分享</Text>
          </TouchableOpacity>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>歷史報告</Text>
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

  // ─── Mode Toggle ──────────────────────────────────────────
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm + spacing.xxs,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSurfaceAlt,
    alignItems: 'center',
  },
  modeActive: {
    backgroundColor: colors.primaryLight,
  },
  modeText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeTextActive: {
    color: colors.primaryText,
  },

  // ─── Type / Task Chips ────────────────────────────────────
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
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

  // ─── Report Card ──────────────────────────────────────────
  reportCard: {
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  reportStatusRow: {
    marginBottom: spacing.sm + spacing.xxs,
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

  // ─── Share Button ─────────────────────────────────────────
  shareButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + spacing.xxs,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  shareText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.primaryText,
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
