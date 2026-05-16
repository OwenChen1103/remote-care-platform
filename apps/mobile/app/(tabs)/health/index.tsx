import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { TrendChart, type ChartSeries } from '@/components/ui/TrendChart';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { GLUCOSE_TIMING_DISPLAY, BP_THRESHOLDS } from '@remote-care/shared';

// ─── Types ────────────────────────────────────────────────────

interface Recipient { id: string; name: string }

interface Measurement {
  id: string;
  type: string;
  systolic: number | null;
  diastolic: number | null;
  glucose_value: number | null;
  glucose_timing: string | null;
  is_abnormal: boolean;
  measured_at: string;
}

type MeasurementType = 'blood_pressure' | 'blood_glucose';
type Period = '7d' | '30d';

interface BpStats {
  period: string; type: 'blood_pressure'; count: number;
  systolic: { min: number; max: number; avg: number } | null;
  diastolic: { min: number; max: number; avg: number } | null;
  heart_rate: { min: number; max: number; avg: number } | null;
  abnormal_count: number;
  daily_data: { date: string; systolic_avg: number | null; diastolic_avg: number | null; is_abnormal: boolean; count: number }[];
}

interface BgStats {
  period: string; type: 'blood_glucose'; count: number;
  glucose_value: { min: number; max: number; avg: number } | null;
  abnormal_count: number;
  daily_data: { date: string; glucose_avg: number | null; is_abnormal: boolean; count: number }[];
}

type StatsData = BpStats | BgStats;

// ─── Helpers ──────────────────────────────────────────────────

function formatTiming(timing: string | null): string {
  if (!timing) return '';
  return GLUCOSE_TIMING_DISPLAY[timing]?.label ?? '';
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `今天 ${hh}:${mm}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return `${diffDays} 天前`;
  return d.toLocaleDateString('zh-TW');
}

function toChartLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parts[1]}/${parts[2]}`;
}

function buildBpSeries(data: BpStats['daily_data']): ChartSeries[] {
  return [
    { name: '收縮壓', color: colors.primary, data: data.map((d) => ({ label: toChartLabel(d.date), value: d.systolic_avg, isAbnormal: d.is_abnormal })) },
    { name: '舒張壓', color: colors.primaryText, data: data.map((d) => ({ label: toChartLabel(d.date), value: d.diastolic_avg, isAbnormal: d.is_abnormal })) },
  ];
}

function buildBgSeries(data: BgStats['daily_data']): ChartSeries[] {
  return [
    { name: '血糖', color: colors.primary, data: data.map((d) => ({ label: toChartLabel(d.date), value: d.glucose_avg, isAbnormal: d.is_abnormal })) },
  ];
}

// ─── Icons ────────────────────────────────────────────────────

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
function IconChart({ size = 16, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 17l5-5 4 4 8-8M16 8h5v5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconClock({ size = 16, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={1.8} />
      <Path d="M12 6v6l4 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconDownload({ size = 14, color = colors.primaryText }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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

// ─── Component ────────────────────────────────────────────────

export default function HealthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Trend state
  const [trendType, setTrendType] = useState<MeasurementType>('blood_pressure');
  const [trendPeriod, setTrendPeriod] = useState<Period>('7d');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchRecipients = useCallback(async () => {
    try {
      const result = await api.get<Recipient[]>('/recipients');
      setRecipients(result);
      if (result[0] && !selectedRecipientId) setSelectedRecipientId(result[0].id);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗，請稍後再試');
    }
  }, [selectedRecipientId]);

  const fetchMeasurements = useCallback(async () => {
    if (!selectedRecipientId) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.get<Measurement[]>(`/measurements?recipient_id=${selectedRecipientId}&limit=20`);
      setMeasurements(result);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗');
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, [selectedRecipientId]);

  const fetchStats = useCallback(async () => {
    if (!selectedRecipientId) return;
    setStatsLoading(true);
    try {
      const result = await api.get<StatsData>(`/measurements/stats?recipient_id=${selectedRecipientId}&type=${trendType}&period=${trendPeriod}`);
      setStats(result);
    } catch { /* non-critical */ }
    finally { setStatsLoading(false); }
  }, [selectedRecipientId, trendType, trendPeriod]);

  useFocusEffect(useCallback(() => { void fetchRecipients(); }, [fetchRecipients]));
  useEffect(() => { void fetchMeasurements(); }, [fetchMeasurements]);
  useEffect(() => { void fetchStats(); }, [fetchStats]);

  const latestBP = measurements.find((m) => m.type === 'blood_pressure');
  const latestBG = measurements.find((m) => m.type === 'blood_glucose');
  const recipientName = recipients.find((r) => r.id === selectedRecipientId)?.name ?? '';
  const recentAbnormalCount = measurements.filter((m) => m.is_abnormal).length;

  // Chart data
  const chartSeries: ChartSeries[] = stats
    ? stats.type === 'blood_pressure' ? buildBpSeries(stats.daily_data) : buildBgSeries(stats.daily_data)
    : [];
  const bpAbnormalZone = trendType === 'blood_pressure'
    ? { low: BP_THRESHOLDS.SYSTOLIC.NORMAL_HIGH, high: BP_THRESHOLDS.SYSTOLIC.HIGH + 20 }
    : undefined;

  // ─── Fatal Error ──────────────────────────────────────────

  if (error && recipients.length === 0) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <ErrorState message={error} onRetry={() => void fetchRecipients()} />
      </View>
    );
  }

  if (!hasLoadedOnce) return <LoadingScreen />;

  // ─── Main Render ──────────────────────────────────────────

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <FlatList
        data={loading && measurements.length === 0 ? [] : measurements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        onRefresh={() => { void fetchMeasurements(); void fetchStats(); }}
        refreshing={loading}
        ListHeaderComponent={
          <>
            {/* ── Recipient Switcher ─────────────── */}
            {recipients.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.switcherScroll} contentContainerStyle={s.switcherContent}>
                {recipients.map((r) => {
                  const isActive = r.id === selectedRecipientId;
                  return (
                    <TouchableOpacity key={r.id} style={[s.switcherChip, isActive && s.switcherChipActive]} onPress={() => setSelectedRecipientId(r.id)} activeOpacity={0.7}>
                      <Text style={[s.switcherText, isActive && s.switcherTextActive]}>{r.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* ── Hero Card ───────────────────────── */}
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
                <Text style={s.heroTagline}>HEALTH RECORDS</Text>
                <Text style={s.heroSubtitle}>{recipientName ? `${recipientName} 的健康紀錄` : '健康紀錄'}</Text>
                {recentAbnormalCount > 0 && (
                  <View style={s.heroBadge}>
                    <View style={s.heroBadgeDot} />
                    <Text style={s.heroBadgeText}>近期 {recentAbnormalCount} 筆需留意</Text>
                  </View>
                )}
              </View>
            </View>

            {/* ── Quick Record Actions ───────────── */}
            <View style={s.actionsRow}>
              <TouchableOpacity
                style={s.actionCard}
                onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${selectedRecipientId}&type=blood_pressure`)}
                activeOpacity={0.7}
              >
                <View style={[s.actionIconWrap, { backgroundColor: colors.dangerLight }]}>
                  <IconHeart size={20} />
                </View>
                <Text style={s.actionLabel}>記錄血壓</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.actionCard}
                onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${selectedRecipientId}&type=blood_glucose`)}
                activeOpacity={0.7}
              >
                <View style={[s.actionIconWrap, { backgroundColor: colors.warningLight }]}>
                  <IconDrop size={20} />
                </View>
                <Text style={s.actionLabel}>記錄血糖</Text>
              </TouchableOpacity>
            </View>

            {/* ── Latest Values Strip ─────────────── */}
            {(latestBP || latestBG) && (
              <View style={s.latestCard}>
                {latestBP && (
                  <View style={s.latestRow}>
                    <View style={[s.latestDot, { backgroundColor: colors.danger }]} />
                    <Text style={s.latestType}>血壓</Text>
                    <Text style={[s.latestValue, latestBP.is_abnormal && { color: colors.danger }]}>
                      {latestBP.systolic}/{latestBP.diastolic}
                    </Text>
                    <Text style={s.latestUnit}>mmHg</Text>
                    <Text style={s.latestTime}>{formatTime(latestBP.measured_at)}</Text>
                  </View>
                )}
                {latestBP && latestBG && <View style={s.latestDivider} />}
                {latestBG && (
                  <View style={s.latestRow}>
                    <View style={[s.latestDot, { backgroundColor: colors.warning }]} />
                    <Text style={s.latestType}>血糖</Text>
                    <Text style={[s.latestValue, latestBG.is_abnormal && { color: colors.danger }]}>
                      {latestBG.glucose_value}
                    </Text>
                    <Text style={s.latestUnit}>mg/dL</Text>
                    <Text style={s.latestTime}>{formatTime(latestBG.measured_at)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Trend Section ───────────────────── */}
            <View style={s.sectionHeader}>
              <IconChart />
              <Text style={s.sectionTitle}>健康趨勢</Text>
              <TouchableOpacity
                onPress={() => router.push(`/(tabs)/health/trends?recipientId=${selectedRecipientId}`)}
                activeOpacity={0.7}
                style={s.sectionLink}
              >
                <Text style={s.sectionLinkText}>完整趨勢</Text>
                <IconChevron color={colors.primaryText} />
              </TouchableOpacity>
            </View>
            <View style={s.trendCard}>
              {/* Toggles */}
              <View style={s.trendControls}>
                <View style={s.toggleRow}>
                  {(['blood_pressure', 'blood_glucose'] as const).map((t) => {
                    const active = trendType === t;
                    return (
                      <TouchableOpacity key={t} style={[s.toggleChip, active && s.toggleChipActive]} onPress={() => setTrendType(t)} activeOpacity={0.7}>
                        <Text style={[s.toggleText, active && s.toggleTextActive]}>{t === 'blood_pressure' ? '血壓' : '血糖'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={s.periodRow}>
                  {(['7d', '30d'] as const).map((p) => {
                    const active = trendPeriod === p;
                    return (
                      <TouchableOpacity key={p} style={[s.periodChip, active && s.periodChipActive]} onPress={() => setTrendPeriod(p)} activeOpacity={0.7}>
                        <Text style={[s.periodText, active && s.periodTextActive]}>{p === '7d' ? '7天' : '30天'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Chart */}
              {statsLoading ? (
                <View style={s.chartLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : stats && stats.count > 0 ? (
                <>
                  <TrendChart series={chartSeries} unit={trendType === 'blood_pressure' ? 'mmHg' : 'mg/dL'} abnormalZone={bpAbnormalZone} height={160} />
                  {stats.type === 'blood_pressure' && stats.systolic && stats.diastolic && (
                    <View style={s.avgRow}>
                      <View style={s.avgItem}>
                        <Text style={s.avgLabel}>收縮壓均值</Text>
                        <Text style={s.avgValue}>{Math.round(stats.systolic.avg)}</Text>
                        <Text style={s.avgRange}>{stats.systolic.min}–{stats.systolic.max}</Text>
                      </View>
                      <View style={s.avgDivider} />
                      <View style={s.avgItem}>
                        <Text style={s.avgLabel}>舒張壓均值</Text>
                        <Text style={s.avgValue}>{Math.round(stats.diastolic.avg)}</Text>
                        <Text style={s.avgRange}>{stats.diastolic.min}–{stats.diastolic.max}</Text>
                      </View>
                      <View style={s.avgDivider} />
                      <View style={s.avgItem}>
                        <Text style={s.avgLabel}>需留意</Text>
                        <Text style={[s.avgValue, stats.abnormal_count > 0 && { color: colors.warning }]}>{stats.abnormal_count}</Text>
                        <Text style={s.avgRange}>筆</Text>
                      </View>
                    </View>
                  )}
                  {stats.type === 'blood_glucose' && stats.glucose_value && (
                    <View style={s.avgRow}>
                      <View style={s.avgItem}>
                        <Text style={s.avgLabel}>血糖均值</Text>
                        <Text style={s.avgValue}>{Math.round(stats.glucose_value.avg)}</Text>
                        <Text style={s.avgRange}>{stats.glucose_value.min}–{stats.glucose_value.max}</Text>
                      </View>
                      <View style={s.avgDivider} />
                      <View style={s.avgItem}>
                        <Text style={s.avgLabel}>需留意</Text>
                        <Text style={[s.avgValue, stats.abnormal_count > 0 && { color: colors.warning }]}>{stats.abnormal_count}</Text>
                        <Text style={s.avgRange}>筆</Text>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <View style={s.chartEmpty}>
                  <Text style={s.chartEmptyText}>尚無趨勢資料</Text>
                </View>
              )}
            </View>

            {/* ── Recent Records Section Header ──── */}
            {measurements.length > 0 && (
              <View style={s.sectionHeader}>
                <IconClock />
                <Text style={s.sectionTitle}>近期紀錄</Text>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/health/export')}
                  activeOpacity={0.7}
                  style={s.sectionLink}
                >
                  <IconDownload />
                  <Text style={s.sectionLinkText}>匯出</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={s.centerInline}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={s.loadingText}>載入中...</Text>
            </View>
          ) : error ? (
            <View style={s.centerInline}>
              <ErrorState message={error} onRetry={() => void fetchMeasurements()} />
            </View>
          ) : (
            <View style={{ marginTop: spacing.md }}>
              <EmptyState
                title="尚無量測紀錄"
                description="定期記錄血壓與血糖，有助於掌握健康狀況。"
                actionLabel="開始記錄"
                onAction={() => router.push(`/(tabs)/health/add-measurement?recipientId=${selectedRecipientId}&type=blood_pressure`)}
              />
            </View>
          )
        }
        renderItem={({ item }) => {
          const isBP = item.type === 'blood_pressure';
          const tintBg = isBP ? colors.dangerLight : colors.warningLight;
          return (
            <View style={s.measureCard}>
              <View style={[s.measureIconWrap, { backgroundColor: tintBg }]}>
                {isBP ? <IconHeart size={18} /> : <IconDrop size={18} />}
              </View>
              <View style={s.measureBody}>
                <View style={s.measureTopRow}>
                  <Text style={s.measureType}>{isBP ? '血壓' : '血糖'}</Text>
                  {item.is_abnormal && (
                    <View style={s.alertTag}><Text style={s.alertTagText}>需留意</Text></View>
                  )}
                </View>
                <View style={s.measureValueRow}>
                  <Text style={[s.measureValue, item.is_abnormal && { color: colors.danger }]}>
                    {isBP ? `${item.systolic}/${item.diastolic}` : `${item.glucose_value}`}
                  </Text>
                  <Text style={s.measureUnit}>{isBP ? 'mmHg' : 'mg/dL'}</Text>
                </View>
              </View>
              <View style={s.measureRight}>
                <Text style={s.measureTime}>{formatTime(item.measured_at)}</Text>
                {!isBP && item.glucose_timing && (
                  <Text style={s.measureTiming}>{formatTiming(item.glucose_timing)}</Text>
                )}
              </View>
            </View>
          );
        }}
        ListFooterComponent={<View style={{ height: spacing['3xl'] }} />}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  centerInline: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['3xl'] },
  loadingText: { marginTop: spacing.sm, fontSize: typography.bodySm.fontSize, color: colors.textTertiary },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  // ─── Recipient Switcher ─────────────────────────────────
  switcherScroll: { maxHeight: 44, marginBottom: spacing.md, marginHorizontal: -spacing.lg },
  switcherContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  switcherChip: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderDefault,
  },
  switcherChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary, borderWidth: 1.5 },
  switcherText: { fontSize: typography.bodySm.fontSize, color: colors.textSecondary, fontWeight: '500' },
  switcherTextActive: { color: colors.primaryText, fontWeight: '700' },

  // ─── Hero Card (matches services/AI hero) ──────────────
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(46,141,201,0.12)',
    marginBottom: spacing.md,
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
    borderColor: 'rgba(232,162,59,0.25)',
  },
  heroBadgeDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.warning,
  },
  heroBadgeText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // ─── Quick Record Actions ──────────────────────────────
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  actionIconWrap: {
    width: 40, height: 40,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // ─── Latest Values Strip ───────────────────────────────
  latestCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.lg,
  },
  latestRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: spacing.xs + 2,
    gap: spacing.sm,
  },
  latestDot: {
    width: 6, height: 6, borderRadius: 3,
    alignSelf: 'center',
  },
  latestType: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
    minWidth: 32,
  },
  latestValue: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  latestUnit: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    flex: 1,
  },
  latestTime: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
  },
  latestDivider: {
    height: 1,
    backgroundColor: colors.borderDefault,
  },

  // ─── Section Header ────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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

  // ─── Trend Card ────────────────────────────────────────
  trendCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  trendControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
  },
  toggleChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary, borderWidth: 1.5 },
  toggleText: { fontSize: typography.bodySm.fontSize, fontWeight: '500', color: colors.textSecondary },
  toggleTextActive: { color: colors.primaryText, fontWeight: '700' },
  periodRow: { flexDirection: 'row', gap: spacing.xs },
  periodChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
  },
  periodChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary, borderWidth: 1.5 },
  periodText: { fontSize: typography.bodySm.fontSize, color: colors.textSecondary },
  periodTextActive: { color: colors.primaryText, fontWeight: '700' },
  chartLoading: { height: 160, alignItems: 'center', justifyContent: 'center' },
  chartEmpty: { height: 100, alignItems: 'center', justifyContent: 'center' },
  chartEmptyText: { fontSize: typography.bodySm.fontSize, color: colors.textDisabled },

  // ─── Average Row ───────────────────────────────────────
  avgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.borderDefault,
  },
  avgItem: { flex: 1, alignItems: 'center' },
  avgDivider: { width: 1, height: 28, backgroundColor: colors.borderDefault },
  avgLabel: { fontSize: 10, color: colors.textDisabled, fontWeight: '500', marginBottom: spacing.xxs },
  avgValue: { fontSize: typography.headingSm.fontSize, fontWeight: '700', color: colors.textPrimary },
  avgRange: { fontSize: 10, color: colors.textDisabled, marginTop: 1 },

  // ─── Measurement Card ──────────────────────────────────
  measureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  measureIconWrap: {
    width: 40, height: 40,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  measureBody: { flex: 1, gap: 2 },
  measureTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  measureType: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  alertTag: {
    backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  alertTagText: { fontSize: 10, fontWeight: '600', color: colors.danger },
  measureValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  measureValue: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  measureUnit: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
  },
  measureRight: { alignItems: 'flex-end', gap: 2 },
  measureTime: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
  },
  measureTiming: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
  },
});
