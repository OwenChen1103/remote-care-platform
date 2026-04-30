import { useEffect, useState, useCallback, useRef } from 'react';
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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

// Status color mapping for hero card tints
const STATUS_TINT: Record<string, { halo: string; gradientStart: string; gradientEnd: string }> = {
  stable: {
    halo: 'rgba(93,169,69,0.35)',
    gradientStart: '#EDF7E8',
    gradientEnd: '#F8FAFC',
  },
  attention: {
    halo: 'rgba(232,162,59,0.30)',
    gradientStart: '#FEF3D9',
    gradientEnd: '#F8FAFC',
  },
  consult_doctor: {
    halo: 'rgba(217,83,79,0.25)',
    gradientStart: '#FDECEA',
    gradientEnd: '#F8FAFC',
  },
};

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

  const scrollRef = useRef<ScrollView>(null);

  // Load a historical report into the hero card (replaces current report)
  const loadHistoricalReport = useCallback((h: HistoricalReport) => {
    if (!selectedRecipientId) return;
    setReport({
      ...h,
      recipient_id: selectedRecipientId,
      detail: {},
      is_fallback: false,
    });
    setSelectedType(h.report_type);
    setError('');
    setRateLimited(false);
    // Scroll to top so user sees the loaded hero card
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [selectedRecipientId]);

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

  // Fetch history when recipient changes; auto-load latest matching report
  const fetchHistory = useCallback(async () => {
    if (!selectedRecipientId) return;
    setHistoryLoading(true);
    // Clear old content immediately so user sees loading state, not stale data
    setReport(null);
    setChatResult(null);
    setError('');
    setRateLimited(false);
    try {
      const result = await api.get<HistoricalReport[]>(
        `/ai/reports?recipient_id=${selectedRecipientId}&limit=10`,
      );
      setHistory(result);
      // Auto-load the latest report of currently selected type as the displayed report
      const latestForType = result.find((r) => r.report_type === selectedType);
      if (latestForType && mode === 'report') {
        setReport({
          ...latestForType,
          recipient_id: selectedRecipientId,
          detail: {},
          is_fallback: false,
        });
      }
    } catch {
      // Non-critical
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedRecipientId, selectedType, mode]);

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

  function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const handleDownloadPdf = async () => {
    if (!report) return;
    const recipientName = recipients.find((r) => r.id === selectedRecipientId)?.name ?? '';
    const typeLabel = REPORT_TYPES.find((t) => t.key === report.report_type)?.label ?? report.report_type;
    const statusLabel = report.status_label === 'stable' ? '穩定'
      : report.status_label === 'attention' ? '需留意' : '建議就醫';
    const statusColor = report.status_label === 'stable' ? colors.success
      : report.status_label === 'attention' ? colors.warning : colors.danger;

    const html = `
      <html>
      <head><meta charset="utf-8"><style>
        body { font-family: sans-serif; padding: 32px; color: #111827; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .subtitle { color: #6B7280; font-size: 13px; margin-bottom: 20px; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 14px; color: ${statusColor}; background: ${statusColor}18; }
        .summary { font-size: 16px; margin: 16px 0; line-height: 1.6; }
        .section-title { font-size: 14px; font-weight: 600; color: #374151; margin-top: 16px; margin-bottom: 8px; }
        .item { font-size: 14px; color: #374151; margin-bottom: 4px; line-height: 1.5; }
        .disclaimer { margin-top: 24px; padding: 12px; background: #F3F4F6; border-radius: 8px; font-size: 12px; color: #6B7280; line-height: 1.5; }
        .footer { margin-top: 24px; font-size: 11px; color: #9CA3AF; text-align: center; }
      </style></head>
      <body>
        <h1>${escHtml(typeLabel)}</h1>
        <p class="subtitle">${escHtml(recipientName)} · ${new Date(report.generated_at).toLocaleDateString('zh-TW')}</p>
        <span class="status">${escHtml(statusLabel)}</span>
        <p class="summary">${escHtml(report.summary)}</p>
        ${report.reasons.length > 0 ? `
          <p class="section-title">原因</p>
          ${report.reasons.map((r) => `<p class="item">• ${escHtml(r)}</p>`).join('')}
        ` : ''}
        ${report.suggestions.length > 0 ? `
          <p class="section-title">建議</p>
          ${report.suggestions.map((s) => `<p class="item">• ${escHtml(s)}</p>`).join('')}
        ` : ''}
        <div class="disclaimer">${escHtml(report.disclaimer)}</div>
        <p class="footer">由遠端照護平台產生</p>
      </body></html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch {
      // Fall back to text share if PDF generation fails
      void handleShare(buildShareText());
    }
  };

  // ─── Render ──────────────────────────────────────────────────

  const tint = report ? (STATUS_TINT[report.status_label] ?? STATUS_TINT.stable!) : STATUS_TINT.stable!;
  const recipientName = recipients.find((r) => r.id === selectedRecipientId)?.name ?? '';
  const reportTypeLabel = REPORT_TYPES.find((t) => t.key === selectedType)?.label ?? '';

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Recipient selector (page title is in nav) ───────── */}
      {recipients.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipientChips}>
          {recipients.map((r) => {
            const isActive = r.id === selectedRecipientId;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.recipientChip, isActive && styles.recipientChipActive]}
                onPress={() => setSelectedRecipientId(r.id)}
              >
                <Text style={[styles.recipientChipText, isActive && styles.recipientChipTextActive]}>
                  {r.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Hero Report Card ──────────────────────────────────── */}
      {report && (
        <View style={styles.heroCard}>
          <LinearGradient
            colors={[tint.gradientStart, tint.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroHaloTopRight, { backgroundColor: tint.halo }]} />
          <View style={[styles.heroHaloBottomLeft, { backgroundColor: 'rgba(255,255,255,0.6)' }]} />
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

          <View style={styles.heroContent}>
            <View style={styles.heroStatusRow}>
              <StatusPill status={report.status_label} type="aiHealth" />
              <Text style={styles.heroTimestamp}>
                {new Date(report.generated_at).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })} 生成
              </Text>
            </View>

            <Text style={styles.heroName}>{recipientName}</Text>
            <Text style={styles.heroType}>{reportTypeLabel}</Text>
            <Text style={styles.heroSummary}>{report.summary}</Text>

            {report.reasons.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>觀察重點</Text>
                {report.reasons.map((r, i) => (
                  <View key={i} style={styles.bulletItem}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{r}</Text>
                  </View>
                ))}
              </View>
            )}

            {report.suggestions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>照護建議</Text>
                {report.suggestions.map((s, i) => (
                  <View key={i} style={styles.bulletItem}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginTop: 4 }}>
                      <Path d="M5 12h14M13 6l6 6-6 6" stroke={colors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={[styles.bulletText, { marginLeft: 10 }]}>{s}</Text>
                  </View>
                ))}
              </View>
            )}

            {report.is_fallback && (
              <Text style={styles.fallbackNote}>（AI 暫時無法回應，以上為預設文字）</Text>
            )}

            <Text style={styles.disclaimer}>{report.disclaimer}</Text>

            <View style={styles.actionRow}>
              {Platform.OS !== 'web' && (
                <TouchableOpacity
                  style={styles.actionPrimary}
                  onPress={() => void handleDownloadPdf()}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionPrimaryInner}
                  >
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={colors.white} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.actionPrimaryText}>下載 PDF</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionSecondary}
                onPress={() => void handleShare(buildShareText())}
                activeOpacity={0.7}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke={colors.primaryText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.actionSecondaryText}>分享</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Loading (fetching latest report) */}
      {historyLoading && !report && !generating && (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>正在載入最新報告...</Text>
        </View>
      )}

      {/* Generating (creating new report) */}
      {generating && !report && (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>AI 正在分析中...</Text>
          <Text style={styles.loadingSub}>請稍候，即將完成</Text>
        </View>
      )}

      {/* Empty (no loading, no report) */}
      {!report && !generating && !historyLoading && !error && !rateLimited && (
        <View style={styles.emptyWrap}>
          <EmptyState title="尚無報告" description="選擇下方類型，點擊「生成報告」開始。" />
        </View>
      )}
      {error ? (
        <View style={styles.errorContainer}>
          <ErrorState
            message={error}
            onRetry={() => void handleGenerateReport()}
          />
        </View>
      ) : null}
      {rateLimited && (
        <View style={styles.rateLimitBanner}>
          <Text style={styles.rateLimitText}>已達到報告生成上限，請稍後再試</Text>
        </View>
      )}

      {/* ── Control Toolbar ──────────────────────────────────── */}
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>選擇報告類型</Text>

        <View style={styles.typeRow}>
          {REPORT_TYPES.map((t) => {
            const isActive = selectedType === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeChip, isActive && styles.typeChipActive]}
                onPress={() => setSelectedType(t.key)}
              >
                <Text style={[styles.typeChipText, isActive && styles.typeChipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.generateWrap, generating && styles.generateButtonDisabled]}
          disabled={generating || !selectedRecipientId}
          onPress={() => void handleGenerateReport()}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[colors.primary, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.generateButton}
          >
            {generating ? (
              <View style={styles.generatingRow}>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={styles.generateText}>AI 正在分析中...</Text>
              </View>
            ) : (
              <Text style={styles.generateText}>
                {report ? '重新生成報告' : '生成報告'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── History ──────────────────────────────────────────── */}
      {history.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>歷史報告</Text>
          {historyLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            history.map((h) => {
              const date = new Date(h.generated_at);
              const isCurrent = report?.id === h.id;
              return (
                <TouchableOpacity
                  key={h.id}
                  style={[styles.historyCard, isCurrent && styles.historyCardActive]}
                  onPress={() => loadHistoricalReport(h)}
                  activeOpacity={0.7}
                  accessibilityLabel={`查看 ${date.toLocaleDateString('zh-TW')} 的報告`}
                >
                  <View style={styles.historyDateCol}>
                    <Text style={styles.historyDay}>{date.getDate()}</Text>
                    <Text style={styles.historyMonth}>{date.getMonth() + 1}月</Text>
                  </View>
                  <View style={styles.historyDivider} />
                  <View style={styles.historyContent}>
                    <View style={styles.historyTopRow}>
                      <Text style={styles.historyType}>
                        {REPORT_TYPES.find((t) => t.key === h.report_type)?.label ?? h.report_type}
                      </Text>
                      <StatusPill status={h.status_label} type="aiHealth" />
                    </View>
                    <Text style={styles.historySummary} numberOfLines={2}>{h.summary}</Text>
                  </View>
                  <Text style={styles.historyArrow}>›</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}


// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] + spacing.sm, gap: spacing.md },

  // ─── Compact Header ──────────────────────────────────────
  header: { gap: spacing.sm, marginBottom: spacing.xs },
  pageTitle: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  recipientChips: { gap: spacing.sm, paddingVertical: 2 },
  recipientChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderDefault,
  },
  recipientChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary, borderWidth: 1.5 },
  recipientChipText: { fontSize: typography.bodySm.fontSize, color: colors.textSecondary, fontWeight: '500' },
  recipientChipTextActive: { color: colors.primaryText, fontWeight: '700' },

  // ─── Hero Report Card ────────────────────────────────────
  heroCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(46,141,201,0.12)',
    position: 'relative',
  },
  heroHaloTopRight: {
    position: 'absolute',
    top: -60, right: -60,
    width: 200, height: 200,
    borderRadius: 100,
  },
  heroHaloBottomLeft: {
    position: 'absolute',
    bottom: -50, left: -50,
    width: 170, height: 170,
    borderRadius: 85,
  },
  heroContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  heroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTimestamp: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  heroName: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  heroType: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '600',
    color: colors.primary,
    marginTop: -spacing.xs - 2,
  },
  heroSummary: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
    lineHeight: 24,
    marginTop: spacing.xs,
  },

  // ─── Sections (reasons / suggestions) ────────────────────
  section: { gap: spacing.xs, marginTop: spacing.xs },
  sectionLabel: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '700',
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  bulletDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: colors.primary,
    marginTop: 8,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: typography.bodySm.fontSize,
    color: colors.textSecondary,
    lineHeight: 21,
  },

  // ─── Notes ───────────────────────────────────────────────
  fallbackNote: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  disclaimer: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    lineHeight: 16,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    marginTop: spacing.sm,
  },

  // ─── Action Buttons ──────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionPrimary: {
    flex: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  actionPrimaryInner: {
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  actionPrimaryText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actionSecondary: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1, borderColor: 'rgba(46,141,201,0.2)',
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  actionSecondaryText: {
    color: colors.primaryText,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
  },

  // ─── Chat Card ───────────────────────────────────────────
  chatCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 24,
    padding: spacing.xl,
    borderWidth: 1, borderColor: colors.borderDefault,
    gap: spacing.md,
  },

  // ─── Loading Card ────────────────────────────────────────
  loadingCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 24,
    borderWidth: 1, borderColor: colors.borderDefault,
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  loadingSub: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    marginTop: -spacing.xs,
  },

  // ─── Empty / Error / Rate ────────────────────────────────
  emptyWrap: { paddingVertical: spacing['3xl'] },
  errorContainer: {},
  rateLimitBanner: {
    backgroundColor: colors.infoLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    borderWidth: 1, borderColor: 'rgba(46,141,201,0.15)',
    alignItems: 'center',
  },
  rateLimitText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.primaryText,
    textAlign: 'center',
  },

  // ─── Toolbar ─────────────────────────────────────────────
  toolbar: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
    gap: spacing.md,
  },
  toolbarTitle: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
  },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modeTab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.bgSurfaceAlt,
    alignItems: 'center',
  },
  modeTabActive: { backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary },
  modeTabText: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  modeTabTextActive: { color: colors.primaryText, fontWeight: '700' },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderDefault,
  },
  typeChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  typeChipText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textSecondary,
  },
  typeChipTextActive: { color: colors.primaryText, fontWeight: '700' },

  generateWrap: {
    borderRadius: radius.full,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
    marginTop: spacing.xs,
  },
  generateButton: {
    paddingVertical: spacing.md + 2,
    alignItems: 'center', justifyContent: 'center',
  },
  generateButtonDisabled: { opacity: 0.6 },
  generateText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    letterSpacing: 1,
  },
  generatingRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },

  // ─── History ─────────────────────────────────────────────
  historySection: { gap: spacing.sm, marginTop: spacing.xs },
  historyTitle: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  historyCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 18,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  historyCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  historyArrow: {
    fontSize: 24,
    color: colors.borderStrong,
    fontWeight: '300',
    marginLeft: spacing.xs,
  },
  historyDateCol: { width: 44, alignItems: 'center' },
  historyDay: {
    fontSize: 22, fontWeight: '700', color: colors.primaryText,
    lineHeight: 24,
  },
  historyMonth: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    marginTop: 2,
  },
  historyDivider: { width: 1, height: 36, backgroundColor: colors.borderDefault },
  historyContent: { flex: 1, gap: 4 },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  historyType: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historySummary: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    lineHeight: 17,
  },
});
