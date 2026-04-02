import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
import {
  calculateHealthScore,
  HEALTH_LEVEL_LABELS,
  BP_THRESHOLDS,
} from '@remote-care/shared';

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
  if (
    systolic >= BP_THRESHOLDS.SYSTOLIC.HIGH ||
    diastolic >= BP_THRESHOLDS.DIASTOLIC.HIGH
  ) {
    return { label: '偏高', isHigh: true };
  }
  if (
    systolic >= BP_THRESHOLDS.SYSTOLIC.NORMAL_HIGH ||
    diastolic >= BP_THRESHOLDS.DIASTOLIC.NORMAL_HIGH
  ) {
    return { label: '稍高', isHigh: true };
  }
  return { label: '正常', isHigh: false };
}

function getBGStatus(value: number): { label: string; isHigh: boolean } {
  if (value >= 126 || value < 70) return { label: '異常', isHigh: true };
  if (value >= 100) return { label: '稍高', isHigh: true };
  return { label: '正常', isHigh: false };
}

function getScoreGradient(level: string): readonly [string, string] {
  switch (level) {
    case 'excellent': return [colors.successLight, colors.bgSurface] as const;
    case 'good':      return [colors.primaryLight, colors.bgSurface] as const;
    case 'fair':      return [colors.warningLight, colors.bgSurface] as const;
    default:          return [colors.dangerLight, colors.bgSurface] as const;
  }
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

// ─── Sub-components ───────────────────────────────────────────

function HealthScoreRing({ score, level }: { score: number; level: string }) {
  const size = 100;
  const strokeWidth = 8;
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

function NotificationIcon({ type }: { type: string }) {
  const color = type === 'alert' ? colors.danger : colors.primary;
  if (type === 'alert') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S10.5 3.17 10.5 4v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
          fill={color}
        />
      </Svg>
    );
  }
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
        fill={color}
      />
    </Svg>
  );
}

function CalendarIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"
        fill={colors.white}
      />
    </Svg>
  );
}

// ─── Main Component ───────────────────────────────────────────

function IconMenu({ size = 22, color = colors.textTertiary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12h18M3 6h18M3 18h18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError('');

      // 1. Recipient
      const recipientsData = await api.get<Recipient[]>('/recipients?limit=1');
      const first = recipientsData[0] ?? null;
      setRecipient(first);
      if (!first) {
        setMeasurements([]);
        setBpStats(null);
        setBgStats(null);
        setAppointments([]);
        setNotifications([]);
        return;
      }

      // 2. Measurements + stats + appointments + notifications (parallel)
      const [mData, bpStatsData, bgStatsData, apptData, notifData] = await Promise.allSettled([
        api.get<Measurement[]>(`/measurements?recipient_id=${first.id}&limit=10`),
        api.get<MeasurementStats>(`/measurements/stats?recipient_id=${first.id}&type=blood_pressure&period=7d`),
        api.get<MeasurementStats>(`/measurements/stats?recipient_id=${first.id}&type=blood_glucose&period=7d`),
        api.get<Appointment[]>(`/appointments?recipient_id=${first.id}&limit=3`),
        api.get<Notification[]>('/notifications?limit=3'),
      ]);

      setMeasurements(mData.status === 'fulfilled' ? (mData.value as Measurement[]) : []);
      setBpStats(bpStatsData.status === 'fulfilled' ? (bpStatsData.value as MeasurementStats) : null);
      setBgStats(bgStatsData.status === 'fulfilled' ? (bgStatsData.value as MeasurementStats) : null);
      setAppointments(apptData.status === 'fulfilled' ? (apptData.value as Appointment[]) : []);
      setNotifications(notifData.status === 'fulfilled' ? (notifData.value as Notification[]) : []);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('載入資料失敗');
      }
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
  const gradientColors = getScoreGradient(level);

  // ── Loading ───────────────────────────────────────────────
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
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!recipient) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>尚未建立被照護者資料</Text>
      </View>
    );
  }

  const displayName = recipient.name || user?.name || '您';

  // ── Render ────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* ── 1. Header ────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>你好，{displayName}</Text>
          <Text style={styles.greetingSub}>今天身體好嗎？</Text>
        </View>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)} accessibilityLabel="選單">
          <IconMenu />
        </TouchableOpacity>
      </View>

      {/* ── 2. Health Score Hero ─────────────────────────── */}
      <View style={[styles.heroCard, shadows.high]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <View style={styles.heroInner}>
            {/* Ring + score */}
            <View style={styles.ringWrapper}>
              <HealthScoreRing score={score} level={level} />
              <View style={styles.ringCenter}>
                <Text style={[styles.scoreNumber, { color: getScoreRingColor(level) }]}>
                  {score}
                </Text>
              </View>
            </View>

            {/* Label + summary */}
            <View style={styles.heroText}>
              <View style={[styles.levelBadge, { backgroundColor: getScoreRingColor(level) }]}>
                <Text style={styles.levelBadgeText}>
                  {HEALTH_LEVEL_LABELS[level as keyof typeof HEALTH_LEVEL_LABELS]}
                </Text>
              </View>
              <Text style={styles.heroSummary}>{getScoreSummary(level)}</Text>
              <Text style={styles.heroCaption}>根據近 7 天量測數據計算</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ── 3. Vital Signs ───────────────────────────────── */}
      <View style={styles.vitalsRow}>
        {/* Blood Pressure */}
        <View style={[styles.vitalCard, styles.vitalCardBP, shadows.low]}>
          <Text style={styles.vitalLabel}>血壓</Text>
          {latestBP && latestBP.systolic != null && latestBP.diastolic != null ? (
            <>
              <Text style={styles.vitalValue}>
                {latestBP.systolic}
                <Text style={styles.vitalValueSep}>/</Text>
                {latestBP.diastolic}
              </Text>
              <Text style={styles.vitalUnit}>mmHg</Text>
              <View style={styles.vitalStatusRow}>
                <View
                  style={[
                    styles.vitalStatusDot,
                    {
                      backgroundColor: getBPStatus(latestBP.systolic, latestBP.diastolic).isHigh
                        ? colors.danger
                        : colors.success,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.vitalStatusText,
                    {
                      color: getBPStatus(latestBP.systolic, latestBP.diastolic).isHigh
                        ? colors.danger
                        : colors.success,
                    },
                  ]}
                >
                  {getBPStatus(latestBP.systolic, latestBP.diastolic).label}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.vitalEmpty}>--</Text>
          )}
        </View>

        {/* Blood Glucose */}
        <View style={[styles.vitalCard, styles.vitalCardBG, shadows.low]}>
          <Text style={styles.vitalLabel}>血糖</Text>
          {latestBG && latestBG.glucose_value != null ? (
            <>
              <Text style={styles.vitalValue}>{latestBG.glucose_value}</Text>
              <Text style={styles.vitalUnit}>mg/dL</Text>
              <View style={styles.vitalStatusRow}>
                <View
                  style={[
                    styles.vitalStatusDot,
                    {
                      backgroundColor: getBGStatus(latestBG.glucose_value).isHigh
                        ? colors.danger
                        : colors.success,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.vitalStatusText,
                    {
                      color: getBGStatus(latestBG.glucose_value).isHigh
                        ? colors.danger
                        : colors.success,
                    },
                  ]}
                >
                  {getBGStatus(latestBG.glucose_value).label}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.vitalEmpty}>--</Text>
          )}
        </View>
      </View>

      {/* ── 4. Medical Tags ──────────────────────────────── */}
      {recipient.medical_tags.length > 0 && (
        <View style={styles.tagsContainer}>
          <View style={styles.tagsRow}>
            {recipient.medical_tags.map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagPillText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── 5. Upcoming Appointments ─────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>近期行程</Text>
        <View style={[styles.sectionCard, shadows.low]}>
          {appointments.length === 0 ? (
            <Text style={styles.emptyStateText}>暫無近期行程</Text>
          ) : (
            appointments.map((appt, idx) => {
              const { month, day } = formatAppointmentDate(appt.appointment_date);
              return (
                <View
                  key={appt.id}
                  style={[
                    styles.apptRow,
                    idx < appointments.length - 1 && styles.apptRowDivider,
                  ]}
                >
                  {/* Date badge */}
                  <View style={styles.apptDateBadge}>
                    <CalendarIcon />
                    <Text style={styles.apptMonth}>{month}月</Text>
                    <Text style={styles.apptDay}>{day}日</Text>
                  </View>
                  {/* Info */}
                  <View style={styles.apptInfo}>
                    <Text style={styles.apptTitle} numberOfLines={1}>
                      {appt.title}
                    </Text>
                    {appt.hospital_name ? (
                      <Text style={styles.apptHospital} numberOfLines={1}>
                        {appt.hospital_name}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>

      {/* ── 6. Recent Notifications ──────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>最近通知</Text>
        <View style={[styles.sectionCard, shadows.low]}>
          {notifications.length === 0 ? (
            <Text style={styles.emptyStateText}>暫無通知</Text>
          ) : (
            notifications.map((notif, idx) => (
              <View
                key={notif.id}
                style={[
                  styles.notifRow,
                  idx < notifications.length - 1 && styles.notifRowDivider,
                ]}
              >
                {/* Icon */}
                <View style={styles.notifIconWrap}>
                  <NotificationIcon type={notif.type} />
                </View>
                {/* Text */}
                <View style={styles.notifContent}>
                  <Text style={styles.notifTitle} numberOfLines={2}>
                    {notif.title}
                  </Text>
                  <Text style={styles.notifTime}>
                    {formatNotificationTime(notif.created_at)}
                  </Text>
                </View>
                {/* Unread dot */}
                {!notif.is_read && <View style={styles.unreadDot} />}
              </View>
            ))
          )}
        </View>
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>

    {/* ── Menu Modal ───────────────────────── */}
    <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
      <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
        <Pressable style={styles.sheet} onPress={() => {/* block */}}>
          <Text style={styles.sheetTitle}>選單</Text>
          {[
            { label: '通知', onPress: () => router.push('/(tabs)/patient/schedule') },
            { label: '設定', onPress: () => Alert.alert('提示', '設定功能即將推出') },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.sheetItem} onPress={() => { setMenuVisible(false); item.onPress(); }} activeOpacity={0.7}>
              <Text style={styles.sheetItemText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.sheetDivider} />
          <TouchableOpacity style={styles.sheetItem} onPress={() => { setMenuVisible(false); void logout().then(() => router.replace('/(auth)/login')); }} activeOpacity={0.7}>
            <Text style={styles.sheetItemDanger}>登出</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgScreen,
  },
  loadingText: {
    marginTop: spacing.sm,
    ...typography.bodyLg,
    color: colors.textTertiary,
  },
  errorText: {
    ...typography.bodyLg,
    color: colors.danger,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.bodyLg,
    color: colors.textDisabled,
    textAlign: 'center',
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing['2xl'],
  },
  menuBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center',
    ...shadows.low,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  greetingSub: {
    ...typography.bodyLg,
    color: colors.textTertiary,
  },

  // ── Hero Card ────────────────────────────────────────────
  heroCard: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  heroGradient: {
    borderRadius: 28,
    padding: spacing['2xl'],
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  ringWrapper: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreNumber: {
    fontSize: 36,
    fontWeight: '700',
  },
  heroText: {
    flex: 1,
    gap: spacing.sm,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs + 2,
  },
  levelBadgeText: {
    ...typography.headingSm,
    color: colors.white,
  },
  heroSummary: {
    ...typography.bodyLg,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  heroCaption: {
    ...typography.bodySm,
    color: colors.textTertiary,
  },

  // ── Vital Signs ──────────────────────────────────────────
  vitalsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  vitalCard: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  vitalCardBP: {
    backgroundColor: colors.accentLight,
  },
  vitalCardBG: {
    backgroundColor: colors.warningLight,
  },
  vitalLabel: {
    ...typography.bodySm,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  vitalValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 34,
  },
  vitalValueSep: {
    fontSize: 20,
    fontWeight: '400',
    color: colors.textTertiary,
  },
  vitalUnit: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  vitalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  vitalStatusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  vitalStatusText: {
    ...typography.bodySm,
    fontWeight: '600',
  },
  vitalEmpty: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textDisabled,
    lineHeight: 34,
  },

  // ── Medical Tags ─────────────────────────────────────────
  tagsContainer: {
    marginBottom: spacing.lg,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagPill: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  tagPillText: {
    ...typography.bodySm,
    color: colors.primaryText,
    fontWeight: '500',
  },

  // ── Section ──────────────────────────────────────────────
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.headingMd,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  emptyStateText: {
    ...typography.bodyLg,
    color: colors.textDisabled,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },

  // ── Appointments ─────────────────────────────────────────
  apptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  apptRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  apptDateBadge: {
    width: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  apptMonth: {
    ...typography.captionSm,
    color: colors.white,
    fontWeight: '600',
    marginTop: 2,
  },
  apptDay: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    lineHeight: 20,
  },
  apptInfo: {
    flex: 1,
    gap: spacing.xxs,
  },
  apptTitle: {
    ...typography.headingSm,
    color: colors.textPrimary,
  },
  apptHospital: {
    ...typography.bodySm,
    color: colors.textTertiary,
  },

  // ── Notifications ────────────────────────────────────────
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  notifRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  notifIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifContent: {
    flex: 1,
    gap: spacing.xxs,
  },
  notifTitle: {
    ...typography.bodySm,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  notifTime: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },

  // ── Service Records ──────────────────────────────────────
  serviceCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 24,
    padding: spacing.xl,
    marginBottom: spacing.md,
    ...shadows.low,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  serviceCategory: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  serviceDate: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
  },
  serviceDataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  serviceDataItem: {
    width: '47%' as unknown as number,
    flexGrow: 1,
    backgroundColor: colors.bgSurfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  serviceDataLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
    marginBottom: spacing.xxs,
  },
  serviceDataValue: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  serviceNotes: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  serviceNotesLabel: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '600',
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  serviceNotesText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  serviceNextVisit: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  serviceNextVisitLabel: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: spacing.xs,
  },
  serviceNextVisitText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.primary,
  },

  // ── Menu Modal ───────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgSurface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingVertical: spacing['2xl'], paddingHorizontal: spacing['2xl'], paddingBottom: spacing['3xl'] + spacing.xl,
  },
  sheetTitle: { fontSize: typography.headingMd.fontSize, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xl },
  sheetItem: { paddingVertical: spacing.lg },
  sheetItemText: { fontSize: typography.bodyLg.fontSize, color: colors.textPrimary },
  sheetItemDanger: { fontSize: typography.bodyLg.fontSize, color: colors.danger },
  sheetDivider: { height: 1, backgroundColor: colors.borderDefault, marginVertical: spacing.sm },

  // ── Bottom padding ────────────────────────────────────────
  bottomPad: {
    height: spacing['3xl'] + spacing.lg,
  },
});
