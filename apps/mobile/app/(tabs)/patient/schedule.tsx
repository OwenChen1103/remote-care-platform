import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';

// ─── Types ────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
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

interface ProviderReport {
  date?: string;
  blood_pressure?: string;
  blood_glucose?: string;
  weight?: string;
  body_fat?: string;
  heart_rate?: string;
  blood_oxygen?: string;
  cholesterol?: string;
  medications?: string;
  doctor_notes?: string;
  next_visit?: string;
}

interface CompletedService {
  id: string;
  status: string;
  preferred_date: string;
  provider_report: ProviderReport | null;
  category: { name: string };
}

// ─── SVG Icons ────────────────────────────────────────────────

function BellIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function WarningIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 9v4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <SvgCircle cx={12} cy={17} r={1} fill={color} />
    </Svg>
  );
}

function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ClipboardIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 12h6M9 16h4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChartIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 3v18h18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 16l4-4 4 4 4-6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function NotificationIcon({ type }: { type: string }) {
  const isWarning = type === 'abnormal_alert';
  const isAppointment = type === 'appointment_reminder';
  const isService = type === 'service_request_update';
  const isReport = type === 'ai_report_ready';

  if (isWarning) {
    return (
      <View style={[styles.iconContainer, { backgroundColor: colors.dangerLight }]}>
        <WarningIcon color={colors.danger} />
      </View>
    );
  }
  if (isAppointment) {
    return (
      <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
        <CalendarIcon color={colors.primary} />
      </View>
    );
  }
  if (isService) {
    return (
      <View style={[styles.iconContainer, { backgroundColor: colors.accentLight }]}>
        <ClipboardIcon color={colors.accent} />
      </View>
    );
  }
  if (isReport) {
    return (
      <View style={[styles.iconContainer, { backgroundColor: colors.successLight }]}>
        <ChartIcon color={colors.success} />
      </View>
    );
  }
  // measurement_reminder + default
  return (
    <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
      <BellIcon color={colors.primary} />
    </View>
  );
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

// ─── Component ────────────────────────────────────────────────

export default function PatientScheduleScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [serviceRecords, setServiceRecords] = useState<CompletedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError('');

      // Fetch notifications
      const notifData = await api.get<Notification[]>('/notifications?limit=30');
      setNotifications(notifData);

      // Fetch recipient ID to load appointments
      const recipients = await api.get<Recipient[]>('/recipients?limit=1');
      if (recipients && recipients.length > 0) {
        const recipientId = recipients[0]!.id;
        const apptData = await api.get<Appointment[]>(
          `/appointments?recipient_id=${recipientId}&limit=10`,
        );
        setAppointments(apptData);
      }

      // Fetch completed service records with provider_report
      try {
        const svcData = await api.get<CompletedService[]>('/service-requests?status=completed&limit=3');
        setServiceRecords(svcData.filter((s) => s.provider_report));
      } catch { /* non-critical */ }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('載入資料失敗，請稍後再試');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // ── Loading ──
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>載入中，請稍候…</Text>
      </View>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <View style={styles.center}>
        <View style={[styles.iconContainer, { backgroundColor: colors.dangerLight, marginBottom: spacing.lg }]}>
          <WarningIcon color={colors.danger} />
        </View>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // ── Appointment Cards ──
  const AppointmentCard = ({ item }: { item: Appointment }) => {
    const { monthDay, time } = formatAppointmentDate(item.appointment_date);
    const venue = item.hospital_name ?? item.location ?? '';

    return (
      <View style={styles.appointmentCard}>
        {/* Left: date block */}
        <View style={styles.apptDateBlock}>
          <Text style={styles.apptMonthDay}>{monthDay}</Text>
          <Text style={styles.apptTime}>{time}</Text>
        </View>

        {/* Divider */}
        <View style={styles.apptDivider} />

        {/* Right: details */}
        <View style={styles.apptDetails}>
          <Text style={styles.apptTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {venue !== '' && (
            <Text style={styles.apptHospital} numberOfLines={1}>
              {venue}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // ── List Header ──
  const ListHeader = () => (
    <View style={styles.headerSection}>
      {/* Page title */}
      <Text style={styles.pageTitle}>行程與通知</Text>

      {/* Appointments */}
      <Text style={styles.sectionLabel}>近期行程</Text>

      {appointments.length === 0 ? (
        <View style={styles.emptyAppointmentBox}>
          <CalendarIcon color={colors.textDisabled} />
          <Text style={styles.emptyAppointmentText}>暫無近期行程</Text>
        </View>
      ) : (
        appointments.map((appt) => <AppointmentCard key={appt.id} item={appt} />)
      )}

      {/* Service Records */}
      {serviceRecords.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: spacing['2xl'] }]}>服務紀錄</Text>
          {serviceRecords.map((svc) => {
            const rpt = svc.provider_report;
            if (!rpt) return null;
            const reportDate = rpt.date ?? new Date(svc.preferred_date).toLocaleDateString('zh-TW');
            return (
              <View key={svc.id} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <Text style={styles.serviceCategory}>{svc.category.name}</Text>
                  <Text style={styles.serviceDate}>{reportDate}</Text>
                </View>
                <View style={styles.serviceGrid}>
                  {rpt.blood_pressure ? <View style={styles.serviceItem}><Text style={styles.serviceItemLabel}>血壓</Text><Text style={styles.serviceItemValue}>{rpt.blood_pressure}</Text></View> : null}
                  {rpt.blood_glucose ? <View style={styles.serviceItem}><Text style={styles.serviceItemLabel}>血糖</Text><Text style={styles.serviceItemValue}>{rpt.blood_glucose}</Text></View> : null}
                  {rpt.weight ? <View style={styles.serviceItem}><Text style={styles.serviceItemLabel}>體重</Text><Text style={styles.serviceItemValue}>{rpt.weight}</Text></View> : null}
                  {rpt.heart_rate ? <View style={styles.serviceItem}><Text style={styles.serviceItemLabel}>心率</Text><Text style={styles.serviceItemValue}>{rpt.heart_rate}</Text></View> : null}
                  {rpt.body_fat ? <View style={styles.serviceItem}><Text style={styles.serviceItemLabel}>體脂</Text><Text style={styles.serviceItemValue}>{rpt.body_fat}</Text></View> : null}
                  {rpt.blood_oxygen ? <View style={styles.serviceItem}><Text style={styles.serviceItemLabel}>血氧</Text><Text style={styles.serviceItemValue}>{rpt.blood_oxygen}</Text></View> : null}
                  {rpt.cholesterol ? <View style={styles.serviceItem}><Text style={styles.serviceItemLabel}>膽固醇</Text><Text style={styles.serviceItemValue}>{rpt.cholesterol}</Text></View> : null}
                  {rpt.medications ? <View style={styles.serviceItem}><Text style={styles.serviceItemLabel}>用藥</Text><Text style={styles.serviceItemValue}>{rpt.medications}</Text></View> : null}
                </View>
                {rpt.doctor_notes ? (
                  <View style={styles.doctorNotes}>
                    <Text style={styles.doctorNotesLabel}>醫囑重點</Text>
                    <Text style={styles.doctorNotesText}>{rpt.doctor_notes}</Text>
                  </View>
                ) : null}
                {rpt.next_visit ? (
                  <View style={styles.nextVisit}>
                    <Text style={styles.nextVisitLabel}>下次看診</Text>
                    <Text style={styles.nextVisitText}>{rpt.next_visit}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      )}

      {/* Section divider for notifications */}
      <Text style={[styles.sectionLabel, { marginTop: spacing['2xl'] }]}>通知</Text>
    </View>
  );

  // ── Notification Item ──
  const renderItem = ({ item }: { item: Notification }) => {
    const isUnread = !item.is_read;

    return (
      <View style={[styles.notifCard, isUnread && styles.notifCardUnread]}>
        {/* Icon */}
        <NotificationIcon type={item.type} />

        {/* Content */}
        <View style={styles.notifContent}>
          <View style={styles.notifTitleRow}>
            <Text style={styles.notifTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifBody} numberOfLines={3}>
            {item.body}
          </Text>
          <Text style={styles.notifTime}>{formatRelativeTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={<ListHeader />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyNotifBox}>
            <BellIcon color={colors.textDisabled} />
            <Text style={styles.emptyNotifText}>目前沒有通知</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },

  listContent: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
    backgroundColor: colors.bgScreen,
  },

  loadingText: {
    ...typography.bodyLg,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  errorText: {
    ...typography.bodyLg,
    color: colors.danger,
    textAlign: 'center',
    lineHeight: 26,
  },

  // ── Header ──

  headerSection: {
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.lg,
  },

  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing['2xl'],
  },

  sectionLabel: {
    ...typography.headingSm,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },

  // ── Appointment Card ──

  appointmentCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 24,
    padding: spacing.xl,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.low,
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
    ...typography.bodyMd,
    color: colors.primaryText,
    marginTop: spacing.xxs,
  },

  apptDivider: {
    width: 1,
    height: 44,
    backgroundColor: colors.borderDefault,
    marginHorizontal: spacing.lg,
  },

  apptDetails: {
    flex: 1,
  },

  apptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },

  apptHospital: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },

  emptyAppointmentBox: {
    backgroundColor: colors.bgSurface,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    ...shadows.low,
  },

  emptyAppointmentText: {
    ...typography.bodyLg,
    color: colors.textDisabled,
  },

  // ── Icon Container ──

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Notification Card ──

  notifCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    ...shadows.low,
  },

  notifCardUnread: {
    backgroundColor: colors.primaryLight,
  },

  notifContent: {
    flex: 1,
  },

  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },

  notifTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 22,
  },

  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
    flexShrink: 0,
  },

  notifBody: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },

  notifTime: {
    ...typography.caption,
    color: colors.textDisabled,
  },

  // ── Empty Notifications ──

  emptyNotifBox: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.md,
  },

  emptyNotifText: {
    ...typography.bodyLg,
    color: colors.textDisabled,
  },

  // ── Service Records ──────────────────────────────────────
  serviceCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 24,
    padding: spacing.xl,
    marginBottom: spacing.md,
    ...shadows.low,
  },
  serviceHeader: {
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
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  serviceItem: {
    width: '47%' as unknown as number,
    flexGrow: 1,
    backgroundColor: colors.bgSurfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  serviceItemLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
    marginBottom: spacing.xxs,
  },
  serviceItemValue: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  doctorNotes: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  doctorNotesLabel: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '600',
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  doctorNotesText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  nextVisit: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  nextVisitLabel: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: spacing.xs,
  },
  nextVisitText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.primary,
  },
});
