import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { calculateHealthScore, HEALTH_LEVEL_LABELS } from '@remote-care/shared';

// ─── Types ────────────────────────────────────────────────────

interface RecentMeasurement {
  id: string;
  type: string;
  systolic: number | null;
  diastolic: number | null;
  glucose_value: number | null;
  glucose_timing: string | null;
  is_abnormal: boolean;
  measured_at: string;
}

interface Recipient {
  id: string;
  caregiver_id: string;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
  medical_tags: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Appointment {
  id: string;
  title: string;
  hospital_name: string | null;
  department: string | null;
  appointment_date: string;
}

interface LatestReport {
  status_label: string;
  summary: string;
}

interface MeasurementStats {
  count: number;
  abnormal_count: number;
  systolic?: { avg: number };
  diastolic?: { avg: number };
  glucose_value?: { avg: number };
}

interface Reminder {
  id: string;
  recipient_id: string;
  reminder_type: string;
  reminder_time: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function formatGender(g: string | null): string {
  if (g === 'male') return '男';
  if (g === 'female') return '女';
  if (g === 'other') return '其他';
  return '-';
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  return d.toLocaleDateString('zh-TW');
}

function formatGlucoseTiming(timing: string | null): string {
  if (timing === 'fasting') return '空腹';
  if (timing === 'before_meal') return '餐前';
  if (timing === 'after_meal') return '餐後';
  if (timing === 'random') return '隨機';
  return '';
}

function getInitial(name: string): string {
  return name.charAt(0);
}

// ─── Component ────────────────────────────────────────────────

export default function RecipientDetailScreen() {
  const { recipientId } = useLocalSearchParams<{ recipientId: string }>();
  const router = useRouter();
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [recentMeasurements, setRecentMeasurements] = useState<RecentMeasurement[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [latestReport, setLatestReport] = useState<LatestReport | null>(null);
  const [bpStats, setBpStats] = useState<MeasurementStats | null>(null);
  const [bgStats, setBgStats] = useState<MeasurementStats | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [pickingTimeFor, setPickingTimeFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRecipient = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<Recipient>(`/recipients/${recipientId}`);
      setRecipient(data);
      try {
        const measurements = await api.get<RecentMeasurement[]>(
          `/measurements?recipient_id=${recipientId}&limit=5`,
        );
        setRecentMeasurements(measurements);
      } catch {
        // Non-critical
      }
      // Fetch health overview data (non-critical)
      try {
        const reports = await api.get<LatestReport[]>(
          `/ai/reports?recipient_id=${recipientId}&report_type=health_summary&limit=1`,
        );
        if (reports[0]) setLatestReport(reports[0]);
      } catch { /* Non-critical */ }
      try {
        const bp = await api.get<MeasurementStats>(
          `/measurements/stats?recipient_id=${recipientId}&type=blood_pressure&period=7d`,
        );
        setBpStats(bp);
      } catch { /* Non-critical */ }
      try {
        const bg = await api.get<MeasurementStats>(
          `/measurements/stats?recipient_id=${recipientId}&type=blood_glucose&period=7d`,
        );
        setBgStats(bg);
      } catch { /* Non-critical */ }
      try {
        const appts = await api.get<Appointment[]>(
          `/appointments?recipient_id=${recipientId}&limit=2`,
        );
        setUpcomingAppointments(appts);
      } catch {
        // Non-critical
      }
      try {
        const reminderData = await api.get<Reminder[]>(`/recipients/${recipientId}/reminders`);
        setReminders(reminderData);
      } catch {
        // Non-critical
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('載入失敗，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  }, [recipientId]);

  const toggleReminder = useCallback(async (type: string, enabled: boolean) => {
    try {
      const updated = await api.put<Reminder>(`/recipients/${recipientId}/reminders/${type}`, { is_enabled: enabled });
      setReminders((prev) => prev.map((r) => (r.reminder_type === type ? updated : r)));
    } catch {
      Alert.alert('更新失敗', '無法更新提醒設定，請稍後再試');
    }
  }, [recipientId]);

  const saveReminderTime = useCallback(async (type: string, time: string) => {
    try {
      const updated = await api.put<Reminder>(`/recipients/${recipientId}/reminders/${type}`, { reminder_time: time });
      setReminders((prev) => prev.map((r) => (r.reminder_type === type ? updated : r)));
    } catch {
      Alert.alert('更新失敗', '無法更新提醒時間，請稍後再試');
    }
  }, [recipientId]);

  useEffect(() => {
    void fetchRecipient();
  }, [fetchRecipient]);

  // ─── Loading ───────────────────────────────────────────────────

  if (loading) return <LoadingScreen />;

  // ─── Error ─────────────────────────────────────────────────────

  if (error || !recipient) {
    return (
      <View style={styles.center}>
        <ErrorState
          message={error || '找不到此照護對象'}
          onRetry={() => void fetchRecipient()}
        />
      </View>
    );
  }

  // ─── Main ──────────────────────────────────────────────────────

  const abnormalCount = recentMeasurements.filter((m) => m.is_abnormal).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ═══ 1. Profile Hero Card — gradient + halos + frosted ═════ */}
      <View style={styles.profileCard}>
        <LinearGradient
          colors={['#E5F2FB', '#EDF7E8', '#F8FAFC']}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroHaloTopRight} />
        <View style={styles.heroHaloBottomLeft} />
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

        <View style={styles.profileContent}>
          <View style={styles.profileTop}>
            <View style={styles.profileIdentity}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{getInitial(recipient.name)}</Text>
              </View>
              <View style={styles.profileNameBlock}>
                <View style={styles.profileNameRow}>
                  <Text style={styles.profileName}>{recipient.name}</Text>
                  {recipient.date_of_birth && (
                    <Text style={styles.profileAge}>{calculateAge(recipient.date_of_birth)} 歲</Text>
                  )}
                </View>
                {recipient.medical_tags.length > 0 && (
                  <View style={styles.profileTagsRow}>
                    {recipient.medical_tags.map((tag) => (
                      <View key={tag} style={styles.profileTag}>
                        <Text style={styles.profileTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Edit icon button — top right */}
            <TouchableOpacity
              style={styles.editIconButton}
              onPress={() => router.push(`/(tabs)/home/${recipientId}/edit`)}
              accessibilityLabel="編輯照護對象資料"
              activeOpacity={0.7}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" stroke={colors.primaryText} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.editIconText}>編輯</Text>
            </TouchableOpacity>
          </View>

          {/* Mini info grid inside profile card */}
          <View style={styles.profileInfoGrid}>
            <View style={styles.profileInfoItem}>
              <Text style={styles.profileInfoLabel}>性別</Text>
              <Text style={styles.profileInfoValue}>{formatGender(recipient.gender)}</Text>
            </View>
            <View style={styles.profileInfoDivider} />
            <View style={styles.profileInfoItem}>
              <Text style={styles.profileInfoLabel}>生日</Text>
              <Text style={styles.profileInfoValue}>
                {recipient.date_of_birth
                  ? new Date(recipient.date_of_birth).toLocaleDateString('zh-TW')
                  : '-'}
              </Text>
            </View>
            {recipient.emergency_contact_name && (
              <>
                <View style={styles.profileInfoDivider} />
                <View style={styles.profileInfoItem}>
                  <Text style={styles.profileInfoLabel}>緊急聯絡</Text>
                  <Text style={styles.profileInfoValue} numberOfLines={1}>
                    {recipient.emergency_contact_name}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Notes — only if present */}
          {recipient.notes ? (
            <View style={styles.profileNotes}>
              <Text style={styles.profileNotesLabel}>備註</Text>
              <Text style={styles.profileNotesText}>{recipient.notes}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ═══ 2. Health Overview Card + Score Ring ═════════════════ */}
      {(latestReport || bpStats || bgStats) && (() => {
        const healthResult = calculateHealthScore({
          bpStats, bgStats,
          aiStatusLabel: latestReport?.status_label ?? null,
        });
        const SCORE_COLORS: Record<string, string> = {
          excellent: colors.success, good: colors.primary,
          fair: colors.warning, poor: colors.danger,
        };
        const ringColor = SCORE_COLORS[healthResult.level] ?? colors.textDisabled;
        const ringSize = 80;
        const strokeWidth = 6;
        const ringRadius = (ringSize - strokeWidth) / 2;
        const circumference = 2 * Math.PI * ringRadius;
        const progress = healthResult.score / 100;
        const strokeDashoffset = circumference * (1 - progress);

        return (
          <Card style={styles.overviewCard}>
            {/* Score ring + status */}
            <View style={styles.scoreRow}>
              <View style={styles.scoreRingContainer}>
                <Svg width={ringSize} height={ringSize}>
                  <Circle
                    cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
                    stroke={colors.borderDefault} strokeWidth={strokeWidth} fill="none"
                  />
                  <Circle
                    cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
                    stroke={ringColor} strokeWidth={strokeWidth} fill="none"
                    strokeDasharray={`${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                  />
                </Svg>
                <View style={styles.scoreCenter}>
                  <Text style={[styles.scoreNumber, { color: ringColor }]}>{healthResult.score}</Text>
                  <Text style={styles.scoreLevelText}>
                    {HEALTH_LEVEL_LABELS[healthResult.level]}
                  </Text>
                </View>
              </View>

              <View style={styles.scoreInfo}>
                {latestReport && (
                  <Text style={styles.overviewSummary} numberOfLines={3}>
                    {latestReport.summary}
                  </Text>
                )}
              </View>
            </View>

            {/* Key metrics */}
            <View style={styles.overviewMetrics}>
            {bpStats && bpStats.count > 0 && bpStats.systolic && bpStats.diastolic && (
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>7 日平均血壓</Text>
                <Text style={styles.metricValue}>
                  {Math.round(bpStats.systolic.avg)}/{Math.round(bpStats.diastolic.avg)}
                </Text>
                <Text style={styles.metricUnit}>mmHg</Text>
              </View>
            )}
            {bgStats && bgStats.count > 0 && bgStats.glucose_value && (
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>7 日平均血糖</Text>
                <Text style={styles.metricValue}>
                  {Math.round(bgStats.glucose_value.avg)}
                </Text>
                <Text style={styles.metricUnit}>mg/dL</Text>
              </View>
            )}
            {(bpStats || bgStats) && (
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>7 日異常</Text>
                <Text style={[
                  styles.metricValue,
                  ((bpStats?.abnormal_count ?? 0) + (bgStats?.abnormal_count ?? 0)) > 0
                    ? { color: colors.danger }
                    : undefined,
                ]}>
                  {(bpStats?.abnormal_count ?? 0) + (bgStats?.abnormal_count ?? 0)}
                </Text>
                <Text style={styles.metricUnit}>筆</Text>
              </View>
            )}
          </View>
          </Card>
        );
      })()}

      {/* ═══ 3. Quick Actions — 2×2 with icons ════════════════ */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>快捷操作</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${recipientId}&type=blood_pressure`)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#FDECEA' }]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M12 21s-7-4.5-7-11a4 4 0 017-2.5A4 4 0 0119 10c0 6.5-7 11-7 11z" stroke="#D9534F" strokeWidth={1.8} strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.actionLabel}>記錄血壓</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${recipientId}&type=blood_glucose`)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#FEF3D9' }]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2C8 6 5 9 5 14a7 7 0 0014 0c0-5-3-8-7-12z" stroke="#B07000" strokeWidth={1.8} strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.actionLabel}>記錄血糖</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push(`/(tabs)/health/trends?recipientId=${recipientId}`)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#E5F2FB' }]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M3 17l5-5 4 4 8-8M16 8h5v5" stroke="#1B6DA0" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.actionLabel}>看趨勢</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push(`/(tabs)/home/appointments?recipientId=${recipientId}`)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#EDF7E8' }]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Rect x="3" y="5" width="18" height="16" rx="2" stroke="#3F7F2E" strokeWidth={1.8} />
                <Path d="M3 9h18M8 3v4M16 3v4" stroke="#3F7F2E" strokeWidth={1.8} strokeLinecap="round" />
              </Svg>
            </View>
            <Text style={styles.actionLabel}>行程管理</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══ 3. Recent Measurements ════════════════════════════ */}
      {recentMeasurements.length > 0 && (
        <View style={styles.measurementsSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>最近量測</Text>
            {abnormalCount > 0 && (
              <View style={styles.abnormalCountBadge}>
                <Text style={styles.abnormalCountText}>{abnormalCount} 筆偏高</Text>
              </View>
            )}
          </View>
          <Card style={styles.measurementsCard}>
            {recentMeasurements.map((m, idx) => (
              <View key={m.id}>
                <View style={styles.measurementRow}>
                  {/* Left: type indicator + value */}
                  <View style={styles.measurementLeft}>
                    <View style={[
                      styles.measurementDot,
                      { backgroundColor: m.is_abnormal ? colors.danger : colors.success },
                    ]} />
                    <View>
                      <Text style={styles.measurementValue}>
                        {m.type === 'blood_pressure'
                          ? `${m.systolic}/${m.diastolic} mmHg`
                          : `${m.glucose_value} mg/dL`}
                      </Text>
                      <Text style={styles.measurementMeta}>
                        {m.type === 'blood_pressure' ? '血壓' : '血糖'}
                        {m.glucose_timing ? ` · ${formatGlucoseTiming(m.glucose_timing)}` : ''}
                      </Text>
                    </View>
                  </View>
                  {/* Right: status + date */}
                  <View style={styles.measurementRight}>
                    {m.is_abnormal && (
                      <View style={styles.abnormalPill}>
                        <Text style={styles.abnormalPillText}>偏高</Text>
                      </View>
                    )}
                    <Text style={styles.measurementDate}>{formatDate(m.measured_at)}</Text>
                  </View>
                </View>
                {idx < recentMeasurements.length - 1 && <View style={styles.measurementDivider} />}
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* ═══ 4. Upcoming Appointments ═══════════════════════════ */}
      {upcomingAppointments.length > 0 && (
        <View style={styles.appointmentsSection}>
          <Text style={styles.sectionTitle}>近期行程</Text>
          {upcomingAppointments.map((appt) => {
            const d = new Date(appt.appointment_date);
            const dateStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
            const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            return (
              <Card key={appt.id} style={styles.appointmentCard}>
                <View style={styles.appointmentRow}>
                  <View style={styles.appointmentDateBadge}>
                    <Text style={styles.appointmentDateText}>{dateStr}</Text>
                    <Text style={styles.appointmentTimeText}>{timeStr}</Text>
                  </View>
                  <View style={styles.appointmentInfo}>
                    <Text style={styles.appointmentTitle} numberOfLines={1}>{appt.title}</Text>
                    {(appt.hospital_name || appt.department) && (
                      <Text style={styles.appointmentMeta} numberOfLines={1}>
                        {[appt.hospital_name, appt.department].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                </View>
              </Card>
            );
          })}
          <TouchableOpacity
            style={styles.appointmentLink}
            onPress={() => router.push(`/(tabs)/home/appointments?recipientId=${recipientId}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.appointmentLinkText}>管理行程 →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ═══ 5. Reminder Settings ══════════════════════════════ */}
      {reminders.length > 0 && (
        <View style={styles.remindersSection}>
          <Text style={styles.sectionTitle}>量測提醒</Text>
          {reminders.map((r) => {
            const label = r.reminder_type === 'morning' ? '早上提醒' : '晚上提醒';
            const isPicking = pickingTimeFor === r.reminder_type;
            const [hh, mm] = r.reminder_time.split(':').map((s) => parseInt(s, 10));
            const dateValue = new Date();
            dateValue.setHours(hh ?? 8, mm ?? 0, 0, 0);
            return (
              <View key={r.reminder_type} style={styles.reminderCard}>
                <View style={styles.reminderHeaderRow}>
                  <View style={styles.reminderIconWrap}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Circle cx="12" cy="12" r="10" stroke={colors.primary} strokeWidth={1.8} />
                      <Path d="M12 6v6l4 2" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
                    </Svg>
                  </View>
                  <Text style={styles.reminderLabel}>{label}</Text>
                  <Switch
                    value={r.is_enabled}
                    onValueChange={(val) => void toggleReminder(r.reminder_type, val)}
                    trackColor={{ false: colors.borderStrong, true: colors.accent }}
                    thumbColor={colors.white}
                  />
                </View>
                <TouchableOpacity
                  style={styles.reminderTimeBtn}
                  onPress={() => setPickingTimeFor(isPicking ? null : r.reminder_type)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reminderTimeLabel}>提醒時間</Text>
                  <Text style={styles.reminderTime}>{r.reminder_time}</Text>
                </TouchableOpacity>
                {isPicking && (
                  <View>
                    <DateTimePicker
                      value={dateValue}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selected) => {
                        if (Platform.OS === 'android') setPickingTimeFor(null);
                        if (selected) {
                          const newH = String(selected.getHours()).padStart(2, '0');
                          const newM = String(selected.getMinutes()).padStart(2, '0');
                          void saveReminderTime(r.reminder_type, `${newH}:${newM}`);
                        }
                      }}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity style={styles.timeDoneBtn} onPress={() => setPickingTimeFor(null)}>
                        <Text style={styles.timeDoneText}>完成</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Bottom spacer */}
      <View style={{ height: spacing['3xl'] }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing['3xl'] },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgScreen,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
  },

  // ─── Profile Hero Card ─────────────────────────────────────
  profileCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    marginBottom: spacing.xl,
    ...shadows.low,
  },
  heroHaloTopRight: {
    position: 'absolute',
    top: -40,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  heroHaloBottomLeft: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  profileContent: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  profileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  profileIdentity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  profileAvatarText: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: '700',
    color: colors.primaryText,
  },
  profileNameBlock: {
    flex: 1,
    paddingTop: spacing.xxs,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  profileName: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  profileAge: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textTertiary,
  },
  profileTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  profileTag: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + spacing.xxs,
    paddingVertical: spacing.xxs + 1,
  },
  profileTagText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '500',
    color: colors.primaryText,
  },
  editIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 1,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  editIconText: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // Mini info grid
  profileInfoGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  profileInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  profileInfoLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginBottom: spacing.xxs,
  },
  profileInfoValue: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  profileInfoDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderDefault,
  },

  // Notes
  profileNotes: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  profileNotesLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginBottom: spacing.xs,
  },
  profileNotesText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
    lineHeight: typography.bodyMd.fontSize * 1.6,
  },

  // ─── Quick Actions ─────────────────────────────────────────
  // ─── Health Score + Overview Card ──────────────────────────
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  scoreRingContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  scoreCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: typography.headingXl.fontSize,
    fontWeight: '700',
  },
  scoreLevelText: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    marginTop: -2,
  },
  scoreInfo: {
    flex: 1,
  },
  overviewCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  overviewStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  overviewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  overviewStatusText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  overviewSummary: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
    flex: 1,
    marginLeft: spacing.xs,
  },
  overviewMetrics: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.bgSurfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  metricLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginBottom: spacing.xs,
  },
  metricValue: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricUnit: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginTop: spacing.xxs,
  },

  // ─── Quick Actions ───────────────────────────────────────
  actionsSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: typography.headingSm.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%' as unknown as number,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // ─── Measurements ──────────────────────────────────────────
  measurementsSection: {
    marginBottom: spacing.xl,
  },
  abnormalCountBadge: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + spacing.xxs,
    paddingVertical: spacing.xxs + 1,
  },
  abnormalCountText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '500',
    color: colors.warning,
  },
  measurementsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  measurementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  measurementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  measurementDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.md,
  },
  measurementValue: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  measurementMeta: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginTop: spacing.xxs,
  },
  measurementRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  abnormalPill: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  abnormalPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.warning,
  },
  measurementDate: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
  },
  measurementDivider: {
    height: 1,
    backgroundColor: colors.borderDefault,
    marginHorizontal: spacing.lg,
  },

  // ─── Upcoming Appointments ─────────────────────────────────
  appointmentsSection: {
    marginBottom: spacing.lg,
  },
  appointmentCard: {
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  appointmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  appointmentDateBadge: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 52,
  },
  appointmentDateText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.primaryText,
  },
  appointmentTimeText: {
    fontSize: typography.captionSm.fontSize,
    color: colors.primaryText,
    marginTop: 1,
  },
  appointmentInfo: { flex: 1 },
  appointmentTitle: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  appointmentMeta: {
    fontSize: typography.caption.fontSize,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  appointmentLink: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  appointmentLinkText: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.primaryText,
  },

  // ─── Reminders ─────────────────────────────────────────────
  remindersSection: {
    marginBottom: spacing.lg,
  },
  reminderCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  reminderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reminderIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderLabel: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  reminderTimeBtn: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  reminderTimeLabel: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
  },
  reminderTime: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.primaryText,
  },
  timeDoneBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
  },
  timeDoneText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
  },
});
