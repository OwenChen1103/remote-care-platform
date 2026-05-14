import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

interface Appointment {
  id: string;
  recipient_id: string;
  recipient: { id: string; name: string };
  title: string;
  hospital_name: string | null;
  department: string | null;
  doctor_name: string | null;
  appointment_date: string;
  note: string | null;
}

// ─── Date helpers ─────────────────────────────────────────────

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function formatMonthDay(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}/${day}`;
}

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr);
  return `週${WEEKDAYS[d.getDay()]}`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Icons ────────────────────────────────────────────────────

function IconCalendar({ color = colors.primary, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M3 9h18M8 3v4M16 3v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconHospital({ color = colors.textTertiary, size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 21V8l9-5 9 5v13" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M12 9v6M9 12h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M9 21v-4h6v4" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconDoctor({ color = colors.textTertiary, size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={1.8} />
      <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconClock({ color = colors.textTertiary, size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.8} />
      <Path d="M12 7v5l3 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconPlus({ color = colors.white, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function AppointmentsScreen() {
  const { recipientId } = useLocalSearchParams<{ recipientId: string }>();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const query = recipientId ? `?recipient_id=${recipientId}&limit=50` : '?limit=50';
      const data = await api.get<Appointment[]>(`/appointments${query}`);
      setAppointments(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('載入行程失敗');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [recipientId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchData();
  }, [fetchData]);

  // Section 4.2.2: tap card → action sheet (編輯 / 刪除 / 取消).
  const openActions = (item: Appointment) => {
    Alert.alert(item.title, '請選擇要執行的操作', [
      {
        text: '編輯',
        onPress: () => router.push(`/(tabs)/home/edit-appointment?id=${item.id}`),
      },
      {
        text: '刪除',
        style: 'destructive',
        onPress: () => confirmDelete(item),
      },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const confirmDelete = (item: Appointment) => {
    Alert.alert(
      '刪除行程',
      `確定要刪除「${item.title}」嗎？此動作無法復原。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/appointments/${item.id}`);
              // Optimistic local removal so list flips immediately.
              setAppointments((prev) => prev.filter((a) => a.id !== item.id));
            } catch (e) {
              Alert.alert('錯誤', e instanceof ApiError ? e.message : '刪除失敗');
            }
          },
        },
      ],
    );
  };

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <View style={s.errorWrap}>
        <ErrorState message={error} onRetry={() => void fetchData()} />
      </View>
    );
  }

  const renderCard = ({ item }: { item: Appointment }) => {
    const days = daysUntil(item.appointment_date);
    const isPast = days < 0;
    const isToday = days === 0;
    const daysLabel = isToday ? '今天' : isPast ? `${Math.abs(days)} 天前` : `${days} 天後`;
    // Color the date-block by urgency: today = primary, soon (≤3) = warning, future = success, past = disabled.
    const accentColor = isPast
      ? colors.textDisabled
      : isToday
      ? colors.primary
      : days <= 3
      ? colors.warning
      : colors.success;
    const accentBg = isPast
      ? colors.bgSurfaceAlt
      : isToday
      ? colors.primaryLight
      : days <= 3
      ? colors.warningLight
      : colors.successLight;

    return (
      <TouchableOpacity
        style={[s.card, isPast && s.cardPast]}
        onPress={() => openActions(item)}
        activeOpacity={0.7}
        accessibilityLabel={`行程 ${item.title}，點擊以編輯或刪除`}
      >
        {/* Date block — left side */}
        <View style={[s.dateBlock, { backgroundColor: accentBg }]}>
          <Text style={[s.dateMonth, { color: accentColor }]}>
            {formatMonthDay(item.appointment_date)}
          </Text>
          <Text style={[s.dateWeek, { color: accentColor }]}>
            {formatWeekday(item.appointment_date)}
          </Text>
        </View>

        {/* Right content */}
        <View style={s.cardBody}>
          <View style={s.cardTopRow}>
            <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[s.daysPill, { backgroundColor: accentBg }]}>
              <Text style={[s.daysPillText, { color: accentColor }]}>{daysLabel}</Text>
            </View>
          </View>

          <View style={s.detailRow}>
            <IconClock />
            <Text style={s.detailText}>{formatTime(item.appointment_date)}</Text>
          </View>

          {item.hospital_name && (
            <View style={s.detailRow}>
              <IconHospital />
              <Text style={s.detailText} numberOfLines={1}>
                {item.hospital_name}
                {item.department ? ` · ${item.department}` : ''}
              </Text>
            </View>
          )}

          {item.doctor_name && (
            <View style={s.detailRow}>
              <IconDoctor />
              <Text style={s.detailText} numberOfLines={1}>{item.doctor_name}</Text>
            </View>
          )}

          {item.note ? (
            <Text style={s.cardNote} numberOfLines={2}>{item.note}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        style={s.flatList}
        contentContainerStyle={[s.list, appointments.length === 0 && s.listEmpty]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={renderCard}
        ListHeaderComponent={
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
              <View style={s.heroIconWrap}>
                <IconCalendar size={24} color={colors.primaryText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.heroTitle}>行程管理</Text>
                <Text style={s.heroSubtitle}>
                  {appointments.length > 0
                    ? `共 ${appointments.length} 筆就醫安排`
                    : '掌握所有就醫安排'}
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <EmptyState
              title="尚無行程"
              description="點擊下方按鈕新增第一筆就醫安排。"
            />
          </View>
        }
      />

      {/* Floating add button — gradient + shadow */}
      <TouchableOpacity
        style={s.fab}
        onPress={() =>
          router.push(`/(tabs)/home/add-appointment?recipientId=${recipientId ?? ''}`)
        }
        activeOpacity={0.85}
        accessibilityLabel="新增行程"
      >
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.fabGradient}
        >
          <IconPlus size={18} />
          <Text style={s.fabText}>新增行程</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  flatList: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: spacing['3xl'] + spacing.xl, gap: spacing.md },
  // When empty, push content to fill viewport so RefreshControl pull gesture works.
  listEmpty: { flexGrow: 1 },
  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.bgScreen },

  // Hero (ListHeader)
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(46,141,201,0.12)',
    marginBottom: spacing.sm,
  },
  heroHaloTopRight: {
    position: 'absolute',
    top: -40, right: -50,
    width: 160, height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  heroHaloBottomLeft: {
    position: 'absolute',
    bottom: -50, left: -30,
    width: 140, height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  heroIconWrap: {
    width: 48, height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: 'rgba(46,141,201,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  heroSubtitle: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Empty
  emptyWrap: { flex: 1, justifyContent: 'center', paddingTop: spacing['2xl'] },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: colors.bgSurface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    overflow: 'hidden',
    minHeight: 96,
  },
  cardPast: { opacity: 0.55 },

  dateBlock: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  dateMonth: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dateWeek: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '600',
    marginTop: 2,
  },

  cardBody: {
    flex: 1,
    padding: spacing.md,
    gap: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  daysPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  daysPillText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    flex: 1,
    fontSize: typography.bodySm.fontSize,
    color: colors.textSecondary,
  },
  cardNote: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // FAB — gradient + shadow
  fab: {
    position: 'absolute',
    bottom: spacing['2xl'],
    right: spacing.lg,
    borderRadius: radius.full,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 2,
  },
  fabText: {
    color: colors.white,
    fontSize: typography.bodySm.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
