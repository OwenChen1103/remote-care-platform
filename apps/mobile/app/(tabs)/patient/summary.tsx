import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import {
  calculateHealthScore,
  HEALTH_LEVEL_LABELS,
  BP_THRESHOLDS,
} from '@remote-care/shared';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

// ─── Types ────────────────────────────────────────────────────

interface Recipient {
  id: string;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
  medical_tags: string[];
}

interface Measurement {
  id: string;
  type: string;
  systolic: number | null;
  diastolic: number | null;
  heart_rate: number | null;
  glucose_value: number | null;
  glucose_timing: string | null;
  is_abnormal: boolean;
  measured_at: string;
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
  title: string;
  hospital_name: string | null;
  appointment_date: string;
}

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  type: string;
  // Section 2.9.4: included in deep-link payload (service_request_id, target_status, etc.)
  data?: Record<string, unknown> | null;
}

// Section 1.7.5: latest AI 安心報 surfaced inside patient summary.
interface LatestReport {
  id: string;
  status_label: string;
  summary: string;
  generated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function formatAppointmentDate(dateStr: string): { month: string; day: string } {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { month, day };
}

function formatNotificationTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return '剛剛';
  if (diffHours < 24) return `${diffHours} 小時前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getBPStatus(systolic: number, diastolic: number): { label: string; isHigh: boolean } {
  if (systolic >= BP_THRESHOLDS.SYSTOLIC.HIGH || diastolic >= BP_THRESHOLDS.DIASTOLIC.HIGH) {
    return { label: '偏高', isHigh: true };
  }
  if (systolic >= BP_THRESHOLDS.SYSTOLIC.NORMAL_HIGH || diastolic >= BP_THRESHOLDS.DIASTOLIC.NORMAL_HIGH) {
    return { label: '稍高', isHigh: true };
  }
  return { label: '正常', isHigh: false };
}

function getBGStatus(value: number): { label: string; isHigh: boolean } {
  if (value >= 126 || value < 70) return { label: '異常', isHigh: true };
  if (value >= 100) return { label: '稍高', isHigh: true };
  return { label: '正常', isHigh: false };
}

function getScoreRingColor(level: string): string {
  switch (level) {
    case 'excellent': return colors.success;
    case 'good':      return colors.primary;
    case 'fair':      return colors.warning;
    default:          return colors.danger;
  }
}

function getScoreSummary(level: string): string {
  switch (level) {
    case 'excellent': return '您近期的身體狀況很好，繼續保持！';
    case 'good':      return '整體狀況不錯，請繼續規律量測。';
    case 'fair':      return '近期有些數值需要留意，請多休息。';
    default:          return '請聯繫您的照護人員，多加關心健康。';
  }
}

// ─── SVG Icons (stroke style) ─────────────────────────────────

function IconHeart({ size = 18, color = colors.danger }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s-7-4.5-7-11a4 4 0 017-2.5A4 4 0 0119 10c0 6.5-7 11-7 11z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconDrop({ size = 18, color = colors.warning }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2C8 6 5 9 5 14a7 7 0 0014 0c0-5-3-8-7-12z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconCalendar({ size = 16, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M3 9h18M8 3v4M16 3v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconBell({ size = 16, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
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
function IconChevron({ size = 14, color = colors.textTertiary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconWarning({ size = 18, color = colors.danger }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 9v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx="12" cy="17" r="0.8" fill={color} />
    </Svg>
  );
}
function IconBellMenu({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconUserMenu({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={1.8} fill="none" />
      <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconCalendarMenu({ color = colors.accent }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M3 9h18M8 3v4M16 3v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconLogout({ color = colors.danger }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Score Ring ───────────────────────────────────────────────

function HealthScoreRing({ score, level }: { score: number; level: string }) {
  const size = 96;
  const strokeWidth = 7;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = Math.max(0, Math.min(1, score / 100));
  const strokeDashoffset = circumference * (1 - progress);
  const ringColor = getScoreRingColor(level);

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.borderDefault}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={ringColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

// ─── Notification Icon ─────────────────────────────────────────

function NotificationIcon({ type }: { type: string }) {
  if (type === 'abnormal_alert' || type === 'alert') {
    return (
      <View style={[s.notifIconWrap, { backgroundColor: colors.dangerLight }]}>
        <IconWarning size={18} color={colors.danger} />
      </View>
    );
  }
  if (type === 'appointment_reminder') {
    return (
      <View style={[s.notifIconWrap, { backgroundColor: colors.accentLight }]}>
        <IconCalendar size={18} color={colors.accent} />
      </View>
    );
  }
  return (
    <View style={[s.notifIconWrap, { backgroundColor: colors.primaryLight }]}>
      <IconBell size={18} color={colors.primary} />
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function PatientSummaryScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);

  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [bpStats, setBpStats] = useState<MeasurementStats | null>(null);
  const [bgStats, setBgStats] = useState<MeasurementStats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Section 1.7.5: latest AI 安心報 (most-recent health_summary report).
  const [latestReport, setLatestReport] = useState<LatestReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const recipientsData = await api.get<Recipient[]>('/recipients?limit=1');
      const first = recipientsData[0] ?? null;
      setRecipient(first);
      if (!first) {
        setMeasurements([]);
        setBpStats(null);
        setBgStats(null);
        setAppointments([]);
        setNotifications([]);
        setLatestReport(null);
        return;
      }

      // Section 1.7.5: fetch all dashboard data in parallel; allSettled so a single
      // failure doesn't black-hole the whole dashboard.
      const [mData, bpStatsData, bgStatsData, apptData, notifData, reportData] = await Promise.allSettled([
        api.get<Measurement[]>(`/measurements?recipient_id=${first.id}&limit=10`),
        api.get<MeasurementStats>(`/measurements/stats?recipient_id=${first.id}&type=blood_pressure&period=7d`),
        api.get<MeasurementStats>(`/measurements/stats?recipient_id=${first.id}&type=blood_glucose&period=7d`),
        api.get<Appointment[]>(`/appointments?recipient_id=${first.id}&limit=3`),
        api.get<Notification[]>('/notifications?limit=3'),
        api.get<LatestReport[]>(`/ai/reports?recipient_id=${first.id}&report_type=health_summary&limit=1`),
      ]);

      setMeasurements(mData.status === 'fulfilled' ? mData.value : []);
      setBpStats(bpStatsData.status === 'fulfilled' ? bpStatsData.value : null);
      setBgStats(bgStatsData.status === 'fulfilled' ? bgStatsData.value : null);
      setAppointments(apptData.status === 'fulfilled' ? apptData.value : []);
      setNotifications(notifData.status === 'fulfilled' ? notifData.value : []);
      setLatestReport(reportData.status === 'fulfilled' ? (reportData.value[0] ?? null) : null);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('載入資料失敗');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchData();
  }, [fetchData]);

  // ── Derived data ──────────────────────────────────────────
  const latestBP = measurements.find((m) => m.type === 'blood_pressure');
  const latestBG = measurements.find((m) => m.type === 'blood_glucose');

  const { score, level } = calculateHealthScore({ bpStats, bgStats });

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{error}</Text>
      </View>
    );
  }

  // Section 1.7.3: actionable empty state — patient logs in but caregiver hasn't bound them yet.
  // Shows their email so they know what to share with the caregiver, plus refresh CTA.
  if (!recipient) {
    return (
      <ScrollView
        contentContainerStyle={s.emptyStateWrap}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={s.emptyHeroIcon}>
          <Text style={{ fontSize: 36 }}>💚</Text>
        </View>
        <Text style={s.emptyTitle}>尚未連結照護資料</Text>
        <Text style={s.emptySubtitle}>
          請通知您的家屬（委託人）在 App 的「新增/編輯被照護者」頁，於「邀請被照護者帳號」區塊輸入您註冊的 Email：
        </Text>
        <View style={s.emptyEmailPill}>
          <Text style={s.emptyEmailText}>{user?.email}</Text>
        </View>
        <TouchableOpacity style={s.emptyRefreshBtn} onPress={onRefresh} activeOpacity={0.8}>
          <Text style={s.emptyRefreshText}>重新整理</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tabs)/patient/profile')} activeOpacity={0.7}>
          <Text style={s.emptySecondaryLink}>編輯個人資料</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const displayName = recipient.name || user?.name || '您';
  const initial = displayName.charAt(0);
  const greetingTime = (() => {
    const h = new Date().getHours();
    if (h < 12) return '早安';
    if (h < 18) return '午安';
    return '晚安';
  })();
  const ringColor = getScoreRingColor(level);

  // ── Render ────────────────────────────────────────────────
  return (
    <View style={s.screen}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Top Bar ─────────────────────────────────────── */}
        <View style={s.topBar}>
          <View style={s.topLeft}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
            <View style={s.greetingTextWrap}>
              <Text style={s.greetingSub}>{greetingTime}</Text>
              <Text style={s.greeting}>{displayName}</Text>
            </View>
          </View>
          <View style={s.topRight}>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => router.push('/(tabs)/home/notifications')}
              accessibilityLabel="通知"
            >
              <IconBell size={20} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => setMenuVisible(true)} accessibilityLabel="選單">
              <IconMenu />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Glass Hero (health score + summary) ──────────── */}
        <View style={s.hero}>
          <LinearGradient
            colors={['#E5F2FB', '#EDF7E8', '#F8FAFC']}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.heroHaloTopRight} />
          <View style={s.heroHaloBottomLeft} />
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

          <View style={s.heroContent}>
            <Text style={s.heroTagline}>HEALTH STATUS</Text>
            <Text style={s.heroSubtitle}>今日健康狀態</Text>

            <View style={s.heroBody}>
              <View style={s.ringWrap}>
                <HealthScoreRing score={score} level={level} />
                <View style={s.ringCenter}>
                  <Text style={[s.ringScore, { color: ringColor }]}>{score}</Text>
                  <Text style={s.ringScoreUnit}>分</Text>
                </View>
              </View>
              <View style={s.heroText}>
                <View style={[s.levelBadge, { backgroundColor: ringColor + '22', borderColor: ringColor + '55' }]}>
                  <View style={[s.levelDot, { backgroundColor: ringColor }]} />
                  <Text style={[s.levelLabel, { color: ringColor }]}>
                    {HEALTH_LEVEL_LABELS[level as keyof typeof HEALTH_LEVEL_LABELS]}
                  </Text>
                </View>
                <Text style={s.heroSummary}>{getScoreSummary(level)}</Text>
                <Text style={s.heroCaption}>近 7 天量測數據</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Vital Signs (corrected colors) ───────────────── */}
        <View style={s.vitalsRow}>
          <View style={s.vitalCard}>
            <View style={s.vitalHeader}>
              <View style={[s.vitalIconWrap, { backgroundColor: colors.dangerLight }]}>
                <IconHeart size={16} />
              </View>
              <Text style={s.vitalLabel}>血壓</Text>
            </View>
            {latestBP && latestBP.systolic != null && latestBP.diastolic != null ? (
              <>
                <View style={s.vitalValueRow}>
                  <Text style={s.vitalValue}>
                    {latestBP.systolic}
                    <Text style={s.vitalSep}>/</Text>
                    {latestBP.diastolic}
                  </Text>
                  <Text style={s.vitalUnit}>mmHg</Text>
                </View>
                <View style={s.vitalStatusRow}>
                  <View
                    style={[
                      s.vitalStatusDot,
                      { backgroundColor: getBPStatus(latestBP.systolic, latestBP.diastolic).isHigh ? colors.danger : colors.success },
                    ]}
                  />
                  <Text
                    style={[
                      s.vitalStatusText,
                      { color: getBPStatus(latestBP.systolic, latestBP.diastolic).isHigh ? colors.danger : colors.success },
                    ]}
                  >
                    {getBPStatus(latestBP.systolic, latestBP.diastolic).label}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={s.vitalEmpty}>--</Text>
            )}
          </View>

          <View style={s.vitalCard}>
            <View style={s.vitalHeader}>
              <View style={[s.vitalIconWrap, { backgroundColor: colors.warningLight }]}>
                <IconDrop size={16} />
              </View>
              <Text style={s.vitalLabel}>血糖</Text>
            </View>
            {latestBG && latestBG.glucose_value != null ? (
              <>
                <View style={s.vitalValueRow}>
                  <Text style={s.vitalValue}>{latestBG.glucose_value}</Text>
                  <Text style={s.vitalUnit}>mg/dL</Text>
                </View>
                <View style={s.vitalStatusRow}>
                  <View
                    style={[
                      s.vitalStatusDot,
                      { backgroundColor: getBGStatus(latestBG.glucose_value).isHigh ? colors.danger : colors.success },
                    ]}
                  />
                  <Text
                    style={[
                      s.vitalStatusText,
                      { color: getBGStatus(latestBG.glucose_value).isHigh ? colors.danger : colors.success },
                    ]}
                  >
                    {getBGStatus(latestBG.glucose_value).label}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={s.vitalEmpty}>--</Text>
            )}
          </View>
        </View>

        {/* ── Medical Tags ─────────────────────────────────── */}
        {recipient.medical_tags.length > 0 && (
          <View style={s.tagsRow}>
            {recipient.medical_tags.map((tag) => (
              <View key={tag} style={s.tagPill}>
                <Text style={s.tagPillText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Section: 安心報 (Section 1.7.5) ─────────────────
            Surfaces the latest AI health_summary so patient can read it themselves.
            Tap → opens the same /health/ai-report screen caregiver uses, scoped to this recipient. */}
        {latestReport && (
          <>
            <View style={s.sectionHeader}>
              <IconCalendar />
              <Text style={s.sectionTitle}>安心報</Text>
            </View>
            <TouchableOpacity
              style={s.reportCard}
              onPress={() => router.push({
                pathname: '/(tabs)/health/ai-report',
                params: { recipient_id: recipient.id },
              })}
              activeOpacity={0.85}
              accessibilityLabel="查看 AI 安心報"
            >
              <View style={s.reportCardHeader}>
                <Text style={s.reportCardLabel}>{latestReport.status_label}</Text>
                <Text style={s.reportCardDate}>
                  {new Date(latestReport.generated_at).toLocaleDateString('zh-TW')}
                </Text>
              </View>
              <Text style={s.reportCardSummary} numberOfLines={3}>
                {latestReport.summary}
              </Text>
              <Text style={s.reportCardCta}>查看完整報告 ›</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Section: 近期行程 ────────────────────────────── */}
        <View style={s.sectionHeader}>
          <IconCalendar />
          <Text style={s.sectionTitle}>近期行程</Text>
        </View>
        {appointments.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyCardText}>暫無近期行程</Text>
          </View>
        ) : (
          <View style={s.listCard}>
            {appointments.map((appt, idx) => {
              const { month, day } = formatAppointmentDate(appt.appointment_date);
              return (
                <View
                  key={appt.id}
                  style={[s.apptRow, idx < appointments.length - 1 && s.rowDivider]}
                >
                  <View style={s.apptDateBadge}>
                    <Text style={s.apptMonth}>{month}月</Text>
                    <Text style={s.apptDay}>{day}日</Text>
                  </View>
                  <View style={s.apptInfo}>
                    <Text style={s.apptTitle} numberOfLines={1}>{appt.title}</Text>
                    {appt.hospital_name ? (
                      <Text style={s.apptHospital} numberOfLines={1}>{appt.hospital_name}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Section: 最近通知 ────────────────────────────── */}
        <View style={s.sectionHeader}>
          <IconBell />
          <Text style={s.sectionTitle}>最近通知</Text>
          {notifications.length > 0 && (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/patient/schedule')}
              activeOpacity={0.7}
              style={s.sectionLink}
            >
              <Text style={s.sectionLinkText}>查看全部</Text>
              <IconChevron color={colors.primaryText} />
            </TouchableOpacity>
          )}
        </View>
        {notifications.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyCardText}>暫無通知</Text>
          </View>
        ) : (
          <View style={s.listCard}>
            {notifications.map((notif, idx) => (
              <View
                key={notif.id}
                style={[s.notifRow, idx < notifications.length - 1 && s.rowDivider]}
              >
                <NotificationIcon type={notif.type} />
                <View style={s.notifContent}>
                  <Text style={s.notifTitle} numberOfLines={2}>{notif.title}</Text>
                  <Text style={s.notifTime}>{formatNotificationTime(notif.created_at)}</Text>
                </View>
                {!notif.is_read && <View style={s.unreadDot} />}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: spacing['3xl'] }} />
      </ScrollView>

      {/* ── Menu Modal ─────────────────────────── */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={s.overlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={s.sheet} onPress={() => {/* block */}}>
            <View style={s.sheetHandle} />

            {/* Profile header */}
            <View style={s.menuProfile}>
              <View style={s.menuAvatar}>
                <Text style={s.menuAvatarText}>{initial}</Text>
              </View>
              <View style={s.menuProfileText}>
                <Text style={s.menuName}>{displayName}</Text>
                <View style={s.menuRoleBadge}>
                  <Text style={s.menuRoleBadgeText}>被照護者</Text>
                </View>
              </View>
            </View>

            {/* Group: 我的 (Sections 1.7.4 + 4.2.6 menu consistency).
                Order: 個人資料 → 通知中心 → 行程與紀錄.
                Settings stub removed (Decision F). */}
            <Text style={s.menuGroupLabel}>我的</Text>
            <View style={s.menuGroup}>
              <TouchableOpacity
                style={s.menuRow}
                onPress={() => { setMenuVisible(false); router.push('/(tabs)/patient/profile'); }}
                activeOpacity={0.7}
              >
                <View style={[s.menuIconWrap, { backgroundColor: colors.primaryLight }]}>
                  <IconUserMenu />
                </View>
                <Text style={s.menuRowText}>個人資料</Text>
                <IconChevron color={colors.textDisabled} />
              </TouchableOpacity>
              <View style={s.menuItemDivider} />
              <TouchableOpacity
                style={s.menuRow}
                onPress={() => { setMenuVisible(false); router.push('/(tabs)/home/notifications'); }}
                activeOpacity={0.7}
              >
                <View style={[s.menuIconWrap, { backgroundColor: colors.primaryLight }]}>
                  <IconBellMenu />
                </View>
                <Text style={s.menuRowText}>通知中心</Text>
                <IconChevron color={colors.textDisabled} />
              </TouchableOpacity>
              <View style={s.menuItemDivider} />
              <TouchableOpacity
                style={s.menuRow}
                onPress={() => { setMenuVisible(false); router.push('/(tabs)/patient/schedule'); }}
                activeOpacity={0.7}
              >
                <View style={[s.menuIconWrap, { backgroundColor: colors.accentLight }]}>
                  <IconCalendarMenu />
                </View>
                <Text style={s.menuRowText}>行程與紀錄</Text>
                <IconChevron color={colors.textDisabled} />
              </TouchableOpacity>
            </View>

            {/* Logout */}
            <TouchableOpacity
              style={s.menuLogout}
              onPress={() => { setMenuVisible(false); void logout().then(() => router.replace('/(auth)')); }}
              activeOpacity={0.7}
            >
              <View style={[s.menuIconWrap, { backgroundColor: colors.dangerLight }]}>
                <IconLogout />
              </View>
              <Text style={s.menuLogoutText}>登出</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgScreen },
  content: { paddingBottom: 0 },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: spacing.xl, backgroundColor: colors.bgScreen,
  },
  errorText: { ...typography.bodyLg, color: colors.danger, textAlign: 'center' },
  emptyText: { ...typography.bodyLg, color: colors.textDisabled, textAlign: 'center' },

  // Section 1.7.5: AI 安心報 surfaced card.
  reportCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  reportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  reportCardLabel: {
    backgroundColor: colors.primaryLight,
    color: colors.primaryText,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: radius.full,
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
    overflow: 'hidden',
  },
  reportCardDate: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
  },
  reportCardSummary: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  reportCardCta: {
    marginTop: spacing.sm,
    fontSize: typography.captionSm.fontSize,
    color: colors.primaryText,
    fontWeight: '600',
  },

  // Section 1.7.3: empty-state styles for un-bound patient.
  emptyStateWrap: {
    flexGrow: 1,
    backgroundColor: colors.bgScreen,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['3xl'] * 2,
    paddingBottom: spacing['3xl'],
    alignItems: 'center',
  },
  emptyHeroIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.headingMd,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  emptyEmailPill: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1, borderColor: colors.primary,
    marginBottom: spacing['2xl'],
  },
  emptyEmailText: {
    ...typography.bodyMd,
    color: colors.primaryText,
    fontWeight: '600',
  },
  emptyRefreshBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl + spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  emptyRefreshText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    letterSpacing: 1,
  },
  emptySecondaryLink: {
    color: colors.primaryText,
    fontSize: typography.bodySm.fontSize,
    textDecorationLine: 'underline',
  },

  // ── Top Bar ───────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
  },
  avatar: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.primaryText,
  },
  greetingTextWrap: { flex: 1 },
  greetingSub: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
  },
  greeting: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 1,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderDefault,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Hero ──────────────────────────────────────────────────
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(46,141,201,0.12)',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroHaloTopRight: {
    position: 'absolute', top: -50, right: -60,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  heroHaloBottomLeft: {
    position: 'absolute', bottom: -50, left: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  heroContent: {
    paddingVertical: spacing.lg + 2,
    paddingHorizontal: spacing.lg,
  },
  heroTagline: {
    fontSize: 10, fontWeight: '700',
    color: colors.primary, letterSpacing: 2,
  },
  heroSubtitle: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xxs,
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  ringWrap: {
    width: 96, height: 96,
    position: 'relative',
  },
  ringCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  ringScore: { fontSize: 32, fontWeight: '700', lineHeight: 38 },
  ringScoreUnit: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
    marginTop: -4,
  },
  heroText: { flex: 1, gap: spacing.xs + 2 },
  levelBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderWidth: 1,
  },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
  levelLabel: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
  },
  heroSummary: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  heroCaption: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
  },

  // ── Vitals ────────────────────────────────────────────────
  vitalsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  vitalCard: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md + 2,
    gap: spacing.sm,
  },
  vitalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  vitalIconWrap: {
    width: 28, height: 28, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  vitalLabel: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  vitalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  vitalValue: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 32,
  },
  vitalSep: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.textTertiary,
  },
  vitalUnit: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
  },
  vitalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  vitalStatusDot: { width: 6, height: 6, borderRadius: 3 },
  vitalStatusText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
  },
  vitalEmpty: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textDisabled,
    lineHeight: 32,
  },

  // ── Medical Tags ──────────────────────────────────────────
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  tagPill: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  tagPillText: {
    fontSize: typography.captionSm.fontSize,
    color: colors.primaryText,
    fontWeight: '600',
  },

  // ── Section header ─────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm + 2,
  },
  sectionTitle: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  sectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sectionLinkText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.primaryText,
    fontWeight: '600',
  },

  // ── List card (appointments + notifications shared) ───────
  listCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  emptyCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyCardText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textDisabled,
  },

  // ── Appointment row ───────────────────────────────────────
  apptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  apptDateBadge: {
    width: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 1,
  },
  apptMonth: {
    fontSize: typography.captionSm.fontSize,
    color: colors.white,
    fontWeight: '600',
  },
  apptDay: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    lineHeight: 20,
  },
  apptInfo: { flex: 1, gap: 2 },
  apptTitle: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  apptHospital: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
  },

  // ── Notification row ──────────────────────────────────────
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  notifIconWrap: {
    width: 36, height: 36,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  notifContent: { flex: 1, gap: 2 },
  notifTitle: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textPrimary,
    fontWeight: '500',
    lineHeight: 18,
  },
  notifTime: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
  },
  unreadDot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  // ── Menu Modal ────────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'] + spacing.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  menuProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  menuAvatar: {
    width: 52, height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  menuAvatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primaryText,
  },
  menuProfileText: { flex: 1, gap: 4 },
  menuName: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  menuRoleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
  },
  menuRoleBadgeText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
    color: colors.primaryText,
  },
  menuGroupLabel: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '600',
    color: colors.textTertiary,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs + 2,
  },
  menuGroup: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  menuItemDivider: {
    height: 1,
    backgroundColor: colors.borderDefault,
    marginHorizontal: spacing.md,
  },
  menuIconWrap: {
    width: 36, height: 36,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  menuRowText: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  menuLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(217,83,79,0.2)',
    marginTop: spacing.xs,
  },
  menuLogoutText: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    color: colors.danger,
    fontWeight: '600',
  },
});
