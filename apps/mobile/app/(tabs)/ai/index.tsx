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
  KeyboardAvoidingView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
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

interface FollowUpSession {
  userMessage: string; routedTask: string; responseSummary: string; depth: number;
}

// Chat message for the conversation view
interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  text: string;
  report?: ReportResult;
  assistantResult?: AssistantResult;
  timestamp: Date;
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

let msgIdCounter = 0;
function nextMsgId(): string { return `msg-${++msgIdCounter}-${Date.now()}`; }

// ─── Component ────────────────────────────────────────────────

export default function AiAssistantScreen() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const followUpRef = useRef<FollowUpSession | null>(null);
  const [followUpDepth, setFollowUpDepth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const welcomeShownForRef = useRef<string | null>(null);

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

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages((prev) => [...prev, { ...msg, id: nextMsgId(), timestamp: new Date() }]);
  }, []);

  // ─── Data ───────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const result = await api.get<Recipient[]>('/recipients');
          setRecipients(result);
          if (result[0] && !selectedRecipientId) setSelectedRecipientId(result[0].id);
        } catch { /* silent */ }
      })();
    }, [selectedRecipientId]),
  );

  // Welcome message — only show once per recipient (not on every recipients array update)
  useEffect(() => {
    if (!selectedRecipientId || selectedRecipientId === welcomeShownForRef.current) return;
    const name = recipients.find((r) => r.id === selectedRecipientId)?.name;
    if (!name) return;
    welcomeShownForRef.current = selectedRecipientId;
    setMessages([{
      id: nextMsgId(),
      role: 'ai',
      text: `你好！我是 AI 照護助理。\n想了解 ${name} 的什麼呢？可以點選下方的選項，或直接輸入問題。`,
      timestamp: new Date(),
    }]);
  }, [selectedRecipientId, recipients]);

  const handleSelectRecipient = (id: string) => {
    welcomeShownForRef.current = null; // allow new welcome message
    setSelectedRecipientId(id);
    setError(''); setRateLimited(false); setFreeText('');
    clearFollowUp();
  };

  // ─── Execution ──────────────────────────────────────────────

  const executeChipTask = useCallback(async (task: typeof SUGGESTED_TASKS[number], isFollowUp = false) => {
    if (!selectedRecipientId || generating) return;
    if (!isFollowUp) clearFollowUp();

    // Add user bubble
    addMessage({ role: 'user', text: task.label });
    scrollToBottom();

    setGenerating(true); setError(''); setRateLimited(false);
    const prevCtx = isFollowUp ? buildPreviousContext() : undefined;
    try {
      if (task.kind === 'report') {
        const result = await api.post<ReportResult>('/ai/health-report', { recipient_id: selectedRecipientId, report_type: task.key });
        addMessage({ role: 'ai', text: '', report: result });
        updateFollowUp(task.label, task.key, { summary: result.summary, status_label: result.status_label });
      } else {
        const result = await api.post<AssistantResult>('/ai/assistant', { recipient_id: selectedRecipientId, message: task.label, ...(prevCtx ? { previous_context: prevCtx } : {}) });
        if (result.routed_kind === 'unsupported' && result.guidance) {
          addMessage({ role: 'ai', text: result.guidance });
        } else if (result.result) {
          addMessage({ role: 'ai', text: '', assistantResult: result });
          if (result.routed_task) updateFollowUp(task.label, result.routed_task, result.result);
        }
      }
    } catch (e) {
      if (e instanceof ApiError) { if (e.code === 'AI_RATE_LIMITED') setRateLimited(true); else setError(e.message); }
      else setError('更新失敗，請稍後再試');
    } finally { setGenerating(false); scrollToBottom(); }
  }, [selectedRecipientId, generating, clearFollowUp, updateFollowUp, buildPreviousContext, addMessage, scrollToBottom]);

  const executeFreeText = useCallback(async () => {
    const trimmed = freeText.trim();
    if (!selectedRecipientId || !trimmed || generating) return;
    Keyboard.dismiss();

    addMessage({ role: 'user', text: trimmed });
    setFreeText('');
    scrollToBottom();

    const isFollowUp = followUpRef.current !== null && followUpRef.current.depth < MAX_FOLLOWUP_DEPTH;
    const prevCtx = isFollowUp ? buildPreviousContext() : undefined;
    setGenerating(true); setError(''); setRateLimited(false);
    try {
      const result = await api.post<AssistantResult>('/ai/assistant', { recipient_id: selectedRecipientId, message: trimmed, ...(prevCtx ? { previous_context: prevCtx } : {}) });
      if (result.routed_kind === 'unsupported' && result.guidance) {
        addMessage({ role: 'ai', text: result.guidance });
      } else if (result.result) {
        addMessage({ role: 'ai', text: '', assistantResult: result });
        if (result.routed_task) updateFollowUp(trimmed, result.routed_task, result.result);
      }
    } catch (e) {
      if (e instanceof ApiError) { if (e.code === 'AI_RATE_LIMITED') setRateLimited(true); else setError(e.message); }
      else setError('更新失敗，請稍後再試');
    } finally { setGenerating(false); scrollToBottom(); }
  }, [selectedRecipientId, freeText, generating, updateFollowUp, buildPreviousContext, addMessage, scrollToBottom]);

  const executeFollowUpChip = useCallback(async (label: string) => {
    if (!selectedRecipientId || generating) return;
    Keyboard.dismiss();
    addMessage({ role: 'user', text: label });
    scrollToBottom();

    const prevCtx = buildPreviousContext();
    setGenerating(true); setError(''); setRateLimited(false);
    try {
      const result = await api.post<AssistantResult>('/ai/assistant', { recipient_id: selectedRecipientId, message: label, ...(prevCtx ? { previous_context: prevCtx } : {}) });
      if (result.result) {
        addMessage({ role: 'ai', text: '', assistantResult: result });
        if (result.routed_task) updateFollowUp(label, result.routed_task, result.result);
      }
    } catch (e) {
      if (e instanceof ApiError) { if (e.code === 'AI_RATE_LIMITED') setRateLimited(true); else setError(e.message); }
      else setError('更新失敗，請稍後再試');
    } finally { setGenerating(false); scrollToBottom(); }
  }, [selectedRecipientId, generating, updateFollowUp, buildPreviousContext, addMessage, scrollToBottom]);

  // ─── Share ──────────────────────────────────────────────────

  const handleShare = async (text: string) => {
    if (Platform.OS === 'web') { await Clipboard.setStringAsync(text); return; }
    await Share.share({ message: text });
  };
  const buildShareText = (msg: ChatMessage): string => {
    const name = recipients.find((r) => r.id === selectedRecipientId)?.name ?? '';
    if (msg.report) {
      const rpt = msg.report;
      return [`【${name} ${TASK_LABELS[rpt.report_type] ?? rpt.report_type}】`, rpt.summary, '', '最近觀察：',
        ...rpt.reasons.map((r) => `• ${r}`), '', '溫馨提醒：', ...rpt.suggestions.map((s) => `• ${s}`), '', rpt.disclaimer].join('\n');
    }
    if (msg.assistantResult?.result) {
      const r = msg.assistantResult.result;
      const parts: string[] = [`【${name} AI照護助理】`];
      if (typeof r.summary === 'string') parts.push(r.summary);
      if (typeof r.explanation === 'string') parts.push(r.explanation);
      parts.push('', msg.assistantResult.disclaimer);
      return parts.join('\n');
    }
    return msg.text;
  };

  // ─── Derived ──────────────────────────────────────────────

  const lastAiMsg = [...messages].reverse().find((m) => m.role === 'ai' && (m.report || m.assistantResult));
  const activeRoutedTask = lastAiMsg?.report?.report_type ?? lastAiMsg?.assistantResult?.routed_task ?? null;
  const canFollowUp = lastAiMsg && followUpDepth < MAX_FOLLOWUP_DEPTH && activeRoutedTask !== null;
  const followUpChips = canFollowUp && activeRoutedTask ? (FOLLOWUP_CHIPS[activeRoutedTask] ?? []) : [];
  const isLanding = messages.length <= 1 && !generating;
  const selectedName = recipients.find((r) => r.id === selectedRecipientId)?.name ?? '';

  // ─── Render response content inside bubble ────────────────

  const renderBubbleContent = (r: Record<string, unknown>, disc: string, isFallback: boolean) => (
    <>
      {typeof r.summary === 'string' && <Text style={s.bubbleText}>{r.summary}</Text>}
      {typeof r.explanation === 'string' && <Text style={s.bubbleText}>{r.explanation}</Text>}
      {typeof r.health_update === 'string' && <Text style={s.bubbleText}>{r.health_update}</Text>}
      {typeof r.message === 'string' && <Text style={s.bubbleText}>{r.message}</Text>}
      {typeof r.greeting === 'string' && <Text style={s.bubbleItem}>{r.greeting}</Text>}
      {Array.isArray(r.reasons) && <View style={s.bubbleSection}><Text style={s.bubbleSectionLabel}>最近觀察</Text>{(r.reasons as string[]).map((x, i) => <Text key={i} style={s.bubbleItem}>• {x}</Text>)}</View>}
      {Array.isArray(r.suggestions) && <View style={s.bubbleSection}><Text style={s.bubbleSectionLabel}>溫馨提醒</Text>{(r.suggestions as string[]).map((x, i) => <Text key={i} style={s.bubbleItem}>• {x}</Text>)}</View>}
      {Array.isArray(r.key_observations) && <View style={s.bubbleSection}><Text style={s.bubbleSectionLabel}>重點觀察</Text>{(r.key_observations as string[]).map((x, i) => <Text key={i} style={s.bubbleItem}>• {x}</Text>)}</View>}
      {Array.isArray(r.key_points) && <View style={s.bubbleSection}><Text style={s.bubbleSectionLabel}>重點</Text>{(r.key_points as string[]).map((x, i) => <Text key={i} style={s.bubbleItem}>• {x}</Text>)}</View>}
      {Array.isArray(r.highlights) && <View style={s.bubbleSection}><Text style={s.bubbleSectionLabel}>重點</Text>{(r.highlights as string[]).map((x, i) => <Text key={i} style={s.bubbleItem}>• {x}</Text>)}</View>}
      {Array.isArray(r.questions) && <View style={s.bubbleSection}><Text style={s.bubbleSectionLabel}>建議問題</Text>{(r.questions as Array<Record<string, string>>).map((q, i) => <Text key={i} style={s.bubbleItem}>• {typeof q === 'string' ? q : q.question ?? ''}</Text>)}</View>}
      {Array.isArray(r.data_to_bring) && <View style={s.bubbleSection}><Text style={s.bubbleSectionLabel}>需準備的資料</Text>{(r.data_to_bring as string[]).map((x, i) => <Text key={i} style={s.bubbleItem}>• {x}</Text>)}</View>}
      {Array.isArray(r.reminders) && <View style={s.bubbleSection}><Text style={s.bubbleSectionLabel}>提醒</Text>{(r.reminders as string[]).map((x, i) => <Text key={i} style={s.bubbleItem}>• {x}</Text>)}</View>}
      {typeof r.notes === 'string' && <Text style={s.bubbleClosing}>{r.notes}</Text>}
      {typeof r.closing === 'string' && <Text style={s.bubbleClosing}>{r.closing}</Text>}
      {isFallback && <Text style={s.fallbackNote}>（AI 暫時無法回應，以上為預設文字）</Text>}
      <Text style={s.bubbleDisclaimer}>{disc}</Text>
    </>
  );

  // ─── Render ─────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      {/* ── Header ──────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>AI 照護助理</Text>
        {recipients.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.headerChips}>
            {recipients.map((r) => {
              const active = r.id === selectedRecipientId;
              return (
                <TouchableOpacity key={r.id} style={[s.chip, active && s.chipActive]} onPress={() => handleSelectRecipient(r.id)} activeOpacity={0.7}>
                  <Text style={[s.chipText, active && s.chipTextActive]}>{r.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Chat Area ───────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={s.chatArea}
        contentContainerStyle={s.chatContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Messages */}
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <View key={msg.id} style={s.userRow}>
                <View style={s.userBubble}>
                  <Text style={s.userBubbleText}>{msg.text}</Text>
                </View>
              </View>
            );
          }

          // AI bubble
          return (
            <View key={msg.id} style={s.aiRow}>
              <View style={s.aiAvatar}><Text style={s.aiAvatarText}>AI</Text></View>
              <View style={s.aiBubble}>
                {/* Plain text message */}
                {msg.text && !msg.report && !msg.assistantResult && (
                  <Text style={s.bubbleText}>{msg.text}</Text>
                )}

                {/* Report result */}
                {msg.report && (
                  <>
                    <View style={s.bubbleHeader}>
                      <Text style={s.bubbleTypeLabel}>{TASK_LABELS[msg.report.report_type] ?? msg.report.report_type}</Text>
                      <StatusPill status={msg.report.status_label} type="aiHealth" />
                    </View>
                    {renderBubbleContent({ summary: msg.report.summary, reasons: msg.report.reasons, suggestions: msg.report.suggestions }, msg.report.disclaimer, msg.report.is_fallback)}
                    <TouchableOpacity style={s.shareBtn} onPress={() => void handleShare(buildShareText(msg))} activeOpacity={0.7}>
                      <Text style={s.shareBtnText}>分享給家人</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Assistant result */}
                {msg.assistantResult?.result && msg.assistantResult.routed_kind !== 'unsupported' && (
                  <>
                    <View style={s.bubbleHeader}>
                      <Text style={s.bubbleTypeLabel}>{TASK_LABELS[msg.assistantResult.routed_task ?? ''] ?? ''}</Text>
                      {typeof msg.assistantResult.result.status_label === 'string' && <StatusPill status={msg.assistantResult.result.status_label} type="aiHealth" />}
                    </View>
                    {renderBubbleContent(msg.assistantResult.result, msg.assistantResult.disclaimer, msg.assistantResult.is_fallback)}
                    <TouchableOpacity style={s.shareBtn} onPress={() => void handleShare(buildShareText(msg))} activeOpacity={0.7}>
                      <Text style={s.shareBtnText}>分享給家人</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        })}

        {/* Generating indicator */}
        {generating && (
          <View style={s.aiRow}>
            <View style={s.aiAvatar}><Text style={s.aiAvatarText}>AI</Text></View>
            <View style={s.aiBubbleTyping}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={s.typingText}>正在整理...</Text>
            </View>
          </View>
        )}

        {/* Error / Rate limit */}
        {rateLimited && (
          <View style={s.aiRow}>
            <View style={s.aiAvatar}><Text style={s.aiAvatarText}>AI</Text></View>
            <View style={s.aiBubbleWarn}><Text style={s.warnText}>已達更新上限，請稍後再試</Text></View>
          </View>
        )}
        {error ? <View style={s.errorWrap}><ErrorState message={error} /></View> : null}

        {/* Suggested tasks (landing only) — 2×3 grid */}
        {isLanding && selectedRecipientId && (
          <View style={s.suggestGrid}>
            {SUGGESTED_TASKS.map((task) => (
              <TouchableOpacity key={task.key} style={s.suggestChip} onPress={() => void executeChipTask(task, false)} disabled={generating} activeOpacity={0.7}>
                <Text style={s.suggestChipText}>{task.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Follow-up chips */}
        {followUpChips.length > 0 && !generating && (
          <View style={s.followUpRow}>
            {followUpChips.map((label) => (
              <TouchableOpacity key={label} style={s.suggestChip} onPress={() => void executeFollowUpChip(label)} activeOpacity={0.7}>
                <Text style={s.suggestChipText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Input Bar (fixed bottom) ────────────── */}
      <View style={s.inputBar}>
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            value={freeText}
            onChangeText={setFreeText}
            placeholder={`問問 ${selectedName} 的健康狀況...`}
            placeholderTextColor={colors.textDisabled}
            maxLength={500}
            editable={!generating}
            returnKeyType="send"
            onSubmitEditing={() => void executeFreeText()}
            multiline
          />
        </View>
        <TouchableOpacity
          style={[s.sendBtn, (!freeText.trim() || generating) && s.sendBtnDisabled]}
          onPress={() => void executeFreeText()}
          disabled={!freeText.trim() || generating}
          accessibilityLabel="送出"
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M22 2L11 13" stroke={colors.white} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={colors.white} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },

  // ─── Header ─────────────────────────────────────────────
  header: {
    backgroundColor: colors.bgSurface, paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderDefault,
  },
  headerTitle: { fontSize: typography.headingSm.fontSize, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  headerChips: { gap: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.bgSurfaceAlt },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary, fontWeight: '600' },
  chipTextActive: { color: colors.white, fontWeight: '700' },

  // ─── Chat Area ──────────────────────────────────────────
  chatArea: { flex: 1 },
  chatContent: { padding: spacing.lg, paddingBottom: spacing.md },

  // ─── User Bubble ────────────────────────────────────────
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.md },
  userBubble: {
    backgroundColor: colors.primary, borderRadius: radius.xl,
    borderBottomRightRadius: spacing.xs,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    maxWidth: '75%',
  },
  userBubbleText: { fontSize: typography.bodyMd.fontSize, color: colors.white, lineHeight: 20 },

  // ─── AI Bubble ──────────────────────────────────────────
  aiRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md, gap: spacing.sm },
  aiAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  aiAvatarText: { fontSize: 11, fontWeight: '700', color: colors.primaryText },
  aiBubble: {
    backgroundColor: colors.bgSurface, borderRadius: radius.xl,
    borderBottomLeftRadius: spacing.xs,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    maxWidth: '80%', ...shadows.low,
  },
  aiBubbleTyping: {
    backgroundColor: colors.bgSurface, borderRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, ...shadows.low,
  },
  typingText: { fontSize: typography.bodySm.fontSize, color: colors.textDisabled },
  aiBubbleWarn: {
    backgroundColor: colors.warningLight, borderRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  warnText: { fontSize: typography.bodySm.fontSize, color: colors.warning },

  // ─── Bubble Content ─────────────────────────────────────
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  bubbleTypeLabel: { fontSize: typography.bodySm.fontSize, fontWeight: '600', color: colors.textTertiary },
  bubbleText: { fontSize: typography.bodyMd.fontSize, color: colors.textPrimary, lineHeight: 22, marginBottom: spacing.sm },
  bubbleSection: { marginBottom: spacing.sm, paddingTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDefault },
  bubbleSectionLabel: { fontSize: typography.captionSm.fontSize, fontWeight: '600', color: colors.textTertiary, marginBottom: spacing.xs },
  bubbleItem: { fontSize: typography.bodySm.fontSize, color: colors.textSecondary, lineHeight: 20 },
  bubbleClosing: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary, marginTop: spacing.xs },
  bubbleDisclaimer: { fontSize: 10, color: colors.textDisabled, marginTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDefault, paddingTop: spacing.sm },
  fallbackNote: { fontSize: typography.captionSm.fontSize, color: colors.textDisabled, fontStyle: 'italic', marginBottom: spacing.xs },
  shareBtn: { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.md },
  shareBtnText: { fontSize: typography.bodySm.fontSize, fontWeight: '600', color: colors.primaryText },

  // ─── Suggested Tasks Grid (2×3) ──────────────────────────
  suggestGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    marginBottom: spacing.md, paddingLeft: 32 + spacing.sm, // align with bubble (avatar width + gap)
  },
  followUpRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    marginBottom: spacing.md, paddingLeft: 32 + spacing.sm,
  },
  suggestChip: {
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  suggestChipText: { fontSize: typography.caption.fontSize, fontWeight: '500', color: colors.textPrimary },

  // ─── Error ──────────────────────────────────────────────
  errorWrap: { marginBottom: spacing.md },

  // ─── Input Bar (fixed bottom) ───────────────────────────
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    backgroundColor: colors.bgSurface,
    borderTopWidth: 1, borderTopColor: colors.borderDefault,
  },
  inputWrap: {
    flex: 1, backgroundColor: colors.bgSurfaceAlt, borderRadius: 20,
    paddingHorizontal: spacing.lg,
    minHeight: 40, maxHeight: 100,
    justifyContent: 'center',
  },
  input: {
    fontSize: typography.bodyMd.fontSize, color: colors.textPrimary,
    paddingVertical: spacing.sm,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    ...shadows.low,
  },
  sendBtnDisabled: { opacity: 0.3 },
});
