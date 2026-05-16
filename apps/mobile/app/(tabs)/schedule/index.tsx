import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import type { ProviderReportInput as ProviderReport } from '@remote-care/shared';
import { api, ApiError } from '@/lib/api-client';
import { navigateNotification } from '@/lib/notification-deeplink';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

// ─── Types ────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  // Section 2.9.4: deep-link payload (service_request_id / target_status / etc.)
  data?: Record<string, unknown> | null;
}

interface Recipient {
  id: string;
  name: string;
}

interface Appointment {
  id: string;
  title: string;
  appointment_date: string;
  hospital_name?: string | null;
  location?: string;
}

// Section 3.7.3: drop the local flat ProviderReport. Use the canonical nested shape from
// @remote-care/shared so this reader stays in lock-step with the writer (provider mobile)
// and the API validator (ServiceRequestProviderProgressSchema). Below we re-format nested
// fields into a flat {label, value} list at render time.

interface CompletedService {
  id: string;
  status: string;
  preferred_date: string;
  provider_report: ProviderReport | null;
  category: { name: string };
}

// ─── Helpers ──────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));

  if (diffMin < 1) return '剛剛';
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} 小時前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatAppointmentDate(dateStr: string): { monthDay: string; time: string } {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return { monthDay: `${month}/${day}`, time: `${hour}:${min}` };
}

// ─── SVG Icons (stroke style) ─────────────────────────────────

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
function IconClipboard({ size = 16, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5a2 2 0 002 2h2a2 2 0 002-2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
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
function IconChart({ size = 18, color = colors.warning }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 17l5-5 4 4 8-8M16 8h5v5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Notification Icon ─────────────────────────────────────────

function NotificationIcon({ type }: { type: string }) {
  if (type === 'abnormal_alert') {
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
  if (type === 'service_request_update') {
    return (
      <View style={[s.notifIconWrap, { backgroundColor: colors.primaryLight }]}>
        <IconClipboard size={18} color={colors.primary} />
      </View>
    );
  }
  if (type === 'ai_report_ready') {
    return (
      <View style={[s.notifIconWrap, { backgroundColor: colors.warningLight }]}>
        <IconChart size={18} color={colors.warning} />
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

export default function PatientScheduleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [serviceRecords, setServiceRecords] = useState<CompletedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError('');

      const notifData = await api.get<Notification[]>('/notifications?limit=30');
      setNotifications(notifData);

      const recipients = await api.get<Recipient[]>('/recipients?limit=1');
      if (recipients && recipients.length > 0) {
        const recipientId = recipients[0]!.id;
        const apptData = await api.get<Appointment[]>(
          `/appointments?recipient_id=${recipientId}&limit=10`,
        );
        setAppointments(apptData);
      }

      try {
        const svcData = await api.get<CompletedService[]>('/service-requests?status=completed&limit=3');
        setServiceRecords(svcData.filter((s) => s.provider_report));
      } catch { /* non-critical */ }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('載入資料失敗，請稍後再試');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void fetchData();
    }, [fetchData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchData();
  }, [fetchData]);

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <View style={[s.notifIconWrap, { backgroundColor: colors.dangerLight, marginBottom: spacing.md }]}>
          <IconWarning color={colors.danger} />
        </View>
        <Text style={s.errorText}>{error}</Text>
      </View>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const heroSubtitle = (() => {
    if (unreadCount > 0) return `您有 ${unreadCount} 則未讀通知`;
    if (appointments.length > 0) return `近期 ${appointments.length} 個行程待出席`;
    return '行程與通知一覽';
  })();

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView
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
        {/* ─── Glass Hero ─────────────────────────────── */}
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
            <Text style={s.heroTagline}>WHOCARES SCHEDULE</Text>
            <Text style={s.heroSubtitle}>{heroSubtitle}</Text>
            {unreadCount > 0 && (
              <View style={s.heroBadge}>
                <View style={s.heroBadgeDot} />
                <Text style={s.heroBadgeText}>{unreadCount} 則新通知</Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── Section: 近期行程 ─────────────────────────── */}
        <View style={s.sectionHeader}>
          <IconCalendar />
          <Text style={s.sectionTitle}>近期行程</Text>
          {appointments.length > 0 && (
            <Text style={s.sectionCount}>{appointments.length} 筆</Text>
          )}
        </View>
        {appointments.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>暫無近期行程</Text>
          </View>
        ) : (
          appointments.map((appt) => {
            const { monthDay, time } = formatAppointmentDate(appt.appointment_date);
            const venue = appt.hospital_name ?? appt.location ?? '';
            return (
              <View key={appt.id} style={s.appointmentCard}>
                <View style={s.apptDateBlock}>
                  <Text style={s.apptMonthDay}>{monthDay}</Text>
                  <Text style={s.apptTime}>{time}</Text>
                </View>
                <View style={s.apptDivider} />
                <View style={s.apptDetails}>
                  <Text style={s.apptTitle} numberOfLines={2}>{appt.title}</Text>
                  {venue !== '' && (
                    <Text style={s.apptHospital} numberOfLines={1}>{venue}</Text>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* ─── Section: 服務紀錄 ─────────────────────────── */}
        {serviceRecords.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <IconClipboard />
              <Text style={s.sectionTitle}>服務紀錄</Text>
              <Text style={s.sectionCount}>{serviceRecords.length} 筆</Text>
            </View>
            {serviceRecords.map((svc) => {
              const rpt = svc.provider_report;
              if (!rpt) return null;
              // Section 3.7.3: nested shape — health_data is its own object; service_date is top-level.
              const hd = rpt.health_data ?? {};
              const reportDate = rpt.service_date
                ?? new Date(svc.preferred_date).toLocaleDateString('zh-TW');

              const dataItems: { label: string; value: string }[] = [];
              if (hd.blood_pressure) {
                dataItems.push({
                  label: '血壓',
                  value: `${hd.blood_pressure.systolic}/${hd.blood_pressure.diastolic} mmHg`,
                });
              }
              if (hd.heart_rate != null) dataItems.push({ label: '心率', value: `${hd.heart_rate} bpm` });
              if (hd.blood_glucose != null) dataItems.push({ label: '血糖', value: `${hd.blood_glucose} mg/dL` });
              if (hd.blood_oxygen != null) dataItems.push({ label: '血氧', value: `${hd.blood_oxygen}%` });
              if (hd.weight_kg != null) dataItems.push({ label: '體重', value: `${hd.weight_kg} kg` });
              if (hd.body_fat_pct != null) dataItems.push({ label: '體脂', value: `${hd.body_fat_pct}%` });
              if (hd.cholesterol != null) dataItems.push({ label: '膽固醇', value: `${hd.cholesterol}` });

              return (
                <View key={svc.id} style={s.serviceCard}>
                  <View style={s.serviceHeader}>
                    <Text style={s.serviceCategory}>{svc.category.name}</Text>
                    <Text style={s.serviceDate}>{reportDate}</Text>
                  </View>

                  {dataItems.length > 0 && (
                    <View style={s.serviceGrid}>
                      {dataItems.map((item) => (
                        <View key={item.label} style={s.serviceItem}>
                          <Text style={s.serviceItemLabel}>{item.label}</Text>
                          <Text style={s.serviceItemValue}>{item.value}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {rpt.medication_notes ? (
                    <View style={s.doctorNotes}>
                      <Text style={s.doctorNotesLabel}>用藥備註</Text>
                      <Text style={s.doctorNotesText}>{rpt.medication_notes}</Text>
                    </View>
                  ) : null}

                  {rpt.doctor_instructions ? (
                    <View style={s.doctorNotes}>
                      <Text style={s.doctorNotesLabel}>醫囑重點</Text>
                      <Text style={s.doctorNotesText}>{rpt.doctor_instructions}</Text>
                    </View>
                  ) : null}

                  {rpt.next_visit_date ? (
                    <View style={s.nextVisit}>
                      <Text style={s.nextVisitLabel}>下次看診</Text>
                      <Text style={s.nextVisitText}>{rpt.next_visit_date}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        )}

        {/* ─── Section: 通知 ─────────────────────────────── */}
        <View style={s.sectionHeader}>
          <IconBell />
          <Text style={s.sectionTitle}>通知</Text>
          {unreadCount > 0 && (
            <View style={s.unreadCountBadge}>
              <Text style={s.unreadCountText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {notifications.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>目前沒有通知</Text>
          </View>
        ) : (
          notifications.map((n) => {
            const isUnread = !n.is_read;
            return (
              <TouchableOpacity
                key={n.id}
                style={[s.notifCard, isUnread && s.notifCardUnread]}
                activeOpacity={0.7}
                onPress={() => {
                  // Section 2.9.4: tap → mark-as-read + role-aware deep-link.
                  // Optimistic local update so the UI flips immediately even if the PUT lags.
                  if (isUnread) {
                    void api.put(`/notifications/${n.id}/read`, {}).catch(() => {});
                    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
                  }
                  navigateNotification(router, n.type, n.data ?? null, 'patient');
                }}
              >
                <NotificationIcon type={n.type} />
                <View style={s.notifContent}>
                  <View style={s.notifTopRow}>
                    <Text style={[s.notifTitle, isUnread && s.notifTitleUnread]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    {isUnread && <View style={s.notifUnreadDot} />}
                  </View>
                  <Text style={s.notifBody} numberOfLines={3}>{n.body}</Text>
                  <Text style={s.notifTime}>{formatRelativeTime(n.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgScreen,
  },
  errorText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.danger,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ─── Hero ─────────────────────────────────────────────────
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(46,141,201,0.12)',
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
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(46,141,201,0.18)',
  },
  heroBadgeDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.primary,
  },
  heroBadgeText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // ─── Section header ──────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm + 2,
    paddingLeft: spacing.xs,
  },
  sectionTitle: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  sectionCount: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  unreadCountBadge: {
    backgroundColor: colors.danger,
    borderRadius: radius.full,
    minWidth: 20, height: 20,
    paddingHorizontal: spacing.xs + 2,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadCountText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },

  // ─── Empty card ──────────────────────────────────────────
  emptyCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textDisabled,
  },

  // ─── Appointment card ────────────────────────────────────
  appointmentCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  apptDateBlock: {
    alignItems: 'center',
    minWidth: 52,
  },
  apptMonthDay: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 24,
  },
  apptTime: {
    fontSize: typography.bodySm.fontSize,
    color: colors.primaryText,
    marginTop: spacing.xxs,
    fontWeight: '500',
  },
  apptDivider: {
    width: 1, height: 44,
    backgroundColor: colors.borderDefault,
    marginHorizontal: spacing.lg,
  },
  apptDetails: { flex: 1 },
  apptTitle: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  apptHospital: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
  },

  // ─── Service card ────────────────────────────────────────
  serviceCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  serviceCategory: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  serviceDate: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  serviceItem: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.bgScreen,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.md,
  },
  serviceItemLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
    marginBottom: spacing.xxs,
  },
  serviceItemValue: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  doctorNotes: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(232,162,59,0.25)',
  },
  doctorNotesLabel: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
    color: colors.warning,
    marginBottom: spacing.xxs + 1,
  },
  doctorNotesText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  nextVisit: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    borderWidth: 1,
    borderColor: 'rgba(46,141,201,0.18)',
  },
  nextVisitLabel: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
    color: colors.primaryText,
    marginBottom: spacing.xxs + 1,
  },
  nextVisitText: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.primaryText,
  },

  // ─── Notification card ───────────────────────────────────
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.md + 2,
    marginBottom: spacing.sm,
  },
  notifCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  notifIconWrap: {
    width: 40, height: 40,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  notifContent: { flex: 1, gap: 4 },
  notifTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notifTitle: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '500',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  notifTitleUnread: {
    fontWeight: '700',
  },
  notifUnreadDot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  notifBody: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  notifTime: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
  },
});
