import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';

// ─── Icons ────────────────────────────────────────────────────

function IconMenu({ size = 22, color = colors.textTertiary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12h18M3 6h18M3 18h18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function IconBell({ size = 22, color = colors.textTertiary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Types ────────────────────────────────────────────────────

interface ProviderTask {
  id: string;
  status: string;
  preferred_date: string;
  preferred_time_slot: string | null;
  location: string;
  description: string;
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  candidate_proposed: { label: '待確認', color: '#7C3AED', bg: '#EDE9FE' },
  provider_confirmed: { label: '已確認', color: '#0F766E', bg: '#CCFBF1' },
  arranged: { label: '已安排', color: '#0E7490', bg: '#CFFAFE' },
  in_service: { label: '服務中', color: '#C2410C', bg: '#FFEDD5' },
  completed: { label: '已完成', color: '#15803D', bg: '#DCFCE7' },
};

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午', afternoon: '下午', evening: '晚上',
};

const PENDING_STATUSES = ['candidate_proposed', 'provider_confirmed', 'arranged'];
const IN_SERVICE_STATUSES = ['in_service'];

// ─── Component ────────────────────────────────────────────────

export default function ProviderTasksScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState<ProviderTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<ProviderTask[]>('/provider/tasks?limit=50');
      setTasks(result);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗，請稍後再試');
    } finally { setLoading(false); }
  }, []);

  const fetchUnread = useCallback(async () => {
    try {
      const r = await api.get<{ count: number }>('/notifications/unread-count');
      setUnreadCount(r.count);
    } catch { /* */ }
  }, []);

  useFocusEffect(useCallback(() => { void fetchTasks(); void fetchUnread(); }, [fetchTasks, fetchUnread]));

  // ─── Stats ──────────────────────────────────────────────────

  const pendingCount = tasks.filter((t) => PENDING_STATUSES.includes(t.status)).length;
  const inServiceCount = tasks.filter((t) => IN_SERVICE_STATUSES.includes(t.status)).length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  // ─── Date Bar ───────────────────────────────────────────────

  const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  const weekDates = useMemo(() => {
    const dates: { key: string; dayLabel: string; dateNum: number; hasTasks: boolean }[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const key = toLocalDateStr(d);
      dates.push({
        key,
        dayLabel: DAY_LABELS[d.getDay()]!,
        dateNum: d.getDate(),
        hasTasks: tasks.some((t) => toLocalDateStr(new Date(t.preferred_date)) === key),
      });
    }
    return dates;
  }, [tasks]);

  // ─── Filtered Tasks ─────────────────────────────────────────

  const activeTasks = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    if (selectedDate) return toLocalDateStr(new Date(t.preferred_date)) === selectedDate;
    return true;
  });

  // ─── Render Task Card ───────────────────────────────────────

  const renderItem = ({ item }: { item: ProviderTask }) => {
    const status = STATUS_CONFIG[item.status] ?? { label: item.status, color: colors.textTertiary, bg: colors.bgSurfaceAlt };
    return (
      <TouchableOpacity
        style={s.taskCard}
        onPress={() => router.push(`/(tabs)/services/provider-task-detail?taskId=${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={s.taskCardTop}>
          <Text style={s.taskCategory}>{item.category.name}</Text>
          <View style={[s.taskBadge, { backgroundColor: status.bg }]}>
            <Text style={[s.taskBadgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={s.taskRecipient}>{item.recipient.name}</Text>
        <View style={s.taskMeta}>
          <Text style={s.taskDate}>
            {new Date(item.preferred_date).toLocaleDateString('zh-TW')}
            {item.preferred_time_slot ? ` ${TIME_SLOT_LABELS[item.preferred_time_slot] ?? ''}` : ''}
          </Text>
          <Text style={s.taskLocation} numberOfLines={1}>{item.location}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Main Render ────────────────────────────────────────────

  return (
    <LinearGradient colors={['#F0EEFF', '#FAF9FC', '#FAF9FC']} locations={[0, 0.35, 1]} style={s.container}>
      <FlatList
        data={loading ? [] : activeTasks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        onRefresh={() => { void fetchTasks(); void fetchUnread(); }}
        refreshing={loading}
        ListHeaderComponent={
          <>
            {/* ── Top Row: Avatar + Icons ─────────────── */}
            <View style={s.topRow}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{user?.name?.charAt(0) ?? ''}</Text>
              </View>
              <View style={s.topRight}>
                <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/(tabs)/home/notifications')} accessibilityLabel="通知">
                  <IconBell />
                  {unreadCount > 0 && <View style={s.badge}><Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
                </TouchableOpacity>
                <TouchableOpacity style={s.iconBtn} onPress={() => setMenuVisible(true)} accessibilityLabel="選單">
                  <IconMenu />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Greeting (own block, full width) ────── */}
            <View style={s.greetingBlock}>
              <Text style={s.greeting}>你好，{'\n'}{user?.name ?? ''}！</Text>
              <Text style={s.greetingSub}>準備好接案了嗎</Text>
            </View>

            {/* ── Active Banner (pill with icon circle) ── */}
            {inServiceCount > 0 && (
              <TouchableOpacity style={s.banner} activeOpacity={0.8}>
                <View style={s.bannerIconWrap}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5a2 2 0 002 2h2a2 2 0 002-2" stroke={colors.primary} strokeWidth={1.5} strokeLinecap="round" />
                    <Path d="M9 14l2 2 4-4" stroke={colors.primary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={s.bannerText}>您有 {inServiceCount} 個進行中的服務</Text>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 12h14M12 5l7 7-7 7" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            )}

            {/* ── Stats Cards (white bg + colored text) ── */}
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Text style={[s.statValue, { color: colors.primary }]}>{pendingCount}</Text>
                <Text style={[s.statLabel, { color: colors.textTertiary }]}>待確認</Text>
              </View>
              <View style={s.statCard}>
                <Text style={[s.statValue, { color: colors.warning }]}>{inServiceCount}</Text>
                <Text style={[s.statLabel, { color: colors.textTertiary }]}>進行中</Text>
              </View>
              <View style={s.statCard}>
                <Text style={[s.statValue, { color: colors.success }]}>{completedCount}</Text>
                <Text style={[s.statLabel, { color: colors.textTertiary }]}>已完成</Text>
              </View>
            </View>

            {/* ── Date Bar ─────────────────────────────── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dateBarScroll} contentContainerStyle={s.dateBarContent}>
              {weekDates.map((d) => {
                const isActive = selectedDate === d.key;
                return (
                  <TouchableOpacity key={d.key} style={[s.dateCell, isActive && s.dateCellActive]} onPress={() => setSelectedDate(isActive ? null : d.key)} activeOpacity={0.7}>
                    <Text style={[s.dateDayLabel, isActive && s.dateDayLabelActive]}>{d.dayLabel}</Text>
                    <Text style={[s.dateDateNum, isActive && s.dateDateNumActive]}>{d.dateNum}</Text>
                    {d.hasTasks && <View style={[s.dateDot, isActive && s.dateDotActive]} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── Section Label ─────────────────────────── */}
            <Text style={s.sectionLabel}>{selectedDate ? `${selectedDate.slice(5)} 的任務` : '待辦任務'}</Text>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={s.emptyArea}><ActivityIndicator size="large" color={colors.primary} /><Text style={s.emptyText}>載入中...</Text></View>
          ) : error ? (
            <View style={s.emptyArea}>
              <Text style={s.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => void fetchTasks()}><Text style={s.retryText}>重試</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={s.emptyArea}><Text style={s.emptyText}>{selectedDate ? '這天沒有任務' : '目前沒有待辦任務'}</Text></View>
          )
        }
      />

      {/* ── Menu Modal ───────────────────────── */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={s.overlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={s.sheet} onPress={() => {/* block */}}>
            <Text style={s.sheetTitle}>選單</Text>
            {[
              { label: '個人資料管理', onPress: () => router.push('/(tabs)/services/provider-profile') },
              { label: '通知', onPress: () => router.push('/(tabs)/home/notifications') },
              { label: '設定', onPress: () => Alert.alert('提示', '設定功能即將推出') },
            ].map((item) => (
              <TouchableOpacity key={item.label} style={s.sheetItem} onPress={() => { setMenuVisible(false); item.onPress(); }} activeOpacity={0.7}>
                <Text style={s.sheetItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <View style={s.sheetDivider} />
            <TouchableOpacity style={s.sheetItem} onPress={() => { setMenuVisible(false); void logout().then(() => router.replace('/(auth)/login')); }} activeOpacity={0.7}>
              <Text style={s.sheetItemDanger}>登出</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  listContent: { paddingBottom: spacing['3xl'] },

  // ─── Top Row (avatar + icons) ────────────────────────────
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing['2xl'], paddingTop: spacing['2xl'],
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    ...shadows.high,
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: colors.primaryText },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center',
    ...shadows.low,
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: colors.accent, borderRadius: radius.full,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xs, borderWidth: 2, borderColor: colors.bgScreen,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },

  // ─── Greeting (own block, full width) ───────────────────
  greetingBlock: {
    paddingHorizontal: spacing['2xl'], paddingTop: spacing.xl, paddingBottom: spacing['2xl'],
  },
  greeting: { fontSize: 32, fontWeight: '700', color: colors.textPrimary, lineHeight: 40 },
  greetingSub: { fontSize: typography.bodyLg.fontSize, color: colors.textTertiary, marginTop: spacing.sm },

  // ─── Active Banner (pill with icon circle) ──────────────
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginHorizontal: spacing['2xl'], marginBottom: spacing['3xl'],
    backgroundColor: colors.primaryLight, borderRadius: radius.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2,
    ...shadows.low,
  },
  bannerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center',
  },
  bannerText: { flex: 1, fontSize: typography.bodyMd.fontSize, fontWeight: '600', color: colors.primaryText },

  // ─── Stats Row (white cards + colored numbers) ──────────
  statsRow: {
    flexDirection: 'row', gap: spacing.md,
    paddingHorizontal: spacing['2xl'], marginBottom: spacing['3xl'],
  },
  statCard: {
    flex: 1, borderRadius: 28, paddingVertical: spacing['2xl'] + spacing.xs, paddingHorizontal: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    ...shadows.high,
  },
  statValue: { fontSize: 40, fontWeight: '700' },
  statLabel: { fontSize: typography.bodyMd.fontSize, fontWeight: '500', color: colors.textTertiary, marginTop: spacing.sm },

  // ─── Date Bar ───────────────────────────────────────────
  dateBarScroll: { maxHeight: 90, marginBottom: spacing['2xl'] },
  dateBarContent: { paddingHorizontal: spacing['2xl'], gap: spacing.md },
  dateCell: {
    alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.lg,
    borderRadius: 24, backgroundColor: colors.bgSurface,
    minWidth: 52, ...shadows.low,
  },
  dateCellActive: { backgroundColor: colors.primary, ...shadows.high },
  dateDayLabel: { fontSize: typography.caption.fontSize, color: colors.textDisabled, marginBottom: spacing.xs },
  dateDayLabelActive: { color: 'rgba(255,255,255,0.8)' },
  dateDateNum: { fontSize: typography.headingMd.fontSize, fontWeight: '700', color: colors.textPrimary },
  dateDateNumActive: { color: colors.white },
  dateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: spacing.xs },
  dateDotActive: { backgroundColor: colors.white },

  // ─── Section Label ──────────────────────────────────────
  sectionLabel: {
    fontSize: typography.headingSm.fontSize, fontWeight: '700',
    color: colors.textPrimary, paddingHorizontal: spacing['2xl'], marginBottom: spacing.md,
  },

  // ─── Task Card ──────────────────────────────────────────
  taskCard: {
    backgroundColor: colors.bgSurface, borderRadius: 24,
    padding: spacing.xl, marginHorizontal: spacing['2xl'], marginBottom: spacing.md,
    ...shadows.low,
  },
  taskCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  taskCategory: { fontSize: typography.headingSm.fontSize, fontWeight: '700', color: colors.textPrimary },
  taskBadge: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  taskBadgeText: { fontSize: typography.caption.fontSize, fontWeight: '600' },
  taskRecipient: { fontSize: typography.bodyLg.fontSize, color: colors.textSecondary, marginBottom: spacing.sm },
  taskMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskDate: { fontSize: typography.bodyMd.fontSize, color: colors.primaryText, fontWeight: '600' },
  taskLocation: { fontSize: typography.bodySm.fontSize, color: colors.textDisabled, flex: 1, textAlign: 'right', marginLeft: spacing.md },

  // ─── Empty / Error ──────────────────────────────────────
  emptyArea: { alignItems: 'center', paddingVertical: spacing['3xl'] * 2, gap: spacing.md },
  emptyText: { fontSize: typography.bodyLg.fontSize, color: colors.textDisabled },
  errorText: { fontSize: typography.bodyLg.fontSize, color: colors.danger },
  retryText: { fontSize: typography.bodyLg.fontSize, color: colors.primaryText, fontWeight: '600' },

  // ─── Menu Modal ─────────────────────────────────────────
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
});
