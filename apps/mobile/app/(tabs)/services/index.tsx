import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle as SvgCircle, Rect } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

// ─── Types ────────────────────────────────────────────────────

interface ServiceRequest {
  id: string;
  status: string;
  preferred_date: string;
  preferred_time_slot: string | null;
  location: string;
  description: string;
  created_at: string;
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
}

interface ServiceCategory {
  id: string;
  code: string;
  name: string;
}

// ─── Filter Options ──────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'active', label: '處理中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
] as const;

const ACTIVE_STATUSES = [
  'submitted', 'screening', 'candidate_proposed',
  'caregiver_confirmed', 'provider_confirmed', 'arranged', 'in_service',
];

// ─── Service Icons ───────────────────────────────────────────

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

const SERVICE_COLORS: Record<string, { icon: string; bg: string; accent: string }> = {
  escort_visit:          { icon: '#E8707E', bg: '#FFF2F4', accent: '#FFD4DB' },
  functional_assessment: { icon: '#7B71D4', bg: '#F2F0FF', accent: '#DDD8FF' },
  exercise_program:      { icon: '#5BB98B', bg: '#F0F9F3', accent: '#C8ECD6' },
  home_cleaning:         { icon: '#E8A44E', bg: '#FFF8EF', accent: '#FFE4C2' },
  pre_visit_consult:     { icon: '#9B8FD8', bg: '#F5F3FF', accent: '#DDD8FF' },
  daily_living_support:  { icon: '#6BAFCF', bg: '#F0F7FC', accent: '#C8E2F0' },
  nutrition_consult:     { icon: '#6DB88A', bg: '#F0F8F2', accent: '#C8ECD6' },
  shopping_assist:       { icon: '#D4789B', bg: '#FFF0F5', accent: '#FFD4E4' },
};

// ─── Component ────────────────────────────────────────────────

export default function ServicesScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [showAllRequests, setShowAllRequests] = useState(true);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<ServiceRequest[]>('/service-requests?limit=50');
      setRequests(result);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗，請稍後再試');
    } finally { setLoading(false); }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await api.get<ServiceCategory[]>('/service-categories');
      setCategories(cats);
    } catch { /* non-critical */ }
  }, []);

  useFocusEffect(
    useCallback(() => { void fetchRequests(); void fetchCategories(); }, [fetchRequests, fetchCategories]),
  );

  const filteredRequests = requests.filter((r) => {
    if (!filter) return true;
    if (filter === 'active') return ACTIVE_STATUSES.includes(r.status);
    return r.status === filter;
  });

  // No longer split featured/other — all 8 in one grid

  // ─── Error State ──────────────────────────────────────────

  if (error && requests.length === 0 && categories.length === 0) {
    return (
      <View style={s.center}>
        <ErrorState message={error} onRetry={() => { void fetchRequests(); void fetchCategories(); }} />
      </View>
    );
  }

  // ─── Loading State ────────────────────────────────────────

  if (loading && requests.length === 0 && categories.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.loadingText}>載入中...</Text>
      </View>
    );
  }

  // ─── Main Render ──────────────────────────────────────────

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

      {/* ═══ Service Quick Links (2×4 grid) ══════════════════ */}
      {categories.length > 0 && (
        <View style={s.catGridWrap}>
          <View style={s.catGrid}>
            {categories.map((cat) => {
              const clr = SERVICE_COLORS[cat.code] ?? { icon: colors.primary, bg: colors.primaryLight, accent: colors.primaryLight };
              const IconComp = SERVICE_ICONS[cat.code];
              return (
                <TouchableOpacity key={cat.id} style={[s.catCard, { backgroundColor: clr.bg }]} onPress={() => router.push(`/(tabs)/services/new-request?categoryId=${cat.id}`)} activeOpacity={0.7}>
                  <View style={s.catIconWrap}>
                    {IconComp && <IconComp size={22} color={clr.icon} />}
                  </View>
                  <Text style={[s.catName, { color: clr.icon }]}>{cat.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ═══ Request History (main content) ═══════════════════ */}
      <View style={s.historySection}>
        <TouchableOpacity
          style={s.historyHeader}
          onPress={() => setShowAllRequests((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={s.historySectionTitle}>需求紀錄</Text>
          <Text style={s.historyToggle}>{showAllRequests ? '收合' : `${requests.length} 筆 →`}</Text>
        </TouchableOpacity>

        {showAllRequests && (
          <>
            {/* Filter Chips */}
            {requests.length > 0 && (
              <View style={s.filterRow}>
                {FILTER_OPTIONS.map((opt) => {
                  const isActive = filter === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[s.filterChip, isActive && s.filterChipActive]}
                      onPress={() => setFilter(opt.value)}
                    >
                      <Text style={[s.filterChipText, isActive && s.filterChipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {requests.length === 0 ? (
              <View style={s.emptyWrap}>
                <EmptyState title="尚無需求紀錄" description="預約服務後，紀錄會顯示在這裡。" />
              </View>
            ) : filteredRequests.length === 0 ? (
              <View style={s.emptyWrap}>
                <EmptyState title="沒有符合的需求" description="試試其他篩選條件。" />
              </View>
            ) : (
              filteredRequests.map((item) => (
                <Card key={item.id} style={s.requestCard} onPress={() => router.push(`/(tabs)/services/${item.id}`)}>
                  <View style={s.cardHeader}>
                    <Text style={s.categoryName}>{item.category.name}</Text>
                    <StatusPill status={item.status} type="serviceRequest" />
                  </View>
                  <Text style={s.recipientName}>{item.recipient.name}</Text>
                  <Text style={s.meta}>期望日期：{new Date(item.preferred_date).toLocaleDateString('zh-TW')}</Text>
                </Card>
              ))
            )}
          </>
        )}
      </View>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  scrollContent: { paddingBottom: spacing['3xl'] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bgScreen },
  loadingText: { marginTop: spacing.sm, fontSize: typography.bodySm.fontSize, color: colors.textTertiary },

  // ─── Category Grid (2×4) ─────────────────────────────────
  catGridWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.md },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catCard: {
    width: '22%' as unknown as number, flexGrow: 1,
    borderRadius: radius.lg, paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  catIconWrap: { marginBottom: spacing.sm },
  catName: { fontSize: typography.captionSm.fontSize, fontWeight: '600', textAlign: 'center' },

  // ─── History Section ────────────────────────────────────
  historySection: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  historySectionTitle: { fontSize: typography.headingSm.fontSize, fontWeight: '700', color: colors.textPrimary },
  historyToggle: { fontSize: typography.bodySm.fontSize, color: colors.primaryText, fontWeight: '600' },

  // ─── Filter Chips ───────────────────────────────────────
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
  },
  filterChipActive: { borderColor: colors.primaryText, backgroundColor: colors.primaryLight },
  filterChipText: { fontSize: typography.caption.fontSize, color: colors.textTertiary },
  filterChipTextActive: { color: colors.primaryText, fontWeight: '600' },

  // ─── Request Card ───────────────────────────────────────
  requestCard: { marginBottom: spacing.sm, padding: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  categoryName: { fontSize: typography.bodyMd.fontSize, fontWeight: '600', color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  recipientName: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary, marginBottom: spacing.xxs },
  meta: { fontSize: typography.caption.fontSize, color: colors.textDisabled },

  // ─── Empty ──────────────────────────────────────────────
  emptyWrap: { paddingVertical: spacing.xl },
});
