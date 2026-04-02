import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
  RefreshControl,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import { useRouter, useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { calculateHealthScore, HEALTH_LEVEL_LABELS } from '@remote-care/shared';

// ─── Types ────────────────────────────────────────────────────

interface Recipient {
  id: string;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
  relationship: string | null;
  medical_tags: string[];
  created_at: string;
}

interface LatestReport {
  id: string;
  status_label: string;
  summary: string;
  generated_at: string;
}

interface MeasurementStats {
  count: number;
  abnormal_count: number;
  systolic?: { avg: number };
  diastolic?: { avg: number };
  glucose_value?: { avg: number };
}

interface Appointment {
  id: string;
  recipient_id: string;
  title: string;
  hospital_name: string | null;
  appointment_date: string;
}

interface ServiceCategory {
  id: string;
  code: string;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────

const RELATIONSHIP_LABELS: Record<string, string> = {
  father: '父親', mother: '母親', grandfather: '祖父', grandmother: '祖母',
  spouse: '配偶', sibling: '兄弟姊妹', child: '子女', other: '其他',
};

function maskName(name: string): string {
  if (name.length <= 1) return name;
  return name.charAt(0) + '○'.repeat(name.length - 1);
}

function extractExcerpt(summary: string, maxLen = 25): string {
  if (!summary) return '';
  const short = summary.slice(0, maxLen);
  const periodIdx = short.indexOf('。');
  if (periodIdx > 0) return short.slice(0, periodIdx + 1);
  if (summary.length > maxLen) return short + '...';
  return summary;
}

const STATUS_DOT: Record<string, string> = {
  stable: colors.success,
  attention: colors.warning,
  consult_doctor: colors.danger,
};

const SCORE_COLORS: Record<string, string> = {
  excellent: colors.success,
  good: colors.primary,
  fair: colors.warning,
  poor: colors.danger,
};

// ─── Accent colors for metric cards ──────────────────────────

// Accent colors — warm palette that harmonizes with purple primary
const METRIC_ACCENTS = {
  bp: { bar: '#E8707E', bg: '#FFF2F4' },      // rose
  bg: { bar: '#E8A44E', bg: '#FFF8EF' },      // warm gold
  abnormal: { bar: '#D4930A', bg: '#FFFBF0' }, // amber
  count: { bar: '#5BB98B', bg: '#F0F9F3' },    // sage green
} as const;

// ─── SVG Icons (24×24 line style) ───────────────────────────

function IconBell({ size = 22, color = colors.textTertiary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconMenu({ size = 22, color = colors.textTertiary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12h18M3 6h18M3 18h18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// Service category icons
const SERVICE_ICONS: Record<string, (props: { size: number; color: string }) => React.ReactElement> = {
  escort_visit: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2v8m-4-4h8" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Rect x="3" y="14" width="18" height="8" rx="2" stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  ),
  functional_assessment: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12h4l3-7 4 14 3-7h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  exercise_program: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="5" r="2.5" stroke={color} strokeWidth={1.5} fill="none" />
      <Path d="M12 9v5m-3 3l3-3 3 3m-6-5l-2-1m6 1l2-1" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  home_cleaning: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12l9-8 9 8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9" stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  ),
  pre_visit_consult: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  ),
  daily_living_support: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 11c-1.5 0-3 1-3 3s1.5 3 3 3m10-6c1.5 0 3 1 3 3s-1.5 3-3 3" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M12 7v10m-3-5h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  ),
  nutrition_consult: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2c-3 4-6 6-6 10a6 6 0 0012 0c0-4-3-6-6-10z" stroke={color} strokeWidth={1.5} fill="none" />
      <Path d="M12 16v-4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  ),
  shopping_assist: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke={color} strokeWidth={1.5} fill="none" />
      <Path d="M3 6h18M16 10a4 4 0 01-8 0" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  ),
};

// Service category colors — muted, warm, cohesive with purple base
const SERVICE_CATEGORY_COLORS: Record<string, { icon: string; bg: string }> = {
  escort_visit: { icon: '#E8707E', bg: '#FFF2F4' },
  functional_assessment: { icon: '#7B71D4', bg: '#F2F0FF' },
  exercise_program: { icon: '#5BB98B', bg: '#F0F9F3' },
  home_cleaning: { icon: '#E8A44E', bg: '#FFF8EF' },
  pre_visit_consult: { icon: '#9B8FD8', bg: '#F5F3FF' },
  daily_living_support: { icon: '#6BAFCF', bg: '#F0F7FC' },
  nutrition_consult: { icon: '#6DB88A', bg: '#F0F8F2' },
  shopping_assist: { icon: '#D4789B', bg: '#FFF0F5' },
};

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Component ────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // ── Data state ──
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [latestReports, setLatestReports] = useState<Record<string, LatestReport>>({});
  const [bpStats, setBpStats] = useState<Record<string, MeasurementStats>>({});
  const [bgStats, setBgStats] = useState<Record<string, MeasurementStats>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [appointments, setAppointments] = useState<(Appointment & { recipientName: string; recipientRelationship: string | null })[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  // ── UI state ──
  const [menuVisible, setMenuVisible] = useState(false);
  const [aiSheetVisible, setAiSheetVisible] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);

  // ── Derived ──
  const activeRecipient = useMemo(
    () => recipients.find((r) => r.id === selectedRecipientId) ?? recipients[0] ?? null,
    [recipients, selectedRecipientId],
  );
  const activeId = activeRecipient?.id ?? '';
  const activeReport = latestReports[activeId];
  const activeBp = bpStats[activeId];
  const activeBg = bgStats[activeId];

  const healthResult = useMemo(() => {
    if (!activeBp && !activeBg && !activeReport) return null;
    return calculateHealthScore({
      bpStats: activeBp ?? null,
      bgStats: activeBg ?? null,
      aiStatusLabel: activeReport?.status_label ?? null,
    });
  }, [activeBp, activeBg, activeReport]);

  // ── Ring animation ──
  const ringAnim = useRef(new Animated.Value(0)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);

  // Re-trigger animation when active recipient changes OR score changes
  useEffect(() => {
    const targetScore = healthResult?.score ?? 0;
    // Reset to 0
    ringAnim.setValue(0);
    scoreAnim.setValue(0);
    setDisplayScore(0);

    // Small delay so the reset is visible before animating up
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(ringAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(scoreAnim, {
          toValue: targetScore,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    }, 50);

    // Score count-up listener
    const listenerId = scoreAnim.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });
    return () => {
      clearTimeout(timer);
      scoreAnim.removeListener(listenerId);
    };
  }, [activeId, healthResult?.score, ringAnim, scoreAnim]);

  // Smooth recipient switching
  const handleSwitchRecipient = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedRecipientId(id);
  }, []);

  // ── Data fetching ──
  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<Recipient[]>('/recipients');
      setRecipients(result);
      // Auto-select first recipient only on initial load
      setSelectedRecipientId((prev) => prev ?? result[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '載入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllData = useCallback(async (recipientList: Recipient[]) => {
    if (recipientList.length === 0) return;
    const reports: Record<string, LatestReport> = {};
    const bps: Record<string, MeasurementStats> = {};
    const bgs: Record<string, MeasurementStats> = {};
    const allAppts: (Appointment & { recipientName: string; recipientRelationship: string | null })[] = [];

    await Promise.all(
      recipientList.map(async (r) => {
        // Reports
        try {
          const reps = await api.get<LatestReport[]>(`/ai/reports?recipient_id=${r.id}&report_type=health_summary&limit=1`);
          if (reps[0]) reports[r.id] = reps[0];
        } catch { /* non-critical */ }
        // BP stats
        try {
          const bp = await api.get<MeasurementStats>(`/measurements/stats?recipient_id=${r.id}&type=blood_pressure&period=7d`);
          bps[r.id] = bp;
        } catch { /* non-critical */ }
        // BG stats
        try {
          const bg = await api.get<MeasurementStats>(`/measurements/stats?recipient_id=${r.id}&type=blood_glucose&period=7d`);
          bgs[r.id] = bg;
        } catch { /* non-critical */ }
        // Appointments
        try {
          const appts = await api.get<Appointment[]>(`/appointments?recipient_id=${r.id}&limit=3`);
          for (const a of appts) allAppts.push({ ...a, recipientName: r.name, recipientRelationship: r.relationship });
        } catch { /* non-critical */ }
      }),
    );

    setLatestReports(reports);
    setBpStats(bps);
    setBgStats(bgs);
    allAppts.sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());
    setAppointments(allAppts.slice(0, 3));
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const result = await api.get<{ count: number }>('/notifications/unread-count');
      setUnreadCount(result.count);
    } catch { /* non-critical */ }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await api.get<ServiceCategory[]>('/service-categories');
      setCategories(cats);
    } catch { /* non-critical */ }
  }, []);

  // Re-fetch all data every time the tab gains focus (e.g. returning from add-measurement)
  useFocusEffect(
    useCallback(() => {
      void fetchRecipients();
      void fetchUnreadCount();
      void fetchCategories();
    }, [fetchRecipients, fetchUnreadCount, fetchCategories]),
  );

  // When recipients list changes, fetch per-recipient data
  useEffect(() => {
    if (recipients.length > 0) void fetchAllData(recipients);
  }, [recipients, fetchAllData]);

  const handleRefresh = useCallback(async () => {
    setRefreshingAll(true);
    await fetchRecipients();
    await fetchUnreadCount();
    if (recipients.length > 0) await fetchAllData(recipients);
    setRefreshingAll(false);
  }, [fetchRecipients, fetchUnreadCount, fetchAllData, recipients]);

  // ── PDF download ──
  const handleDownloadPdf = useCallback(async () => {
    if (!activeReport || !activeRecipient) return;
    const statusLabel = activeReport.status_label === 'stable' ? '穩定'
      : activeReport.status_label === 'attention' ? '需留意' : '建議就醫';
    const html = `<html><head><meta charset="utf-8"><style>
      body{font-family:sans-serif;padding:32px;color:#111827}
      h1{font-size:20px;margin-bottom:4px}
      .sub{color:#6B7280;font-size:13px;margin-bottom:16px}
      .score{font-size:36px;font-weight:700;color:${SCORE_COLORS[healthResult?.level ?? 'good'] ?? colors.primary}}
      .summary{font-size:14px;line-height:1.6;margin:12px 0}
      .disclaimer{margin-top:20px;padding:10px;background:#F3F4F6;border-radius:8px;font-size:11px;color:#6B7280}
    </style></head><body>
      <h1>健康報告 — ${escHtml(activeRecipient.name)}</h1>
      <p class="sub">${new Date(activeReport.generated_at).toLocaleDateString('zh-TW')}</p>
      <p class="score">${healthResult?.score ?? '-'} 分（${escHtml(statusLabel)}）</p>
      <p class="summary">${escHtml(activeReport.summary)}</p>
      <div class="disclaimer">本報告由 AI 生成，僅供健康趨勢參考，不構成醫療診斷。</div>
    </body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch { /* fallback silently */ }
  }, [activeReport, activeRecipient, healthResult]);

  // ─── Role redirect — Provider/Patient should not see this page ──
  useEffect(() => {
    if (user?.role === 'provider') {
      router.replace('/(tabs)/services/provider-tasks');
    } else if (user?.role === 'patient') {
      router.replace('/(tabs)/patient/summary');
    }
  }, [user?.role, router]);

  // ─── Loading / Error ──────────────────────────────────────────

  if (user?.role && user.role !== 'caregiver') {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

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
          style={styles.logoutBtn}
          onPress={() => { void logout().then(() => router.replace('/(auth)/login')); }}
        >
          <Text style={styles.logoutBtnText}>登出</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (recipients.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="尚無被照護者"
          description="新增您的家人或照護對象，即可開始記錄健康數據與追蹤狀況。"
          actionLabel="新增被照護者"
          onAction={() => router.push('/(tabs)/home/add-recipient')}
        />
      </View>
    );
  }

  const firstName = user?.name?.charAt(0) ?? '';

  // Ring chart constants
  const ringSize = 88;
  const strokeW = 7;
  const ringR = (ringSize - strokeW) / 2;
  const circ = 2 * Math.PI * ringR;
  const ringColor = SCORE_COLORS[healthResult?.level ?? 'good'] ?? colors.primary;

  // Animated dash offset: interpolate ringAnim (0→1) to (full circumference → target offset)
  const targetProgress = (healthResult?.score ?? 0) / 100;
  const animatedDashOffset = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circ, circ * (1 - targetProgress)],
  });

  // ─── Main Render ──────────────────────────────────────────────

  const abnormalTotal = (activeBp?.abnormal_count ?? 0) + (activeBg?.abnormal_count ?? 0);
  const measureTotal = (activeBp?.count ?? 0) + (activeBg?.count ?? 0);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshingAll} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
        }
      >
        {/* ── Header ─────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{firstName}</Text>
            </View>
            <View>
              <Text style={styles.greeting}>你好，{user?.name ?? ''}！</Text>
              <Text style={styles.greetingSub}>今天也要好好照顧家人</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/home/notifications')} accessibilityLabel="通知">
              <IconBell />
              {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuVisible(true)} accessibilityLabel="選單">
              <IconMenu />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Recipient Switcher ──────────────── */}
        {recipients.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll} contentContainerStyle={styles.switcherContent}>
            {recipients.map((r) => {
              const isActive = r.id === activeId;
              return (
                <TouchableOpacity key={r.id} style={[styles.switcherChip, isActive && styles.switcherChipActive]} onPress={() => handleSwitchRecipient(r.id)} activeOpacity={0.7}>
                  <Text style={[styles.switcherText, isActive && styles.switcherTextActive]}>{r.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ═══════════════════════════════════════
            BENTO PUZZLE LAYOUT — no section titles,
            cards of varying sizes interlock like tiles
            ═══════════════════════════════════════ */}
        <View style={styles.bento}>

          {/* ── Row 1: Hero Score (full width) ──── */}
          <TouchableOpacity
            style={[styles.heroCard, { backgroundColor: healthResult ? (healthResult.level === 'excellent' || healthResult.level === 'good' ? colors.primaryLight : healthResult.level === 'fair' ? colors.warningLight : colors.dangerLight) : colors.primaryLight }]}
            onPress={() => setAiSheetVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.heroTop}>
              <View style={styles.ringContainer}>
                <Svg width={ringSize} height={ringSize}>
                  <Circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} stroke={colors.borderDefault} strokeWidth={strokeW} fill="none" />
                  <AnimatedCircle cx={ringSize / 2} cy={ringSize / 2} r={ringR} stroke={ringColor} strokeWidth={strokeW} fill="none" strokeDasharray={`${circ}`} strokeDashoffset={animatedDashOffset} strokeLinecap="round" transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`} />
                </Svg>
                <View style={styles.ringCenter}>
                  <Text style={[styles.ringScore, { color: ringColor }]}>{healthResult ? displayScore : '--'}</Text>
                  <Text style={styles.ringLabel}>分</Text>
                </View>
              </View>
              <View style={styles.heroInfo}>
                <View style={styles.heroStatusRow}>
                  <View style={[styles.heroDot, { backgroundColor: ringColor }]} />
                  <Text style={styles.heroStatusText}>{healthResult ? HEALTH_LEVEL_LABELS[healthResult.level] : '尚無資料'}</Text>
                </View>
                <Text style={styles.heroSummary} numberOfLines={2}>
                  {activeReport ? extractExcerpt(activeReport.summary, 40) : '生成安心報以查看健康摘要'}
                </Text>
                <View style={styles.heroActions}>
                  <TouchableOpacity style={styles.heroBtn} onPress={() => router.push('/(tabs)/health/ai-report')} activeOpacity={0.7}>
                    <Text style={styles.heroBtnText}>查看安心報</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.heroBtnOutline} onPress={() => void handleDownloadPdf()} activeOpacity={0.7}>
                    <Text style={styles.heroBtnOutlineText}>PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* ── Row 2: BP (large) + BG (large) ── */}
          <View style={styles.bentoRow}>
            <TouchableOpacity
              style={[styles.bentoLarge, { backgroundColor: METRIC_ACCENTS.bp.bg }]}
              onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${activeId}&type=blood_pressure`)}
              activeOpacity={0.7}
            >
              <Text style={styles.bentoLabel}>血壓</Text>
              <Text style={[styles.bentoValueLg, { color: METRIC_ACCENTS.bp.bar }]}>
                {activeBp?.systolic && activeBp?.diastolic ? `${Math.round(activeBp.systolic.avg)}/${Math.round(activeBp.diastolic.avg)}` : '--'}
              </Text>
              <Text style={styles.bentoUnit}>mmHg · 7日均值</Text>
              <Text style={styles.bentoAction}>記錄 →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bentoLarge, { backgroundColor: METRIC_ACCENTS.bg.bg }]}
              onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${activeId}&type=blood_glucose`)}
              activeOpacity={0.7}
            >
              <Text style={styles.bentoLabel}>血糖</Text>
              <Text style={[styles.bentoValueLg, { color: METRIC_ACCENTS.bg.bar }]}>
                {activeBg?.glucose_value ? Math.round(activeBg.glucose_value.avg).toString() : '--'}
              </Text>
              <Text style={styles.bentoUnit}>mg/dL · 7日均值</Text>
              <Text style={styles.bentoAction}>記錄 →</Text>
            </TouchableOpacity>
          </View>

          {/* ── Row 3: Illustration card (2×1) + stats column (1×1 + 1×1) ── */}
          <View style={styles.bentoRow}>
            {/* Left: illustration placeholder — replace with real image later */}
            <TouchableOpacity
              style={styles.illustCard}
              onPress={() => router.push(`/(tabs)/home/${activeId}`)}
              activeOpacity={0.8}
            >
              {/* Abstract caring illustration — SVG shapes */}
              <View style={styles.illustGraphic}>
                <Svg width={100} height={70} viewBox="0 0 130 95">
                  {/* House body */}
                  <Rect x="30" y="42" width="60" height="45" rx="4" fill={colors.primary} opacity={0.12} />
                  {/* Roof */}
                  <Path d="M25 45 L60 18 L95 45Z" fill={colors.primary} opacity={0.18} />
                  {/* Door */}
                  <Rect x="52" y="62" width="16" height="25" rx="3" fill={colors.primary} opacity={0.15} />
                  {/* Heart window */}
                  <Path d="M48 52 C46 48 40 48 40 52 C40 55 48 60 48 60 C48 60 56 55 56 52 C56 48 50 48 48 52Z"
                    fill={colors.accent} opacity={0.5} />
                  {/* Right window */}
                  <Rect x="66" y="48" width="12" height="10" rx="2" fill={colors.bgSurface} opacity={0.5} />
                  {/* Chimney */}
                  <Rect x="76" y="22" width="8" height="18" rx="2" fill={colors.primary} opacity={0.12} />
                  {/* Smoke puffs */}
                  <Circle cx="80" cy="18" r="3" fill={colors.textDisabled} opacity={0.2} />
                  <Circle cx="84" cy="12" r="4" fill={colors.textDisabled} opacity={0.15} />
                  <Circle cx="82" cy="5" r="3.5" fill={colors.textDisabled} opacity={0.1} />
                  {/* Floating decorations */}
                  <Circle cx="110" cy="30" r="6" fill={colors.accent} opacity={0.12} />
                  <Circle cx="15" cy="55" r="5" fill={colors.primary} opacity={0.1} />
                  {/* Sparkles */}
                  <Path d="M108 55 L110 51 L112 55 L116 57 L112 59 L110 63 L108 59 L104 57Z" fill={colors.primary} opacity={0.15} />
                  <Path d="M18 35 L19 32 L20 35 L23 36 L20 37 L19 40 L18 37 L15 36Z" fill={colors.accent} opacity={0.2} />
                </Svg>
              </View>
              <Text style={styles.illustTitle}>{activeRecipient?.name ?? ''} 的照護摘要</Text>
              <Text style={styles.illustSub}>查看詳細資料 →</Text>
            </TouchableOpacity>

            {/* Right: two stacked mini cards */}
            <View style={styles.bentoStackCol}>
              <TouchableOpacity
                style={[styles.bentoMini, { backgroundColor: METRIC_ACCENTS.abnormal.bg }]}
                onPress={() => router.push(`/(tabs)/health/trends?recipientId=${activeId}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.bentoMiniLabel}>異常</Text>
                <Text style={[styles.bentoMiniValue, abnormalTotal > 0 && { color: colors.danger }]}>
                  {abnormalTotal}
                </Text>
                <Text style={styles.bentoMiniUnit}>筆</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bentoMini, { backgroundColor: METRIC_ACCENTS.count.bg }]}
                onPress={() => router.push(`/(tabs)/health?recipientId=${activeId}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.bentoMiniLabel}>量測</Text>
                <Text style={styles.bentoMiniValue}>{measureTotal}</Text>
                <Text style={styles.bentoMiniUnit}>筆</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Row 4: Appointments (if any) ──── */}
          {appointments.length > 0 && (
            <View style={styles.apptCard}>
              <Text style={styles.apptCardTitle}>近期行程</Text>
              {appointments.map((appt) => {
                const d = new Date(appt.appointment_date);
                const dateStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
                const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                return (
                  <View key={appt.id} style={styles.apptRow}>
                    <View style={styles.apptDateCol}>
                      <Text style={styles.apptDate}>{dateStr}</Text>
                      <Text style={styles.apptTime}>{timeStr}</Text>
                    </View>
                    <View style={styles.apptDivider} />
                    <View style={styles.apptDetail}>
                      <Text style={styles.apptTitle} numberOfLines={1}>{appt.title}</Text>
                      <Text style={styles.apptMeta} numberOfLines={1}>
                        {appt.recipientRelationship ? `${RELATIONSHIP_LABELS[appt.recipientRelationship] ?? ''} — ${maskName(appt.recipientName)}` : maskName(appt.recipientName)}
                        {appt.hospital_name ? ` · ${appt.hospital_name}` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Row 5: Service categories (2×4) ─ */}
          {categories.length > 0 && (
            <View style={styles.catSection}>
              <Text style={styles.catSectionTitle}>服務項目</Text>
              <View style={styles.catGrid}>
                {categories.map((cat) => {
                  const catColor = SERVICE_CATEGORY_COLORS[cat.code] ?? { icon: colors.primary, bg: colors.primaryLight };
                  const IconComp = SERVICE_ICONS[cat.code];
                  return (
                    <TouchableOpacity key={cat.id} style={[styles.catCard, { backgroundColor: catColor.bg }]} onPress={() => router.push(`/(tabs)/services/new-request?categoryId=${cat.id}`)} activeOpacity={0.7}>
                      {IconComp && <View style={styles.catIconWrap}><IconComp size={22} color={catColor.icon} /></View>}
                      <Text style={[styles.catName, { color: catColor.icon }]}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ── FAB ──────────────────────────────── */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/(tabs)/services/new-request')} activeOpacity={0.85} accessibilityLabel="新增服務需求">
        <Text style={styles.fabText}>＋ 服務需求</Text>
      </TouchableOpacity>

      {/* ── Menu Modal ───────────────────────── */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {/* block */}}>
            <Text style={styles.sheetTitle}>選單</Text>
            {[
              { label: '個人資料管理', onPress: () => router.push('/(tabs)/home/profile') },
              { label: '服務需求紀錄', onPress: () => router.push('/(tabs)/services') },
              { label: '通知', onPress: () => router.push('/(tabs)/home/notifications') },
              { label: '新增被照護者', onPress: () => router.push('/(tabs)/home/add-recipient') },
              { label: '提醒設定', onPress: () => {
                const rid = activeRecipient?.id;
                if (rid) router.push(`/(tabs)/home/${rid}`);
                else Alert.alert('提示', '請先新增被照護者');
              }},
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.sheetItem}
                onPress={() => { setMenuVisible(false); item.onPress(); }}
                activeOpacity={0.7}
              >
                <Text style={styles.sheetItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.sheetDivider} />
            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => { setMenuVisible(false); void logout().then(() => router.replace('/(auth)/login')); }}
              activeOpacity={0.7}
            >
              <Text style={styles.sheetItemDanger}>登出</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── AI BottomSheet ────────────────────── */}
      <Modal visible={aiSheetVisible} transparent animationType="slide" onRequestClose={() => setAiSheetVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setAiSheetVisible(false)}>
          <Pressable style={styles.aiSheet} onPress={() => {/* block */}}>
            <Text style={styles.sheetTitle}>AI 安心報</Text>
            {recipients.map((r) => {
              const rpt = latestReports[r.id];
              if (!rpt) return null;
              const dot = STATUS_DOT[rpt.status_label] ?? colors.textDisabled;
              return (
                <View key={r.id} style={styles.aiItem}>
                  <View style={[styles.aiDot, { backgroundColor: dot }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aiName}>{r.name}</Text>
                    <Text style={styles.aiSummary} numberOfLines={2}>{rpt.summary}</Text>
                  </View>
                </View>
              );
            })}
            <TouchableOpacity
              style={styles.aiCta}
              onPress={() => { setAiSheetVisible(false); router.push('/(tabs)/ai'); }}
              activeOpacity={0.7}
            >
              <Text style={styles.aiCtaText}>查看完整安心報 →</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bgScreen },
  loadingText: { marginTop: spacing.sm, fontSize: typography.bodySm.fontSize, color: colors.textTertiary },
  logoutBtn: { marginTop: spacing.lg, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  logoutBtnText: { color: colors.textDisabled, fontSize: typography.caption.fontSize },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing['3xl'] },

  // ─── Header ─────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { fontSize: 19, fontWeight: '700', color: colors.accent },
  greeting: { fontSize: typography.headingMd.fontSize, fontWeight: '700', color: colors.textPrimary },
  greetingSub: { fontSize: typography.caption.fontSize, color: colors.textDisabled, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.bgSurfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontSize: 18 },
  badge: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: colors.accent, borderRadius: radius.full,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xs, borderWidth: 2, borderColor: colors.bgScreen,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },

  // ─── Recipient Switcher ─────────────────────────────────────
  switcherScroll: { maxHeight: 48 },
  switcherContent: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.xs },
  switcherChip: {
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2,
    borderRadius: radius.full, backgroundColor: colors.bgSurfaceAlt,
  },
  switcherChipActive: { backgroundColor: colors.primary },
  switcherText: { fontSize: typography.bodyMd.fontSize, color: colors.textTertiary, fontWeight: '600' },
  switcherTextActive: { color: colors.white, fontWeight: '700' },

  // ─── Bento Container ───────────────────────────────────────
  bento: { paddingHorizontal: spacing.lg, gap: 6, marginTop: spacing.xs },

  // ─── Hero Card ─────────────────────────────────────────────
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.low,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ringContainer: { position: 'relative', width: 88, height: 88 },
  ringCenter: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  ringScore: { fontSize: 30, fontWeight: '700' },
  ringLabel: { fontSize: typography.captionSm.fontSize, color: colors.textTertiary, marginTop: -3, fontWeight: '500' },
  heroInfo: { flex: 1 },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  heroDot: { width: 8, height: 8, borderRadius: 4 },
  heroStatusText: { fontSize: typography.headingSm.fontSize, fontWeight: '700', color: colors.textPrimary },
  heroSummary: { fontSize: typography.bodySm.fontSize, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.md },
  heroActions: { flexDirection: 'row', gap: spacing.sm },
  heroBtn: {
    backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: radius.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
  },
  heroBtnText: { fontSize: typography.bodySm.fontSize, fontWeight: '700', color: colors.primaryText },
  heroBtnOutline: {
    backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: radius.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
  },
  heroBtnOutlineText: { fontSize: typography.bodySm.fontSize, fontWeight: '600', color: colors.textTertiary },

  // ─── Bento Row (side by side) ──────────────────────────────
  bentoRow: { flexDirection: 'row', gap: spacing.sm },

  // ─── Large metric cards (BP / BG) ──────────────────────────
  bentoLarge: {
    flex: 1, borderRadius: radius.xl, padding: spacing.md,
  },
  bentoLabel: { fontSize: typography.captionSm.fontSize, color: colors.textTertiary, fontWeight: '600' },
  bentoValueLg: { fontSize: 26, fontWeight: '700', marginTop: spacing.xs },
  bentoUnit: { fontSize: 10, color: colors.textDisabled, marginTop: spacing.xxs },
  bentoAction: { fontSize: 10, color: colors.textTertiary, fontWeight: '600', marginTop: spacing.sm },

  // ─── Illustration card (2×1 wide) ─────────────────────────
  illustCard: {
    flex: 1.2, backgroundColor: colors.primaryLight, borderRadius: radius.xl,
    padding: spacing.md, justifyContent: 'flex-end',
    height: 150, overflow: 'hidden',
  },
  illustGraphic: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  illustTitle: { fontSize: typography.bodyMd.fontSize, fontWeight: '700', color: colors.textPrimary },
  illustSub: { fontSize: typography.caption.fontSize, color: colors.primaryText, marginTop: spacing.xs, fontWeight: '600' },

  // ─── Stacked mini cards column ─────────────────────────────
  bentoStackCol: { flex: 0.8, gap: 6 },
  bentoMini: {
    flex: 1, borderRadius: radius.lg, padding: spacing.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  bentoMiniLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: '600' },
  bentoMiniValue: { fontSize: typography.headingMd.fontSize, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.xxs },
  bentoMiniUnit: { fontSize: 9, color: colors.textDisabled, marginTop: 1 },

  // ─── Appointments card ─────────────────────────────────────
  apptCard: {
    backgroundColor: colors.bgSurface, borderRadius: radius.xl,
    padding: spacing.lg, ...shadows.low,
  },
  apptCardTitle: {
    fontSize: typography.headingSm.fontSize, fontWeight: '700',
    color: colors.textPrimary, marginBottom: spacing.md,
  },
  apptRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderDefault,
  },
  apptDateCol: { width: 50, alignItems: 'center' },
  apptDate: { fontSize: typography.bodyMd.fontSize, fontWeight: '700', color: colors.primaryText },
  apptTime: { fontSize: typography.captionSm.fontSize, color: colors.textDisabled, marginTop: 1 },
  apptDivider: { width: 2, height: 28, backgroundColor: colors.primaryLight, marginHorizontal: spacing.md, borderRadius: 1 },
  apptDetail: { flex: 1 },
  apptTitle: { fontSize: typography.bodyMd.fontSize, fontWeight: '600', color: colors.textPrimary },
  apptMeta: { fontSize: typography.caption.fontSize, color: colors.textTertiary, marginTop: spacing.xxs },

  // ─── Service Categories ─────────────────────────────────────
  catSection: { marginTop: spacing.sm },
  catSectionTitle: {
    fontSize: typography.headingSm.fontSize, fontWeight: '700',
    color: colors.textPrimary, marginBottom: spacing.md,
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catCard: {
    width: '22%' as unknown as number, flexGrow: 1,
    borderRadius: radius.lg, paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  catIconWrap: { marginBottom: spacing.sm },
  catName: { fontSize: typography.captionSm.fontSize, fontWeight: '600', textAlign: 'center' },

  // ─── FAB ────────────────────────────────────────────────────
  fab: {
    position: 'absolute', bottom: spacing['2xl'] + spacing.sm, right: spacing.lg,
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: spacing['2xl'], paddingVertical: spacing.md + 2,
    ...shadows.high,
  },
  fabText: { color: colors.white, fontSize: typography.bodyMd.fontSize, fontWeight: '700' },

  // ─── Modals (shared) ────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgSurface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingVertical: spacing.xl, paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'] + spacing.lg,
  },
  sheetTitle: { fontSize: typography.headingSm.fontSize, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.lg },
  sheetItem: { paddingVertical: spacing.md },
  sheetItemText: { fontSize: typography.bodyLg.fontSize, color: colors.textPrimary },
  sheetItemDanger: { fontSize: typography.bodyLg.fontSize, color: colors.danger },
  sheetDivider: { height: 1, backgroundColor: colors.borderDefault, marginVertical: spacing.sm },

  // ─── AI Sheet ───────────────────────────────────────────────
  aiSheet: {
    backgroundColor: colors.bgSurface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingVertical: spacing.xl, paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'] + spacing.lg,
    maxHeight: '55%' as unknown as number,
  },
  aiItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.lg },
  aiDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  aiName: { fontSize: typography.bodyMd.fontSize, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xxs },
  aiSummary: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary, lineHeight: 18 },
  aiCta: {
    backgroundColor: colors.primaryLight, borderRadius: radius.sm,
    paddingVertical: spacing.sm + spacing.xxs, paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start', marginTop: spacing.sm,
  },
  aiCtaText: { fontSize: typography.bodySm.fontSize, fontWeight: '600', color: colors.primaryText },
});
