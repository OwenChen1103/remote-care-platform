import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import Svg, { Path, Circle as SvgCircle, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter, useFocusEffect } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

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

// ─── Status — brand-aligned ───────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  candidate_proposed: { label: '待確認', color: colors.warning,      bg: colors.warningLight },
  provider_confirmed: { label: '已確認', color: colors.primaryText,  bg: colors.primaryLight },
  arranged:           { label: '已安排', color: colors.primaryText,  bg: colors.primaryLight },
  in_service:         { label: '服務中', color: colors.secondaryText, bg: colors.accentLight },
  completed:          { label: '已完成', color: colors.success,      bg: colors.successLight },
};

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午', afternoon: '下午', evening: '晚上',
};

const PENDING_STATUSES = ['candidate_proposed', 'provider_confirmed', 'arranged'];
const IN_SERVICE_STATUSES = ['in_service'];

type StatFilter = null | 'pending' | 'in_service' | 'completed';

// ─── Service Icons (reused from services index) ──────────────

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
      <SvgCircle cx="12" cy="5" r="2.5" stroke={color} strokeWidth={1.5} fill="none" />
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

const SERVICE_COLORS: Record<string, { icon: string; bg: string }> = {
  escort_visit:          { icon: '#E8707E', bg: '#FFF2F4' },
  functional_assessment: { icon: '#7B71D4', bg: '#F2F0FF' },
  exercise_program:      { icon: '#5BB98B', bg: '#F0F9F3' },
  home_cleaning:         { icon: '#E8A44E', bg: '#FFF8EF' },
  pre_visit_consult:     { icon: '#9B8FD8', bg: '#F5F3FF' },
  daily_living_support:  { icon: '#6BAFCF', bg: '#F0F7FC' },
  nutrition_consult:     { icon: '#6DB88A', bg: '#F0F8F2' },
  shopping_assist:       { icon: '#D4789B', bg: '#FFF0F5' },
};

// ─── Utility Icons ────────────────────────────────────────────

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

function IconClipboard({ size = 16, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5a2 2 0 002 2h2a2 2 0 002-2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconBriefcase({ size = 18, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="7" width="20" height="14" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
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

function IconUserMenu({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx="12" cy="8" r="4" stroke={color} strokeWidth={1.8} />
      <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function IconBellMenu({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconSettings({ color = colors.secondaryText }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.8} />
      <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
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

function IconCheckCircle({ size = 36, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx="12" cy="12" r="10" stroke={color} strokeWidth={1.6} />
      <Path d="M8 12l3 3 5-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconCheckSm({ color = colors.success }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx="12" cy="12" r="10" stroke={color} strokeWidth={1.8} />
      <Path d="M8 12l3 3 5-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconUserAvatar({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx="12" cy="8" r="4" stroke={color} strokeWidth={1.8} />
      <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function IconStatusDot({ color = colors.accent }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx="12" cy="12" r="10" stroke={color} strokeWidth={1.8} />
      <SvgCircle cx="12" cy="12" r="3.5" fill={color} />
    </Svg>
  );
}

function IconHeadphones({ color = colors.warning }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M3 14v-2a9 9 0 0118 0v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M3 14v3a2 2 0 002 2h2v-7H5a2 2 0 00-2 2zM21 14v3a2 2 0 01-2 2h-2v-7h2a2 2 0 012 2z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function ProviderTasksScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState<ProviderTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statFilter, setStatFilter] = useState<StatFilter>(null);
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
    } finally { setLoading(false); setHasLoadedOnce(true); }
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

  // ─── Greeting (time of day) ─────────────────────────────────

  const greetingTime = (() => {
    const h = new Date().getHours();
    if (h < 12) return '早安';
    if (h < 18) return '午安';
    return '晚安';
  })();

  const heroSubtitle = (() => {
    if (inServiceCount > 0) return `您有 ${inServiceCount} 個服務進行中`;
    if (pendingCount > 0) return `今日 ${pendingCount} 個待處理任務`;
    return '今日無任務，好好休息';
  })();

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
    // Status filter (overrides default "non-completed only")
    if (statFilter === 'pending') {
      if (!PENDING_STATUSES.includes(t.status)) return false;
    } else if (statFilter === 'in_service') {
      if (!IN_SERVICE_STATUSES.includes(t.status)) return false;
    } else if (statFilter === 'completed') {
      if (t.status !== 'completed') return false;
    } else {
      // No stat filter: show non-completed by default
      if (t.status === 'completed') return false;
    }
    if (selectedDate) return toLocalDateStr(new Date(t.preferred_date)) === selectedDate;
    return true;
  });

  // ─── Section label ──────────────────────────────────────────

  const sectionLabel = (() => {
    if (selectedDate) return `${selectedDate.slice(5).replace('-', '/')} 的任務`;
    if (statFilter === 'pending') return '待確認任務';
    if (statFilter === 'in_service') return '進行中任務';
    if (statFilter === 'completed') return '已完成任務';
    return '待辦任務';
  })();

  // ─── Empty state context ────────────────────────────────────

  const emptyContext = (() => {
    if (selectedDate) {
      return { title: '這天沒有任務', subtitle: '滑動日期軸選擇其他日子' };
    }
    if (statFilter === 'pending') {
      return { title: '目前沒有待確認任務', subtitle: '所有指派都已被你確認' };
    }
    if (statFilter === 'in_service') {
      return { title: '目前沒有進行中任務', subtitle: '無正在執行的服務' };
    }
    if (statFilter === 'completed') {
      return { title: '尚無已完成任務', subtitle: '完成第一個服務後會顯示在這裡' };
    }
    return { title: '今日無待辦任務', subtitle: '好好休息，有新任務會通知你' };
  })();

  // Recent completed tasks (for empty-state fallback content)
  const recentCompleted = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => new Date(b.preferred_date).getTime() - new Date(a.preferred_date).getTime())
    .slice(0, 5);

  const showCompletedFallback = statFilter !== 'completed' && recentCompleted.length > 0;

  // ─── Render Task Card ───────────────────────────────────────

  const renderItem = ({ item }: { item: ProviderTask }) => {
    const status = STATUS_CONFIG[item.status] ?? { label: item.status, color: colors.textTertiary, bg: colors.bgSurfaceAlt };
    const clr = SERVICE_COLORS[item.category.code] ?? { icon: colors.primary, bg: colors.primaryLight };
    const ItemIcon = SERVICE_ICONS[item.category.code];
    const dateStr = new Date(item.preferred_date).toLocaleDateString('zh-TW');

    return (
      <TouchableOpacity
        style={s.taskCard}
        onPress={() => router.push(`/(tabs)/services/provider-task-detail?taskId=${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={[s.taskIconWrap, { backgroundColor: clr.bg }]}>
          {ItemIcon ? <ItemIcon size={20} color={clr.icon} /> : null}
        </View>
        <View style={s.taskBody}>
          <View style={s.taskTopRow}>
            <Text style={s.taskCategory} numberOfLines={1}>{item.category.name}</Text>
            <View style={[s.taskBadge, { backgroundColor: status.bg }]}>
              <Text style={[s.taskBadgeText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          <Text style={s.taskRecipient} numberOfLines={1}>
            {item.recipient.name} · {dateStr}{item.preferred_time_slot ? ` ${TIME_SLOT_LABELS[item.preferred_time_slot] ?? ''}` : ''}
          </Text>
          <Text style={s.taskLocation} numberOfLines={1}>{item.location}</Text>
        </View>
        <IconChevron color={colors.textDisabled} />
      </TouchableOpacity>
    );
  };

  // ─── Stat card press handlers ───────────────────────────────

  const toggleStat = (which: StatFilter) => {
    setStatFilter((cur) => (cur === which ? null : which));
    setSelectedDate(null); // clear date filter when changing stat filter
  };

  // ─── Main Render ────────────────────────────────────────────

  if (!hasLoadedOnce) {
    return <LoadingScreen />;
  }

  const initial = user?.name?.charAt(0) ?? '';

  return (
    <View style={s.container}>
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
            {/* ── Top Bar: avatar + greeting + bell/menu ─── */}
            <View style={s.topBar}>
              <View style={s.topLeft}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initial}</Text>
                </View>
                <View style={s.greetingTextWrap}>
                  <Text style={s.greetingSub}>{greetingTime}</Text>
                  <Text style={s.greeting}>{user?.name ?? ''}</Text>
                </View>
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

            {/* ── Glass Hero ───────────────────────────── */}
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
                <Text style={s.heroTagline}>WHOCARES PROVIDER</Text>
                <Text style={s.heroSubtitle}>{heroSubtitle}</Text>

                {inServiceCount > 0 && (
                  <TouchableOpacity
                    style={s.heroBanner}
                    onPress={() => toggleStat('in_service')}
                    activeOpacity={0.8}
                  >
                    <View style={s.heroBannerIconWrap}>
                      <IconBriefcase size={16} color={colors.primary} />
                    </View>
                    <Text style={s.heroBannerText}>{inServiceCount} 個服務進行中</Text>
                    <IconChevron color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Stats Row (tappable filters) ─────────── */}
            <View style={s.statsRow}>
              {[
                { key: 'pending' as const,    label: '待確認', count: pendingCount,    color: colors.warning },
                { key: 'in_service' as const, label: '進行中', count: inServiceCount, color: colors.primary },
                { key: 'completed' as const,  label: '已完成', count: completedCount, color: colors.success },
              ].map((stat) => {
                const isActive = statFilter === stat.key;
                return (
                  <TouchableOpacity
                    key={stat.key}
                    style={[s.statCard, isActive && s.statCardActive]}
                    onPress={() => toggleStat(stat.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.statValue, { color: stat.color }]}>{stat.count}</Text>
                    <Text style={s.statLabel}>{stat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Date Bar ───────────────────────────── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dateBarScroll} contentContainerStyle={s.dateBarContent}>
              {weekDates.map((d) => {
                const isActive = selectedDate === d.key;
                return (
                  <TouchableOpacity
                    key={d.key}
                    style={[s.dateCell, isActive && s.dateCellActive]}
                    onPress={() => setSelectedDate(isActive ? null : d.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.dateDayLabel, isActive && s.dateLabelActive]}>{d.dayLabel}</Text>
                    <Text style={[s.dateDateNum, isActive && s.dateNumActive]}>{d.dateNum}</Text>
                    {d.hasTasks && <View style={[s.dateDot, isActive && s.dateDotActive]} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── Section Header ───────────────────── */}
            <View style={s.sectionHeader}>
              <IconClipboard />
              <Text style={s.sectionTitle}>{sectionLabel}</Text>
              {(statFilter || selectedDate) && (
                <TouchableOpacity
                  onPress={() => { setStatFilter(null); setSelectedDate(null); }}
                  activeOpacity={0.7}
                  style={s.clearBtn}
                >
                  <Text style={s.clearBtnText}>清除篩選</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? null : error ? (
            <View style={s.emptyArea}>
              <Text style={s.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => void fetchTasks()} style={s.retryBtn} activeOpacity={0.7}>
                <Text style={s.retryText}>重試</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Friendly empty hero */}
              <View style={s.emptyHero}>
                <View style={s.emptyIconWrap}>
                  <IconCheckCircle size={36} color={colors.primary} />
                </View>
                <Text style={s.emptyTitle}>{emptyContext.title}</Text>
                <Text style={s.emptySubtitle}>{emptyContext.subtitle}</Text>
              </View>

              {/* Recent completed (fallback content) */}
              {showCompletedFallback ? (
                <>
                  <View style={s.completedHeader}>
                    <IconCheckSm color={colors.success} />
                    <Text style={s.completedTitle}>近期完成</Text>
                    <Text style={s.completedCount}>{recentCompleted.length} 筆</Text>
                  </View>
                  {recentCompleted.map((t) => (
                    <View key={t.id}>
                      {renderItem({ item: t })}
                    </View>
                  ))}
                </>
              ) : (
                /* No history either — show quick action guides */
                <>
                  <View style={s.completedHeader}>
                    <IconClipboard color={colors.primary} />
                    <Text style={s.completedTitle}>開始接案</Text>
                  </View>
                  <View style={s.quickActionsCard}>
                    {[
                      {
                        key: 'profile',
                        icon: <IconUserAvatar color={colors.primary} />,
                        bg: colors.primaryLight,
                        title: '完整個人資料',
                        desc: '提供完整資訊以提高媒合機率',
                        onPress: () => router.push('/(tabs)/services/provider-profile'),
                      },
                      {
                        key: 'status',
                        icon: <IconStatusDot color={colors.accent} />,
                        bg: colors.accentLight,
                        title: '設定接案狀態',
                        desc: '切換為「可接案」以接收新案件',
                        onPress: () => router.push('/(tabs)/services/provider-profile'),
                      },
                      {
                        key: 'support',
                        icon: <IconHeadphones color={colors.warning} />,
                        bg: colors.warningLight,
                        title: '聯絡客服',
                        desc: '對平台運作有疑問？我們在這',
                        onPress: () => Alert.alert('提示', '客服功能即將推出'),
                      },
                    ].map((item, idx, arr) => (
                      <TouchableOpacity
                        key={item.key}
                        style={[
                          s.quickActionRow,
                          idx < arr.length - 1 && s.quickActionRowDivider,
                        ]}
                        onPress={item.onPress}
                        activeOpacity={0.7}
                      >
                        <View style={[s.quickActionIcon, { backgroundColor: item.bg }]}>
                          {item.icon}
                        </View>
                        <View style={s.quickActionContent}>
                          <Text style={s.quickActionTitle}>{item.title}</Text>
                          <Text style={s.quickActionDesc}>{item.desc}</Text>
                        </View>
                        <IconChevron color={colors.textDisabled} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          )
        }
      />

      {/* ── Menu Modal ───────────────────────── */}
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
                <Text style={s.menuName}>{user?.name ?? ''}</Text>
                <View style={s.menuRoleBadge}>
                  <Text style={s.menuRoleBadgeText}>服務人員</Text>
                </View>
              </View>
            </View>

            {/* Group: 我的 */}
            <Text style={s.menuGroupLabel}>我的</Text>
            <View style={s.menuGroup}>
              {[
                { key: 'profile', label: '個人資料', icon: <IconUserMenu />, bg: colors.primaryLight, onPress: () => router.push('/(tabs)/services/provider-profile') },
                { key: 'notif',   label: '通知中心', icon: <IconBellMenu />, bg: colors.primaryLight, onPress: () => router.push('/(tabs)/home/notifications') },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={s.menuRow}
                  onPress={() => { setMenuVisible(false); item.onPress(); }}
                  activeOpacity={0.7}
                >
                  <View style={[s.menuIconWrap, { backgroundColor: item.bg }]}>{item.icon}</View>
                  <Text style={s.menuRowText}>{item.label}</Text>
                  <IconChevron color={colors.textDisabled} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Group: 系統 */}
            <Text style={s.menuGroupLabel}>系統</Text>
            <View style={s.menuGroup}>
              <TouchableOpacity
                style={s.menuRow}
                onPress={() => { setMenuVisible(false); Alert.alert('提示', '設定功能即將推出'); }}
                activeOpacity={0.7}
              >
                <View style={[s.menuIconWrap, { backgroundColor: colors.bgSurfaceAlt }]}>
                  <IconSettings />
                </View>
                <Text style={s.menuRowText}>設定</Text>
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
  container: { flex: 1, backgroundColor: colors.bgScreen },
  listContent: { paddingBottom: spacing['3xl'] },

  // ─── Top Bar ────────────────────────────────────────────
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
  badge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderWidth: 2, borderColor: colors.bgScreen,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },

  // ─── Hero ────────────────────────────────────────────────
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
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.xxs,
  },
  heroBanner: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(46,141,201,0.18)',
  },
  heroBannerIconWrap: {
    width: 24, height: 24,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  heroBannerText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // ─── Stats Row ──────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  statCardActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  statValue: {
    fontSize: typography.headingXl.fontSize,
    fontWeight: '700',
    lineHeight: 32,
  },
  statLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
    marginTop: spacing.xxs + 1,
  },

  // ─── Date Bar ───────────────────────────────────────────
  dateBarScroll: { maxHeight: 80, marginBottom: spacing.lg },
  dateBarContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  dateCell: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderDefault,
    minWidth: 48,
  },
  dateCellActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  dateDayLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  dateLabelActive: { color: colors.primaryText, fontWeight: '600' },
  dateDateNum: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dateNumActive: { color: colors.primaryText },
  dateDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: colors.textDisabled,
    marginTop: spacing.xs,
  },
  dateDotActive: { backgroundColor: colors.primary },

  // ─── Section Header ──────────────────────────────────────
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
  clearBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearBtnText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.primaryText,
    fontWeight: '600',
  },

  // ─── Task Card ──────────────────────────────────────────
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  taskIconWrap: {
    width: 44, height: 44,
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  taskBody: { flex: 1, gap: 4 },
  taskTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  taskCategory: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  taskBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
  },
  taskBadgeText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
  },
  taskRecipient: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
  },
  taskLocation: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
  },

  // ─── Empty / Error ──────────────────────────────────────
  emptyArea: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textDisabled,
    textAlign: 'center',
  },
  errorText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.danger,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.primary,
  },
  retryText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.primaryText,
    fontWeight: '700',
  },

  // ─── Friendly Empty Hero ──────────────────────────────────
  emptyHero: {
    alignItems: 'center',
    paddingVertical: spacing.xl + spacing.sm,
    paddingHorizontal: spacing.xl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  emptyIconWrap: {
    width: 72, height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xxs + 1,
    lineHeight: 18,
  },

  // ─── Completed Fallback Section ──────────────────────────
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm + 2,
  },
  completedTitle: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  completedCount: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
  },

  // ─── Quick Actions (truly-empty fallback) ────────────────
  quickActionsCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  quickActionRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  quickActionIcon: {
    width: 40, height: 40,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  quickActionContent: { flex: 1, gap: 2 },
  quickActionTitle: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  quickActionDesc: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    lineHeight: 16,
  },

  // ─── Menu Modal ─────────────────────────────────────────
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

  // Profile header
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
    backgroundColor: colors.accentLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
  },
  menuRoleBadgeText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
    color: colors.secondaryText,
  },

  // Group label
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

  // Item rows
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
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

  // Logout (separate, danger)
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
