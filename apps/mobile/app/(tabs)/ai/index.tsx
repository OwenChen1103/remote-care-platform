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

const DEFAULT_STATUS = { bg: '#dcfce7', text: '#166534', label: '穩定' };

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  stable: DEFAULT_STATUS,
  attention: { bg: '#fef9c3', text: '#854d0e', label: '需注意' },
  consult_doctor: { bg: '#fee2e2', text: '#991b1b', label: '建議就醫' },
};

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
    setShowMore(false);
    setInitialLoading(true);
  };

  // Generate report
  const handleGenerateReport = async () => {
    if (!selectedRecipientId) return;
    setGenerating(true);
    setError('');
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
          setError('已達到更新上限，請稍後再試');
        } else {
          setError(e.message);
        }
      } else {
        setError('更新失敗，請稍後再試');
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
          setError('已達到問答上限，請稍後再試');
        } else {
          setError(e.message);
        }
      } else {
        setError('更新失敗，請稍後再試');
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Page title */}
      <Text style={styles.pageTitle}>安心報</Text>

      {/* Recipient selector */}
      {recipients.length > 1 && (
        <ScrollView horizontal style={styles.selectorRow} contentContainerStyle={styles.selectorContent}>
          {recipients.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.chip, r.id === selectedRecipientId && styles.chipActive]}
              onPress={() => handleSelectRecipient(r.id)}
            >
              <Text style={[styles.chipText, r.id === selectedRecipientId && styles.chipTextActive]}>
                {r.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Initial loading */}
      {initialLoading && (
        <View style={styles.initialLoading}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.initialLoadingText}>載入近況中...</Text>
        </View>
      )}

      {/* Report result — auto-loaded or freshly generated */}
      {!initialLoading && report && (
        <View style={styles.resultCard}>
          {/* Recipient name + status */}
          <View style={styles.resultHeader}>
            <Text style={styles.resultRecipientName}>{selectedRecipientName} 的近況</Text>
            {(() => {
              const sc = STATUS_COLORS[report.status_label] ?? DEFAULT_STATUS;
              return (
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
                </View>
              );
            })()}
          </View>

          <Text style={styles.resultSummary}>{report.summary}</Text>

          {report.reasons.length > 0 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>最近觀察</Text>
              {report.reasons.map((r, i) => (
                <Text key={i} style={styles.resultItem}>• {r}</Text>
              ))}
            </View>
          )}

          {report.suggestions.length > 0 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>溫馨提醒</Text>
              {report.suggestions.map((s, i) => (
                <Text key={i} style={styles.resultItem}>• {s}</Text>
              ))}
            </View>
          )}

          {report.is_fallback && (
            <Text style={styles.fallbackNote}>（AI 暫時無法回應，以上為預設文字）</Text>
          )}

          <Text style={styles.disclaimer}>{report.disclaimer}</Text>

          {/* Action row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => void handleShare(buildShareText())}
            >
              <Text style={styles.shareText}>分享給家人</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Chat result */}
      {!initialLoading && chatResult && (
        <View style={styles.resultCard}>
          <Text style={styles.resultRecipientName}>{selectedRecipientName}</Text>

          {typeof chatResult.result.explanation === 'string' && (
            <Text style={styles.resultSummary}>{chatResult.result.explanation}</Text>
          )}
          {typeof chatResult.result.message === 'string' && (
            <Text style={styles.resultSummary}>{chatResult.result.message}</Text>
          )}
          {Array.isArray(chatResult.result.key_points) && (
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>重點</Text>
              {(chatResult.result.key_points as string[]).map((p, i) => (
                <Text key={i} style={styles.resultItem}>• {p}</Text>
              ))}
            </View>
          )}
          {Array.isArray(chatResult.result.highlights) && (
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>重點</Text>
              {(chatResult.result.highlights as string[]).map((h, i) => (
                <Text key={i} style={styles.resultItem}>• {h}</Text>
              ))}
            </View>
          )}
          {Array.isArray(chatResult.result.questions) && (
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>建議問題</Text>
              {(chatResult.result.questions as string[]).map((q, i) => (
                <Text key={i} style={styles.resultItem}>• {q}</Text>
              ))}
            </View>
          )}
          {Array.isArray(chatResult.result.reminders) && (
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>提醒</Text>
              {(chatResult.result.reminders as string[]).map((r, i) => (
                <Text key={i} style={styles.resultItem}>• {r}</Text>
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
            >
              <Text style={styles.shareText}>分享給家人</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Empty state — no report at all */}
      {!initialLoading && !report && !chatResult && !generating && !error && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>尚無安心報</Text>
          <Text style={styles.emptyDesc}>點擊下方「更新近況」，為{selectedRecipientName || '被照護者'}生成第一份安心報。</Text>
        </View>
      )}

      {/* Error */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Update button — always visible & prominent */}
      {!initialLoading && (
        <TouchableOpacity
          style={[styles.generateButton, generating && styles.generateButtonDisabled]}
          disabled={generating || !selectedRecipientId}
          onPress={() => void (showMore ? (selectedType !== 'health_summary' ? handleGenerateReport() : handleGenerateReport()) : handleGenerateReport())}
        >
          {generating ? (
            <View style={styles.generatingRow}>
              <ActivityIndicator size="small" color="#fff" />
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
          >
            <Text style={styles.moreToggleText}>{showMore ? '收起更多功能' : '更多功能'}</Text>
            <Text style={styles.moreToggleArrow}>{showMore ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showMore && (
            <View style={styles.moreContent}>
              {/* Report type selector */}
              <Text style={styles.moreSectionLabel}>近況摘要</Text>
              <View style={styles.typeRow}>
                {REPORT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.typeChip, selectedType === t.key && styles.typeChipActive]}
                    onPress={() => { setSelectedType(t.key); setChatResult(null); }}
                  >
                    <Text style={[styles.typeText, selectedType === t.key && styles.typeTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Chat task selector */}
              <Text style={styles.moreSectionLabel}>快問快答</Text>
              <View style={styles.typeRow}>
                {CHAT_TASKS.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.taskChip, selectedTask === t.key && styles.taskChipActive]}
                    onPress={() => setSelectedTask(t.key)}
                  >
                    <Text style={[styles.typeText, selectedTask === t.key && styles.taskTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.chatButton, generating && styles.generateButtonDisabled]}
                disabled={generating || !selectedRecipientId}
                onPress={() => void handleGenerateChat()}
              >
                {generating ? (
                  <View style={styles.generatingRow}>
                    <ActivityIndicator size="small" color="#3b82f6" />
                    <Text style={styles.chatButtonText}>正在整理...</Text>
                  </View>
                ) : (
                  <Text style={styles.chatButtonText}>快問快答</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* History */}
      {!initialLoading && history.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>過去的安心報</Text>
          {historyLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            history.map((h) => {
              const sc = STATUS_COLORS[h.status_label] ?? DEFAULT_STATUS;
              return (
                <View key={h.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyType}>
                      {REPORT_TYPES.find((t) => t.key === h.report_type)?.label ?? h.report_type}
                    </Text>
                    <View style={[styles.historyBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.historyBadgeText, { color: sc.text }]}>{sc.label}</Text>
                    </View>
                    <Text style={styles.historyDate}>
                      {new Date(h.generated_at).toLocaleDateString('zh-TW')}
                    </Text>
                  </View>
                  <Text style={styles.historySummary} numberOfLines={2}>
                    {h.summary}
                  </Text>
                </View>
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 },

  selectorRow: { maxHeight: 44, marginBottom: 12 },
  selectorContent: { gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#3b82f6' },
  chipText: { fontSize: 14, color: '#374151' },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  initialLoading: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  initialLoadingText: { fontSize: 14, color: '#9ca3af' },

  resultCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  resultRecipientName: { fontSize: 16, fontWeight: '600', color: '#374151' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 13, fontWeight: '600' },
  resultSummary: { fontSize: 16, color: '#1f2937', lineHeight: 24, marginBottom: 12 },
  resultSection: { marginBottom: 10 },
  resultLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  resultItem: { fontSize: 14, color: '#374151', lineHeight: 22 },
  fallbackNote: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic', marginBottom: 8 },

  disclaimer: {
    fontSize: 11, color: '#9ca3af', lineHeight: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb',
    paddingTop: 10, marginTop: 10,
  },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  shareButton: {
    flex: 1, backgroundColor: '#dbeafe', borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  shareText: { fontSize: 14, fontWeight: '600', color: '#1d4ed8' },

  emptyCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 24, marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 6 },
  emptyDesc: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 21 },

  generateButton: {
    backgroundColor: '#3b82f6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  generateButtonDisabled: { opacity: 0.6 },
  generateText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  errorText: {
    fontSize: 14, color: '#dc2626', backgroundColor: '#fef2f2',
    padding: 12, borderRadius: 8, textAlign: 'center', marginBottom: 12, overflow: 'hidden',
  },

  moreSection: { marginBottom: 16 },
  moreToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 6 },
  moreToggleText: { fontSize: 14, color: '#6b7280' },
  moreToggleArrow: { fontSize: 10, color: '#9ca3af' },
  moreContent: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  moreSectionLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  typeChipActive: { backgroundColor: '#dbeafe' },
  typeText: { fontSize: 13, color: '#374151' },
  typeTextActive: { color: '#1d4ed8', fontWeight: '600' },
  taskChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  taskChipActive: { backgroundColor: '#f0fdf4' },
  taskTextActive: { color: '#166534', fontWeight: '600' },
  chatButton: {
    backgroundColor: '#f0fdf4', borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0',
    paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  chatButtonText: { fontSize: 14, fontWeight: '600', color: '#166534' },

  historySection: { marginTop: 8 },
  historyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 10 },
  historyCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  historyType: { fontSize: 13, fontWeight: '600', color: '#374151' },
  historyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  historyBadgeText: { fontSize: 11, fontWeight: '600' },
  historyDate: { fontSize: 12, color: '#9ca3af', marginLeft: 'auto' },
  historySummary: { fontSize: 13, color: '#6b7280', lineHeight: 20 },
});
