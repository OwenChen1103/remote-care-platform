import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  RefreshControl,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
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

function formatReportDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
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

// ─── Service category descriptions (for 2×2 cards) ───────────
const SERVICE_DESCRIPTIONS: Record<string, string> = {
  escort_visit: '讓醫生的話更容易懂',
  functional_assessment: '定期掌握身體狀況',
  exercise_program: '專業陪伴安心運動',
  home_cleaning: '乾淨居家安心生活',
};

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

// ─── Component ────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // ── Data state ──
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
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
    setError('');
    try {
      const result = await api.get<Recipient[]>('/recipients');
      setRecipients(result);
      // Auto-select first recipient only on initial load
      setSelectedRecipientId((prev) => prev ?? result[0]?.id ?? null);
      return result;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '載入失敗，請稍後再試');
      return [];
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

  // Initial load: fetch recipients first, then per-recipient data, then mark ready
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!hasLoadedOnce) setLoading(true);
        const recipientList = await fetchRecipients();
        if (cancelled) return;
        await Promise.all([
          fetchUnreadCount(),
          fetchCategories(),
          recipientList.length > 0 ? fetchAllData(recipientList) : Promise.resolve(),
        ]);
        if (cancelled) return;
        setLoading(false);
        setHasLoadedOnce(true);
      })();
      return () => { cancelled = true; };
    }, [fetchRecipients, fetchUnreadCount, fetchCategories, fetchAllData, hasLoadedOnce]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshingAll(true);
    await fetchRecipients();
    await fetchUnreadCount();
    if (recipients.length > 0) await fetchAllData(recipients);
    setRefreshingAll(false);
  }, [fetchRecipients, fetchUnreadCount, fetchAllData, recipients]);

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
    return <LoadingScreen hideMessage />;
  }

  if (!hasLoadedOnce) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <ErrorState message={error} onRetry={() => void fetchRecipients()} />
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => { void logout().then(() => router.replace('/(auth)')); }}
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
            <View style={styles.greetingTextWrap}>
              <Text style={styles.greetingSub}>{(() => {
                const h = new Date().getHours();
                if (h < 12) return '早安';
                if (h < 18) return '午安';
                return '晚安';
              })()}</Text>
              <Text style={styles.greeting}>{user?.name ?? ''}</Text>
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
            CLEAN HOME LAYOUT — unified card style
            ═══════════════════════════════════════ */}
        <View style={styles.bento}>

          {/* ─── Hero (區塊 1 + 區塊 2 合併) — 毛玻璃 + 漸層光暈 ─── */}
          <View style={styles.heroCard}>
            {/* Layer 1: subtle base gradient */}
            <LinearGradient
              colors={['#EDF6FB', '#F2F9F5', '#F1F8E9']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Layer 2: softer blurred halo orbs */}
            <View style={styles.heroHaloTopRight} />
            <View style={styles.heroHaloBottomLeft} />
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

            <Text style={styles.heroTagline}>WE DO.</Text>
            <Text style={styles.heroHeadline}>我們隨時都在</Text>

            {healthResult ? (
              <>
                {/* Inner white card with score */}
                <View style={styles.heroInner}>
                  <View style={styles.ringContainer}>
                    <Svg width={ringSize} height={ringSize}>
                      <Circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} stroke={colors.borderDefault} strokeWidth={strokeW} fill="none" />
                      <AnimatedCircle cx={ringSize / 2} cy={ringSize / 2} r={ringR} stroke={ringColor} strokeWidth={strokeW} fill="none" strokeDasharray={`${circ}`} strokeDashoffset={animatedDashOffset} strokeLinecap="round" transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`} />
                    </Svg>
                    <View style={styles.ringCenter}>
                      <Text style={[styles.ringScore, { color: ringColor }]}>{displayScore}</Text>
                      <Text style={styles.ringLabel}>分</Text>
                    </View>
                  </View>
                  <View style={styles.scoreInfo}>
                    <TouchableOpacity
                      style={styles.scoreNameRow}
                      onPress={() => activeId && router.push(`/(tabs)/home/${activeId}`)}
                      activeOpacity={0.6}
                      disabled={!activeId}
                      accessibilityLabel={`查看 ${activeRecipient?.name ?? ''} 的詳細資料`}
                    >
                      <Text style={styles.scoreName}>{activeRecipient?.name ?? ''} 的健康狀態</Text>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <Path d="M9 6l6 6-6 6" stroke={colors.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </TouchableOpacity>
                    <View style={[styles.statusChip, { backgroundColor: ringColor + '22' }]}>
                      <View style={[styles.statusDot, { backgroundColor: ringColor }]} />
                      <Text style={[styles.statusText, { color: ringColor }]}>{HEALTH_LEVEL_LABELS[healthResult.level]}</Text>
                    </View>
                    {activeReport && (
                      <Text style={styles.scoreMeta}>最近更新：{formatReportDate(activeReport.generated_at)}</Text>
                    )}
                  </View>
                </View>

                {/* CTA buttons */}
                <View style={styles.ctaRow}>
                  <TouchableOpacity
                    style={styles.ctaPrimaryWrap}
                    onPress={() => router.push('/(tabs)/services/new-request')}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.accent]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.ctaPrimary}
                    >
                      <Text style={styles.ctaPrimaryText}>開始安排照顧</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.ctaSecondary}
                    onPress={() => router.push('/(tabs)/health/ai-report')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.ctaSecondaryText}>查看完整報告</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* 無資料版本 — 業主需求 */}
                <View style={styles.heroInner}>
                  <Text style={styles.emptyHeroText}>還沒有健康資料{'\n'}從第一個服務開始守護家人</Text>
                </View>
                <TouchableOpacity
                  style={styles.ctaPrimaryFull}
                  onPress={() => router.push('/(tabs)/services/new-request')}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaPrimary}
                  >
                    <Text style={styles.ctaPrimaryText}>開始安排第一個服務</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ─── 區塊 3: 下一個行程 ─── */}
          {appointments.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>下一個行程</Text>
                {recipients.length === 1 && recipients[0] && (
                  <TouchableOpacity onPress={() => router.push(`/(tabs)/home/appointments?recipientId=${recipients[0]!.id}`)}>
                    <Text style={styles.sectionLink}>查看全部 →</Text>
                  </TouchableOpacity>
                )}
              </View>
              {appointments.slice(0, 1).map((appt) => {
                const d = new Date(appt.appointment_date);
                const day = d.getDate();
                const month = d.getMonth() + 1;
                const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                const weekday = weekdays[d.getDay()] ?? '';
                const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                const relLabel = appt.recipientRelationship ? RELATIONSHIP_LABELS[appt.recipientRelationship] ?? '' : '';
                return (
                  <TouchableOpacity
                    key={appt.id}
                    style={styles.apptCard}
                    onPress={() => router.push(`/(tabs)/home/appointments?recipientId=${activeId}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.apptDate}>
                      <Text style={styles.apptDay}>{day}</Text>
                      <Text style={styles.apptMonth}>{month}月 ({weekday})</Text>
                    </View>
                    <View style={styles.apptDivider} />
                    <View style={styles.apptInfo}>
                      <Text style={styles.apptTitle} numberOfLines={1}>
                        {appt.title}｜{relLabel}{relLabel ? ' ' : ''}{maskName(appt.recipientName)}
                      </Text>
                      <Text style={styles.apptMeta} numberOfLines={1}>
                        {timeStr}{appt.hospital_name ? ` · ${appt.hospital_name}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.apptArrow}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ─── 圖文 + 影音預留（業主要求 — 報導/電商/宣傳影片）─── */}
          <View style={styles.mediaRow}>
            <View style={[styles.mediaPlaceholder, { flex: 1 }]}>
              <Text style={styles.mediaIcon}>▦</Text>
              <Text style={styles.mediaText}>圖文位置</Text>
              <Text style={styles.mediaHint}>報導 / 電商</Text>
            </View>
            <View style={[styles.mediaPlaceholder, { flex: 1 }]}>
              <Text style={styles.mediaIcon}>▷</Text>
              <Text style={styles.mediaText}>影音位置</Text>
              <Text style={styles.mediaHint}>宣傳影片</Text>
            </View>
          </View>

          {/* ─── 區塊 4: 服務 2×2 ─── */}
          {categories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>為您安排服務</Text>
              <View style={styles.svcGrid}>
                {categories.slice(0, 4).map((cat, idx) => {
                  const IconComp = SERVICE_ICONS[cat.code];
                  const desc = SERVICE_DESCRIPTIONS[cat.code] ?? '';
                  // alternating: 0,3 = blue / 1,2 = green
                  const isGreen = idx === 1 || idx === 2;
                  const iconBg = isGreen ? colors.accentLight : colors.primaryLight;
                  const iconColor = isGreen ? colors.accent : colors.primary;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={styles.svcCard}
                      onPress={() => router.push(`/(tabs)/services/new-request?categoryId=${cat.id}`)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.svcIconWrap, { backgroundColor: iconBg }]}>
                        {IconComp && <IconComp size={20} color={iconColor} />}
                      </View>
                      <Text style={styles.svcName}>{cat.name}</Text>
                      {desc ? <Text style={styles.svcDesc}>{desc}</Text> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ─── 區塊 5: 安心機制 ─── */}
          <View style={styles.trustRow}>
            {[
              { title: '即時紀錄', desc: '完整服務記錄' },
              { title: 'AI 摘要', desc: '整理醫囑重點' },
              { title: '嚴選人員', desc: '證照審核把關' },
            ].map((t, i) => (
              <View key={t.title} style={styles.trustGroup}>
                <View style={styles.trustItem}>
                  <View style={styles.trustIconCircle}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M5 12l5 5L20 7" stroke={colors.accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <Text style={styles.trustTitle}>{t.title}</Text>
                  <Text style={styles.trustDesc}>{t.desc}</Text>
                </View>
                {i < 2 && <View style={styles.trustDivider} />}
              </View>
            ))}
          </View>

          {/* ─── 區塊 6: AI 入口 ─── */}
          <LinearGradient
            colors={[colors.primaryLight, colors.accentLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiSection}
          >
            <Text style={styles.aiTitle}>需要幫忙嗎？</Text>
            <View style={styles.aiChipsRow}>
              <TouchableOpacity style={styles.aiChip} onPress={() => router.push('/(tabs)/ai')} activeOpacity={0.7}>
                <Text style={styles.aiChipText}>常見問題</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.aiChip} onPress={() => router.push('/(tabs)/services/new-request')} activeOpacity={0.7}>
                <Text style={styles.aiChipText}>幫我安排服務</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.aiChip} onPress={() => router.push('/(tabs)/services')} activeOpacity={0.7}>
                <Text style={styles.aiChipText}>了解流程</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ── FAB ──────────────────────────────── */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/(tabs)/services/new-request')} activeOpacity={0.85} accessibilityLabel="新增服務需求">
        <Text style={styles.fabText}>＋ 服務需求</Text>
      </TouchableOpacity>

      {/* ── Menu Modal ───────────────────────── */}
      <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.menuSheet} onPress={() => {/* block */}}>
            {/* Drag handle */}
            <View style={styles.dragHandle} />

            {/* Profile header */}
            <View style={styles.menuProfileRow}>
              <View style={styles.menuAvatar}>
                <Text style={styles.menuAvatarText}>{firstName}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuName}>{user?.name ?? ''}</Text>
                <Text style={styles.menuEmail}>{user?.email ?? ''}</Text>
              </View>
            </View>

            {/* Group: 我的 */}
            <Text style={styles.menuGroupLabel}>我的</Text>
            {[
              { label: '個人資料', icon: 'user', onPress: () => router.push('/(tabs)/home/profile') },
              { label: '通知中心', icon: 'bell', onPress: () => router.push('/(tabs)/home/notifications') },
              // PDF p1 「漢堡頁：個人資料管理、首頁、訂單紀錄、設定等項目」— MVP 階段唯一有意義的
              // 設定項是被照護者量測提醒。直接連到對應 recipient 詳情頁的提醒區段，避免重做設定頁。
              { label: '量測提醒', icon: 'alarm', onPress: () => {
                if (recipients.length === 0) {
                  Alert.alert('提示', '請先新增被照護者，才能設定量測提醒');
                } else if (recipients.length === 1) {
                  // Single recipient → straight to detail page where the reminder section lives.
                  router.push(`/(tabs)/home/${recipients[0]!.id}`);
                } else {
                  // Multiple recipients → user already on home; hint to pick a card.
                  Alert.alert('選擇被照護者', '請從首頁的被照護者卡片進入要設定量測提醒的對象。');
                }
              }},
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={() => { setMenuVisible(false); item.onPress(); }}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemIconWrap}>
                  {item.icon === 'user' && (
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Circle cx="12" cy="8" r="4" stroke={colors.primary} strokeWidth={1.8} />
                      <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
                    </Svg>
                  )}
                  {item.icon === 'bell' && (
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
                      <Path d="M13.7 21a2 2 0 01-3.4 0" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
                    </Svg>
                  )}
                  {item.icon === 'alarm' && (
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Circle cx="12" cy="13" r="8" stroke={colors.primary} strokeWidth={1.8} />
                      <Path d="M12 9v4l3 2M5 4l-2 2M19 4l2 2" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
                    </Svg>
                  )}
                </View>
                <Text style={styles.menuItemText}>{item.label}</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>
            ))}

            {/* Group: 照護管理 */}
            <Text style={styles.menuGroupLabel}>照護管理</Text>
            {[
              { label: '新增被照護者', icon: 'add', onPress: () => router.push('/(tabs)/home/add-recipient') },
              { label: '服務需求紀錄', icon: 'list', onPress: () => router.push('/(tabs)/services') },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={() => { setMenuVisible(false); item.onPress(); }}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemIconWrap}>
                  {item.icon === 'add' && (
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Circle cx="12" cy="8" r="4" stroke={colors.accent} strokeWidth={1.8} />
                      <Path d="M4 21c0-4 4-7 8-7" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" />
                      <Path d="M17 14v6M14 17h6" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
                    </Svg>
                  )}
                  {item.icon === 'list' && (
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Rect x="4" y="4" width="16" height="16" rx="2" stroke={colors.accent} strokeWidth={1.8} />
                      <Path d="M8 9h8M8 13h8M8 17h5" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" />
                    </Svg>
                  )}
                </View>
                <Text style={styles.menuItemText}>{item.label}</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>
            ))}

            {/* Logout — separate, danger */}
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setMenuVisible(false); void logout().then(() => router.replace('/(auth)')); }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuItemIconWrap, { backgroundColor: colors.dangerLight }]}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={colors.danger} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[styles.menuItemText, { color: colors.danger }]}>登出</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── AI BottomSheet ────────────────────── */}
      <Modal visible={aiSheetVisible} transparent animationType="slide" onRequestClose={() => setAiSheetVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setAiSheetVisible(false)}>
          <Pressable style={styles.aiSheet} onPress={() => {/* block */}}>
            <Text style={styles.aiSheetTitle}>AI 安心報</Text>
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
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.primary,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.primaryText },
  greetingTextWrap: { flex: 1, justifyContent: 'center' },
  greetingSub: { fontSize: 11, color: colors.textTertiary, fontWeight: '500', marginBottom: 2, letterSpacing: 0.3 },
  greeting: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderDefault,
    alignItems: 'center', justifyContent: 'center',
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
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.full,
  },
  switcherChipActive: { backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary },
  switcherText: { fontSize: typography.bodySm.fontSize, color: colors.textSecondary, fontWeight: '500' },
  switcherTextActive: { color: colors.primaryText, fontWeight: '700' },

  // ─── Container ─────────────────────────────────────────────
  bento: { paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: spacing.md },

  // ─── Hero Card (區塊 1 + 2) — 雙層 + 漸層 ──────────────
  heroCard: {
    borderRadius: 24,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(46,141,201,0.12)',
    overflow: 'hidden',
    position: 'relative',
  },
  heroHaloTopRight: {
    position: 'absolute',
    top: -50, right: -50,
    width: 180, height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(93,169,69,0.25)',
  },
  heroHaloBottomLeft: {
    position: 'absolute',
    bottom: -40, left: -40,
    width: 160, height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(46,141,201,0.22)',
  },
  heroInner: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 18,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  heroTagline: {
    fontSize: 10, fontWeight: '700',
    color: colors.primary, letterSpacing: 3, textAlign: 'center',
    marginBottom: 2,
  },
  heroHeadline: {
    fontSize: 15, fontWeight: '600', color: colors.textPrimary,
    textAlign: 'center', letterSpacing: 1, marginBottom: spacing.md,
  },
  scoreRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  ringContainer: { position: 'relative', width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  ringCenter: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  ringScore: { fontSize: 30, fontWeight: '700', lineHeight: 36 },
  ringLabel: { fontSize: typography.captionSm.fontSize, color: colors.textTertiary, fontWeight: '500', marginTop: -4 },
  scoreInfo: { flex: 1, gap: spacing.xs },
  scoreNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  scoreName: { fontSize: typography.bodyMd.fontSize, fontWeight: '600', color: colors.textSecondary },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md, paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: typography.captionSm.fontSize, fontWeight: '700' },
  scoreMeta: { fontSize: typography.captionSm.fontSize, color: colors.textTertiary, marginTop: 2 },

  // ─── CTA buttons ───────────────────────────────────────────
  ctaRow: { flexDirection: 'row', gap: spacing.sm },
  ctaPrimaryWrap: {
    flex: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  ctaPrimary: {
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimaryText: {
    color: colors.white,
    fontSize: typography.bodySm.fontSize,
    fontWeight: '700',
    letterSpacing: 1,
  },
  ctaSecondary: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  ctaSecondaryText: {
    color: colors.textPrimary,
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
  },

  // ─── Empty Hero ────────────────────────────────────────────
  emptyHero: {
    backgroundColor: colors.bgSurfaceAlt,
    borderRadius: radius.xl,
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyHeroText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  ctaPrimaryFull: {
    width: '100%',
    borderRadius: radius.full,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },

  // ─── Media Placeholders ────────────────────────────────────
  mediaRow: { flexDirection: 'row', gap: spacing.sm },
  mediaPlaceholder: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault, borderStyle: 'dashed',
    paddingVertical: spacing.xl,
    alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 120,
  },
  mediaIcon: {
    fontSize: 22, color: colors.borderStrong, fontWeight: '300',
    marginBottom: spacing.xs,
  },
  mediaText: { fontSize: typography.bodySm.fontSize, color: colors.textSecondary, fontWeight: '600' },
  mediaHint: { fontSize: typography.captionSm.fontSize, color: colors.textDisabled },

  // ─── Section ───────────────────────────────────────────────
  section: { gap: spacing.sm },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: {
    fontSize: typography.headingSm.fontSize, fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionLink: { fontSize: typography.captionSm.fontSize, color: colors.primary, fontWeight: '500' },

  // ─── Appointment Card (區塊 3) ────────────────────────────
  apptCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  apptDate: { width: 60, alignItems: 'center' },
  apptDay: { fontSize: 22, fontWeight: '700', color: colors.primaryText, lineHeight: 24 },
  apptMonth: { fontSize: typography.captionSm.fontSize, color: colors.textTertiary, marginTop: 2 },
  apptDivider: { width: 1, height: 36, backgroundColor: colors.borderDefault },
  apptInfo: { flex: 1 },
  apptTitle: { fontSize: typography.bodyMd.fontSize, fontWeight: '600', color: colors.textPrimary },
  apptMeta: { fontSize: typography.caption.fontSize, color: colors.textTertiary, marginTop: 2 },
  apptArrow: { fontSize: 22, color: colors.borderStrong, fontWeight: '300' },

  // ─── Service Grid (區塊 4) ─────────────────────────────
  svcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  svcCard: {
    width: '47%' as unknown as number, flexGrow: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
  },
  svcIconWrap: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  svcName: { fontSize: typography.bodyMd.fontSize, fontWeight: '700', color: colors.textPrimary },
  svcDesc: { fontSize: typography.captionSm.fontSize, color: colors.textTertiary, marginTop: 4, lineHeight: 16 },

  // ─── Trust Row (區塊 5) ────────────────────────────────
  trustRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.sm,
  },
  trustGroup: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  trustItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  trustIconCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  trustTitle: { fontSize: typography.captionSm.fontSize, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  trustDesc: { fontSize: 10, color: colors.textTertiary, textAlign: 'center', lineHeight: 14 },
  trustDivider: { width: 1, height: 32, backgroundColor: colors.borderDefault, alignSelf: 'center' },

  // ─── AI Section (區塊 6) ──────────────────────────────
  aiSection: {
    borderRadius: 22,
    padding: spacing.lg,
  },
  aiTitle: {
    fontSize: typography.bodyMd.fontSize, fontWeight: '700',
    color: colors.textPrimary, marginBottom: spacing.md,
  },
  aiChipsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  aiChip: {
    backgroundColor: colors.bgSurface,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: 'rgba(46,141,201,0.15)',
  },
  aiChipText: { fontSize: typography.captionSm.fontSize, color: colors.primaryText, fontWeight: '500' },

  // ─── Ad Placeholder ───────────────────────────────────────
  adPlaceholder: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault, borderStyle: 'dashed',
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
  },
  adText: { fontSize: typography.captionSm.fontSize, color: colors.textDisabled, letterSpacing: 1 },

  // ─── FAB ────────────────────────────────────────────────────
  fab: {
    position: 'absolute', bottom: spacing['2xl'] + spacing.sm, right: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  fabText: { color: colors.primaryText, fontSize: typography.bodySm.fontSize, fontWeight: '600' },

  // ─── Modals (shared) ────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },

  // Menu Sheet (redesigned)
  menuSheet: {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: spacing.sm, paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'] + spacing.lg,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  menuProfileRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.borderDefault,
    marginBottom: spacing.sm,
  },
  menuAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  menuAvatarText: { fontSize: 20, fontWeight: '700', color: colors.primaryText },
  menuName: { fontSize: typography.bodyLg.fontSize, fontWeight: '700', color: colors.textPrimary },
  menuEmail: { fontSize: typography.captionSm.fontSize, color: colors.textTertiary, marginTop: 2 },
  menuGroupLabel: {
    fontSize: 11, fontWeight: '700',
    color: colors.textTertiary, letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: spacing.md, marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  menuItemIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  menuItemText: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  menuItemArrow: {
    fontSize: 22,
    color: colors.borderStrong,
    fontWeight: '300',
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.borderDefault,
    marginVertical: spacing.md,
    marginHorizontal: spacing.sm,
  },

  // ─── AI Sheet ───────────────────────────────────────────────
  aiSheetTitle: { fontSize: typography.headingSm.fontSize, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.lg },
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
