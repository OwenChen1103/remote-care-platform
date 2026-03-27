import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Share,
  Platform,
  Keyboard,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { ErrorState } from '@/components/ui/ErrorState';

// ─── Types ────────────────────────────────────────────────────

interface Recipient { id: string; name: string }

interface ReportResult {
  id: string; recipient_id: string; report_type: string; status_label: string;
  summary: string; reasons: string[]; suggestions: string[];
  detail: Record<string, unknown>; disclaimer: string; is_fallback: boolean; generated_at: string;
}

interface AssistantResult {
  user_message: string; routed_task: string | null;
  routed_kind: 'report' | 'chat' | 'unsupported';
  confidence: 'high' | 'medium' | 'low';
  result: Record<string, unknown> | null; guidance: string | null;
  disclaimer: string; is_fallback: boolean;
}

interface HistoricalReport {
  id: string; report_type: string; status_label: string; summary: string; generated_at: string;
}

interface InteractionRecord {
  id: string; user_message: string; routed_task: string; created_at: string;
}

interface FollowUpSession {
  userMessage: string; routedTask: string; responseSummary: string; depth: number;
}

// ─── Constants ────────────────────────────────────────────────

const MAX_FOLLOWUP_DEPTH = 2;

const SUGGESTED_TASKS = [
  { key: 'health_summary', label: '整理近況安心報', kind: 'report' as const },
  { key: 'trend_analysis', label: '解讀健康趨勢', kind: 'report' as const },
  { key: 'visit_prep', label: '準備看診清單', kind: 'report' as const },
  { key: 'family_update', label: '寫給家人的摘要', kind: 'report' as const },
  { key: 'trend_explanation', label: '用白話說趨勢', kind: 'chat' as const },
  { key: 'visit_questions', label: '看診該問什麼', kind: 'chat' as const },
] as const;

const TASK_LABELS: Record<string, string> = {
  health_summary: '安心報', trend_analysis: '趨勢解讀', visit_prep: '看診準備',
  family_update: '家人摘要', trend_explanation: '趨勢說明', visit_questions: '看診問題',
};

const FOLLOWUP_CHIPS: Record<string, string[]> = {
  health_summary: ['趨勢有什麼變化？', '需要準備看診嗎？'],
  trend_analysis: ['需要特別注意什麼？', '幫我整理給家人看'],
  visit_prep: ['還有什麼該問醫師的？', '幫我看看近況'],
  family_update: ['最近趨勢怎麼樣？', '需要留意什麼嗎？'],
  trend_explanation: ['要準備看診嗎？', '幫我整理一份安心報'],
  visit_questions: ['最近趨勢如何？', '幫我整理給家人看'],
};

function extractResponseSummary(result: Record<string, unknown>): string {
  for (const c of [result.summary, result.explanation, result.health_update, result.message]) {
    if (typeof c === 'string' && c.length > 0) return c.length > 200 ? c.slice(0, 197) + '...' : c;
  }
  return '';
}

// ─── Component ────────────────────────────────────────────────

export default function AiAssistantScreen() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [assistantResult, setAssistantResult] = useState<AssistantResult | null>(null);
  const [error, setError] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [freeText, setFreeText] = useState('');

  const followUpRef = useRef<FollowUpSession | null>(null);
  const [followUpDepth, setFollowUpDepth] = useState(0);

  const [reportHistory, setReportHistory] = useState<HistoricalReport[]>([]);
  const [interactionHistory, setInteractionHistory] = useState<InteractionRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // ─── Helpers ────────────────────────────────────────────────

  const clearFollowUp = useCallback(() => { followUpRef.current = null; setFollowUpDepth(0); }, []);
  const updateFollowUp = useCallback((userMsg: string, task: string, result: Record<string, unknown>) => {
    const depth = (followUpRef.current?.depth ?? -1) + 1;
    followUpRef.current = { userMessage: userMsg.slice(0, 200), routedTask: task, responseSummary: extractResponseSummary(result).slice(0, 200), depth };
    setFollowUpDepth(depth);
  }, []);
  const buildPreviousContext = useCallback(() => {
    const sess = followUpRef.current;
    if (!sess || sess.depth >= MAX_FOLLOWUP_DEPTH) return undefined;
    return { user_message: sess.userMessage, routed_task: sess.routedTask, response_summary: sess.responseSummary };
  }, []);

  // ─── Data ───────────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const result = await api.get<Recipient[]>('/recipients');
        setRecipients(result);
        if (result[0] && !selectedRecipientId) setSelectedRecipientId(result[0].id);
      } catch { /* silent */ }
    })();
  }, [selectedRecipientId]);

  const fetchHistory = useCallback(async () => {
    if (!selectedRecipientId) return;
    setHistoryLoading(true);
    try { setReportHistory(await api.get<HistoricalReport[]>(`/ai/reports?recipient_id=${selectedRecipientId}&limit=10`)); } catch { /* */ }
    try { setInteractionHistory(await api.get<InteractionRecord[]>(`/ai/interactions?recipient_id=${selectedRecipientId}&limit=10`)); } catch { /* */ }
    setHistoryLoading(false);
    setInitialLoading(false);
  }, [selectedRecipientId]);

  useEffect(() => { void fetchHistory(); }, [fetchHistory]);

  const handleSelectRecipient = (id: string) => {
    setSelectedRecipientId(id); setReport(null); setAssistantResult(null);
    setError(''); setRateLimited(false); setFreeText('');
    clearFollowUp(); setInitialLoading(true); setHistoryExpanded(false);
  };

  const handleNewTopic = () => {
    setReport(null); setAssistantResult(null);
    setError(''); setRateLimited(false); setFreeText('');
    clearFollowUp();
  };

  // ─── Execution ──────────────────────────────────────────────

  const executeChipTask = useCallback(async (task: typeof SUGGESTED_TASKS[number], isFollowUp = false) => {
    if (!selectedRecipientId || generating) return;
    if (!isFollowUp) clearFollowUp();
    setGenerating(true);    setError(''); setRateLimited(false); setReport(null); setAssistantResult(null);
    const prevCtx = isFollowUp ? buildPreviousContext() : undefined;
    try {
      if (task.kind === 'report') {
        const result = await api.post<ReportResult>('/ai/health-report', { recipient_id: selectedRecipientId, report_type: task.key });
        setReport(result);
        updateFollowUp(task.label, task.key, { summary: result.summary, status_label: result.status_label });
      } else {
        const result = await api.post<AssistantResult>('/ai/assistant', { recipient_id: selectedRecipientId, message: task.label, ...(prevCtx ? { previous_context: prevCtx } : {}) });
        setAssistantResult(result);
        if (result.result && result.routed_task) updateFollowUp(task.label, result.routed_task, result.result);
      }
      void fetchHistory();
    } catch (e) {
      if (e instanceof ApiError) { if (e.code === 'AI_RATE_LIMITED') setRateLimited(true); else setError(e.message); }
      else setError('更新失敗，請稍後再試');
    } finally { setGenerating(false); }
  }, [selectedRecipientId, generating, fetchHistory, clearFollowUp, updateFollowUp, buildPreviousContext]);

  const executeFreeText = useCallback(async () => {
    const trimmed = freeText.trim();
    if (!selectedRecipientId || !trimmed || generating) return;
    Keyboard.dismiss();
    const isFollowUp = followUpRef.current !== null && followUpRef.current.depth < MAX_FOLLOWUP_DEPTH;
    const prevCtx = isFollowUp ? buildPreviousContext() : undefined;
    setGenerating(true);    setError(''); setRateLimited(false); setReport(null); setAssistantResult(null);
    try {
      const result = await api.post<AssistantResult>('/ai/assistant', { recipient_id: selectedRecipientId, message: trimmed, ...(prevCtx ? { previous_context: prevCtx } : {}) });
      setAssistantResult(result); setFreeText('');
      if (result.result && result.routed_task) updateFollowUp(trimmed, result.routed_task, result.result);
      void fetchHistory();
    } catch (e) {
      if (e instanceof ApiError) { if (e.code === 'AI_RATE_LIMITED') setRateLimited(true); else setError(e.message); }
      else setError('更新失敗，請稍後再試');
    } finally { setGenerating(false); }
  }, [selectedRecipientId, freeText, generating, fetchHistory, updateFollowUp, buildPreviousContext]);

  const executeFollowUpChip = useCallback(async (label: string) => {
    if (!selectedRecipientId || generating) return;
    Keyboard.dismiss();
    const prevCtx = buildPreviousContext();
    setGenerating(true);    setError(''); setRateLimited(false); setReport(null); setAssistantResult(null);
    try {
      const result = await api.post<AssistantResult>('/ai/assistant', { recipient_id: selectedRecipientId, message: label, ...(prevCtx ? { previous_context: prevCtx } : {}) });
      setAssistantResult(result); setFreeText('');
      if (result.result && result.routed_task) updateFollowUp(label, result.routed_task, result.result);
      void fetchHistory();
    } catch (e) {
      if (e instanceof ApiError) { if (e.code === 'AI_RATE_LIMITED') setRateLimited(true); else setError(e.message); }
      else setError('更新失敗，請稍後再試');
    } finally { setGenerating(false); }
  }, [selectedRecipientId, generating, fetchHistory, updateFollowUp, buildPreviousContext]);

  // ─── Share ──────────────────────────────────────────────────

  const handleShare = async (text: string) => {
    if (Platform.OS === 'web') { await Clipboard.setStringAsync(text); return; }
    await Share.share({ message: text });
  };
  const buildShareText = (): string => {
    const name = recipients.find((r) => r.id === selectedRecipientId)?.name ?? '';
    if (report) {
      return [`【${name} ${TASK_LABELS[report.report_type] ?? report.report_type}】`, report.summary, '', '最近觀察：',
        ...report.reasons.map((r) => `• ${r}`), '', '溫馨提醒：', ...report.suggestions.map((s) => `• ${s}`), '', report.disclaimer].join('\n');
    }
    if (assistantResult?.result) {
      const r = assistantResult.result;
      const parts: string[] = [`【${name} AI照護助理】`];
      if (typeof r.summary === 'string') parts.push(r.summary);
      if (typeof r.explanation === 'string') parts.push(r.explanation);
      parts.push('', assistantResult.disclaimer);
      return parts.join('\n');
    }
    return '';
  };

  // ─── Derived ────────────────────────────────────────────────

  const hasActiveResult = report !== null || (assistantResult !== null && assistantResult.result !== null);
  const hasGuidance = assistantResult !== null && assistantResult.routed_kind === 'unsupported' && assistantResult.guidance !== null;
  const activeRoutedTask = report?.report_type ?? assistantResult?.routed_task ?? null;
  const canFollowUp = hasActiveResult && followUpDepth < MAX_FOLLOWUP_DEPTH && activeRoutedTask !== null;
  const followUpChips = canFollowUp && activeRoutedTask ? (FOLLOWUP_CHIPS[activeRoutedTask] ?? []) : [];
  const atFollowUpLimit = followUpDepth >= MAX_FOLLOWUP_DEPTH && hasActiveResult;
  const hasHistory = interactionHistory.length > 0 || reportHistory.length > 0;
  const isLanding = !hasActiveResult && !hasGuidance && !generating;

  // ─── Response content renderer ──────────────────────────────

  const renderResponseContent = (r: Record<string, unknown>, disc: string, isFallback: boolean) => (
    <>
      {typeof r.summary === 'string' && <Text style={st.resSummary}>{r.summary}</Text>}
      {typeof r.explanation === 'string' && <Text style={st.resSummary}>{r.explanation}</Text>}
      {typeof r.health_update === 'string' && <Text style={st.resSummary}>{r.health_update}</Text>}
      {typeof r.message === 'string' && <Text style={st.resSummary}>{r.message}</Text>}
      {typeof r.greeting === 'string' && <Text style={st.resItem}>{r.greeting}</Text>}
      {Array.isArray(r.reasons) && <View style={st.resSection}><Text style={st.resSectionLabel}>最近觀察</Text>{(r.reasons as string[]).map((x, i) => <Text key={i} style={st.resItem}>• {x}</Text>)}</View>}
      {Array.isArray(r.suggestions) && <View style={st.resSection}><Text style={st.resSectionLabel}>溫馨提醒</Text>{(r.suggestions as string[]).map((x, i) => <Text key={i} style={st.resItem}>• {x}</Text>)}</View>}
      {Array.isArray(r.key_observations) && <View style={st.resSection}><Text style={st.resSectionLabel}>重點觀察</Text>{(r.key_observations as string[]).map((x, i) => <Text key={i} style={st.resItem}>• {x}</Text>)}</View>}
      {Array.isArray(r.key_points) && <View style={st.resSection}><Text style={st.resSectionLabel}>重點</Text>{(r.key_points as string[]).map((x, i) => <Text key={i} style={st.resItem}>• {x}</Text>)}</View>}
      {Array.isArray(r.highlights) && <View style={st.resSection}><Text style={st.resSectionLabel}>重點</Text>{(r.highlights as string[]).map((x, i) => <Text key={i} style={st.resItem}>• {x}</Text>)}</View>}
      {Array.isArray(r.questions) && <View style={st.resSection}><Text style={st.resSectionLabel}>建議問題</Text>{(r.questions as Array<Record<string, string>>).map((q, i) => <Text key={i} style={st.resItem}>• {typeof q === 'string' ? q : q.question ?? ''}</Text>)}</View>}
      {Array.isArray(r.data_to_bring) && <View style={st.resSection}><Text style={st.resSectionLabel}>需準備的資料</Text>{(r.data_to_bring as string[]).map((x, i) => <Text key={i} style={st.resItem}>• {x}</Text>)}</View>}
      {Array.isArray(r.reminders) && <View style={st.resSection}><Text style={st.resSectionLabel}>提醒</Text>{(r.reminders as string[]).map((x, i) => <Text key={i} style={st.resItem}>• {x}</Text>)}</View>}
      {typeof r.notes === 'string' && <Text style={st.resClosing}>{r.notes}</Text>}
      {typeof r.closing === 'string' && <Text style={st.resClosing}>{r.closing}</Text>}
      {isFallback && <Text style={st.fallbackNote}>（AI 暫時無法回應，以上為預設文字）</Text>}
      <Text style={st.disclaimer}>{disc}</Text>
      <TouchableOpacity style={st.shareButton} onPress={() => void handleShare(buildShareText())} accessibilityLabel="分享給家人">
        <Text style={st.shareText}>分享給家人</Text>
      </TouchableOpacity>
    </>
  );

  // ─── Render ─────────────────────────────────────────────────

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.scrollContent} keyboardShouldPersistTaps="handled">

      {initialLoading ? (
        <View style={st.loadingArea}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={st.loadingText}>載入中...</Text>
        </View>
      ) : (
        <>
          {/* ═══ Title ════════════════════════════════════════ */}
          <Text style={st.pageTitle}>AI照護助理</Text>
          {isLanding && (
            <Text style={st.pageSubtitle}>想了解哪位家人的近況？</Text>
          )}

          {/* ═══ Recipient Selector ══════════════════════════ */}
          {recipients.length > 1 && !hasActiveResult && (
            <View style={st.recipientRow}>
              {recipients.map((r) => {
                const active = r.id === selectedRecipientId;
                return (
                  <TouchableOpacity key={r.id} style={[st.chip, active && st.chipActive]} onPress={() => handleSelectRecipient(r.id)} accessibilityRole="button" accessibilityState={{ selected: active }}>
                    <Text style={[st.chipText, active && st.chipTextActive]}>{r.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ═══ Action Grid 3×2 ═════════════════════════════ */}
          {selectedRecipientId && isLanding && (
            <View style={st.actionGrid}>
              {SUGGESTED_TASKS.map((task) => (
                <TouchableOpacity key={task.key} style={st.actionTile} onPress={() => void executeChipTask(task, false)} disabled={generating} activeOpacity={0.7}>
                  <Text style={st.actionTileText}>{task.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ═══ Query Input (landing) ═══════════════════════ */}
          {selectedRecipientId && isLanding && (
            <View style={st.querySection}>
              <Text style={st.queryLabel}>也可以直接問我問題</Text>
              <View style={st.queryRow}>
                <TextInput
                  style={st.queryInput}
                  value={freeText}
                  onChangeText={setFreeText}
                  placeholder="輸入您的問題..."
                  placeholderTextColor={colors.textDisabled}
                  maxLength={500}
                  editable={!generating}
                  returnKeyType="send"
                  onSubmitEditing={() => void executeFreeText()}
                />
                <TouchableOpacity
                  style={[st.sendBtn, (!freeText.trim() || generating) && st.sendBtnDisabled]}
                  onPress={() => void executeFreeText()}
                  disabled={!freeText.trim() || generating}
                  accessibilityLabel="送出"
                >
                  <Text style={st.sendBtnText}>送出</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ═══ Generating ══════════════════════════════════ */}
          {generating && (
            <View style={st.generatingArea}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={st.generatingText}>正在幫您整理...</Text>
            </View>
          )}

          {rateLimited && (
            <View style={st.infoBanner}><Text style={st.infoBannerText}>已達更新上限，請稍後再試</Text></View>
          )}

          {error ? <View style={st.errorArea}><ErrorState message={error} /></View> : null}

          {/* ═══ Guidance ════════════════════════════════════ */}
          {hasGuidance && assistantResult && (
            <Card style={st.guidanceCard}>
              <Text style={st.guidanceText}>{assistantResult.guidance}</Text>
              <Text style={st.disclaimerSmall}>{assistantResult.disclaimer}</Text>
            </Card>
          )}

          {/* ═══ Response Card ═══════════════════════════════ */}
          {report && (
            <Card style={st.responseCard}>
              <View style={st.resHeader}>
                <Text style={st.resTypeLabel}>{TASK_LABELS[report.report_type] ?? report.report_type}</Text>
                <StatusPill status={report.status_label} type="aiHealth" />
              </View>
              {renderResponseContent({ summary: report.summary, reasons: report.reasons, suggestions: report.suggestions, status_label: report.status_label }, report.disclaimer, report.is_fallback)}
            </Card>
          )}

          {assistantResult && assistantResult.result && assistantResult.routed_kind !== 'unsupported' && (
            <Card style={st.responseCard}>
              <View style={st.resHeader}>
                <Text style={st.resTypeLabel}>{TASK_LABELS[assistantResult.routed_task ?? ''] ?? assistantResult.routed_task}</Text>
                {typeof assistantResult.result.status_label === 'string' && <StatusPill status={assistantResult.result.status_label} type="aiHealth" />}
              </View>
              {renderResponseContent(assistantResult.result, assistantResult.disclaimer, assistantResult.is_fallback)}
            </Card>
          )}

          {/* ═══ Follow-up ═══════════════════════════════════ */}
          {followUpChips.length > 0 && !generating && (
            <View style={st.followUpArea}>
              <Text style={st.followUpLabel}>想接著了解：</Text>
              <View style={st.followUpRow}>
                {followUpChips.map((label) => (
                  <TouchableOpacity key={label} style={st.followUpChip} onPress={() => void executeFollowUpChip(label)} activeOpacity={0.7}>
                    <Text style={st.followUpChipText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {atFollowUpLimit && !generating && (
            <Text style={st.limitHint}>接下來會視為新問題重新整理</Text>
          )}

          {/* ═══ Compact input (result / guidance state) ═════ */}
          {(hasActiveResult || hasGuidance) && !generating && selectedRecipientId && (
            <View style={st.compactInputRow}>
              <TextInput
                style={st.compactInput}
                value={freeText}
                onChangeText={setFreeText}
                placeholder={canFollowUp ? '接著問更多...' : '輸入新的問題...'}
                placeholderTextColor={colors.textDisabled}
                maxLength={500}
                editable={!generating}
                returnKeyType="send"
                onSubmitEditing={() => void executeFreeText()}
              />
              <TouchableOpacity
                style={[st.compactSendBtn, (!freeText.trim() || generating) && st.sendBtnDisabled]}
                onPress={() => void executeFreeText()}
                disabled={!freeText.trim() || generating}
                accessibilityLabel="送出"
              >
                <Text style={st.sendBtnText}>送出</Text>
              </TouchableOpacity>
            </View>
          )}

          {(hasActiveResult || hasGuidance) && !generating && (
            <TouchableOpacity style={st.newTopicBtn} onPress={handleNewTopic} activeOpacity={0.7}>
              <Text style={st.newTopicText}>重新開始</Text>
            </TouchableOpacity>
          )}

          {/* ═══ History (collapsible) ═══════════════════════ */}
          {hasHistory && (
            <View style={st.historySection}>
              <TouchableOpacity style={st.historyToggle} onPress={() => setHistoryExpanded((prev) => !prev)} activeOpacity={0.7}>
                <Text style={st.historyToggleText}>查看過去紀錄</Text>
                <Text style={st.historyArrow}>{historyExpanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {historyExpanded && (
                historyLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} style={st.historyLoader} />
                ) : (
                  <View style={st.historyList}>
                    {interactionHistory.slice(0, 3).map((item) => (
                      <View key={item.id} style={st.historyItem}>
                        <View style={st.historyItemRow}>
                          <Text style={st.historyType}>{TASK_LABELS[item.routed_task] ?? item.routed_task}</Text>
                          <Text style={st.historyDate}>{new Date(item.created_at).toLocaleDateString('zh-TW')}</Text>
                        </View>
                        <Text style={st.historySummary} numberOfLines={1}>{item.user_message}</Text>
                      </View>
                    ))}
                    {reportHistory.slice(0, 3).map((h) => (
                      <View key={h.id} style={st.historyItem}>
                        <View style={st.historyItemRow}>
                          <Text style={st.historyType}>{TASK_LABELS[h.report_type] ?? h.report_type}</Text>
                          <StatusPill status={h.status_label} type="aiHealth" />
                          <Text style={st.historyDate}>{new Date(h.generated_at).toLocaleDateString('zh-TW')}</Text>
                        </View>
                        <Text style={st.historySummary} numberOfLines={2}>{h.summary}</Text>
                      </View>
                    ))}
                  </View>
                )
              )}
            </View>
          )}

          <Text style={st.footerNote}>以上為 AI 整理，僅供健康參考，不構成醫療診斷。</Text>
        </>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const st = StyleSheet.create({
  // Screen
  screen: { flex: 1, backgroundColor: colors.bgScreen },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing['3xl'] * 2 },

  // Loading
  loadingArea: { alignItems: 'center', paddingVertical: spacing['3xl'] * 2, gap: spacing.md },
  loadingText: { fontSize: typography.bodyMd.fontSize, color: colors.textDisabled },

  // Title area
  pageTitle: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: typography.headingMd.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textTertiary,
    marginBottom: spacing.xl,
  },

  // Recipient chips
  recipientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  chip: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },

  // Action grid — 3 rows × 2 columns
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing['2xl'],
  },
  actionTile: {
    width: '48%',
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.low,
  },
  actionTileText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
  },

  // Query section (landing state)
  querySection: {
    marginBottom: spacing.xl,
  },
  queryLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginBottom: spacing.sm,
  },
  queryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  queryInput: {
    flex: 1,
    backgroundColor: colors.bgSurfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
    minHeight: 48,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: colors.white, fontSize: typography.bodyMd.fontSize, fontWeight: '600' },

  // Generating
  generatingArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing['3xl'],
    justifyContent: 'center',
  },
  generatingText: { fontSize: typography.bodyMd.fontSize, color: colors.textDisabled },

  // Info / error
  infoBanner: { backgroundColor: colors.infoLight, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md, alignItems: 'center' },
  infoBannerText: { fontSize: typography.bodyMd.fontSize, color: colors.primaryText, textAlign: 'center' },
  errorArea: { marginBottom: spacing.md },

  // Guidance card
  guidanceCard: { padding: spacing.lg, marginBottom: spacing.md },
  guidanceText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
    lineHeight: typography.bodyMd.fontSize * 1.6,
  },
  disclaimerSmall: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginTop: spacing.sm,
  },

  // Response card
  responseCard: { padding: spacing.xl, marginBottom: spacing.md },
  resHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  resTypeLabel: { fontSize: typography.headingSm.fontSize, fontWeight: typography.headingSm.fontWeight, color: colors.textSecondary },
  resSummary: { fontSize: typography.bodyLg.fontSize, color: colors.textPrimary, lineHeight: typography.bodyLg.fontSize * 1.5, marginBottom: spacing.md },
  resSection: { marginBottom: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDefault },
  resSectionLabel: { fontSize: typography.bodySm.fontSize, fontWeight: '600', color: colors.textTertiary, marginBottom: spacing.xs },
  resItem: { fontSize: typography.bodyMd.fontSize, color: colors.textSecondary, lineHeight: typography.bodyMd.fontSize * 1.6 },
  resClosing: { fontSize: typography.bodyMd.fontSize, color: colors.textTertiary, marginTop: spacing.sm },
  fallbackNote: { fontSize: typography.caption.fontSize, color: colors.textDisabled, fontStyle: 'italic', marginBottom: spacing.sm },
  disclaimer: { fontSize: typography.captionSm.fontSize, color: colors.textDisabled, lineHeight: typography.captionSm.fontSize * 1.45, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDefault, paddingTop: spacing.sm + spacing.xxs, marginTop: spacing.sm + spacing.xxs },
  shareButton: { backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingVertical: spacing.sm + spacing.xxs, alignItems: 'center', marginTop: spacing.md },
  shareText: { fontSize: typography.bodyMd.fontSize, fontWeight: '600', color: colors.primaryText },

  // Follow-up
  followUpArea: { marginBottom: spacing.md },
  followUpLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginBottom: spacing.sm,
  },
  followUpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  followUpChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  followUpChipText: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '500',
    color: colors.primaryText,
  },

  // Limit + new topic
  limitHint: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary, textAlign: 'center', marginBottom: spacing.md },
  newTopicBtn: { alignSelf: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderDefault, marginBottom: spacing.xl },
  newTopicText: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary },

  // Compact input (result / guidance state)
  compactInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  compactInput: {
    flex: 1,
    backgroundColor: colors.bgSurfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + spacing.xxs,
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
  },
  compactSendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // History (collapsible)
  historySection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  historyToggleText: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textDisabled,
  },
  historyArrow: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
  },
  historyLoader: { marginTop: spacing.md },
  historyList: { marginTop: spacing.sm },
  historyItem: {
    paddingVertical: spacing.sm + spacing.xxs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderDefault,
  },
  historyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxs,
  },
  historyType: { fontSize: typography.captionSm.fontSize, fontWeight: '600', color: colors.textTertiary },
  historyDate: { fontSize: typography.captionSm.fontSize, color: colors.textDisabled, marginLeft: 'auto' },
  historySummary: { fontSize: typography.captionSm.fontSize, color: colors.textDisabled },

  // Footer
  footerNote: { fontSize: typography.captionSm.fontSize, color: colors.textDisabled, textAlign: 'center', marginTop: spacing.xl },
});
