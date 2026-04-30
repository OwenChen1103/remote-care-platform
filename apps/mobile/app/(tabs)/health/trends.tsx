import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { TrendChart, type ChartSeries } from '@/components/ui/TrendChart';
import { BP_THRESHOLDS } from '@remote-care/shared';

// ─── Types ────────────────────────────────────────────────────

type MeasurementType = 'blood_pressure' | 'blood_glucose';
type Period = '7d' | '30d';

interface BpStats {
  period: string;
  type: 'blood_pressure';
  count: number;
  systolic: { min: number; max: number; avg: number } | null;
  diastolic: { min: number; max: number; avg: number } | null;
  heart_rate: { min: number; max: number; avg: number } | null;
  abnormal_count: number;
  daily_data: { date: string; systolic_avg: number | null; diastolic_avg: number | null; is_abnormal: boolean; count: number }[];
}

interface BgStats {
  period: string;
  type: 'blood_glucose';
  count: number;
  glucose_value: { min: number; max: number; avg: number } | null;
  abnormal_count: number;
  daily_data: { date: string; glucose_avg: number | null; is_abnormal: boolean; count: number }[];
}

type StatsData = BpStats | BgStats;

// ─── Helpers ──────────────────────────────────────────────────

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

function IconChart({ size = 16, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 17l5-5 4 4 8-8M16 8h5v5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconStats({ size = 16, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12h4l3-9 4 18 3-9h4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCalendar({ size = 16, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={1.8} />
      <Path d="M12 6v6l4 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function TrendsScreen() {
  const { recipientId } = useLocalSearchParams<{ recipientId: string }>();
  const [type, setType] = useState<MeasurementType>('blood_pressure');
  const [period, setPeriod] = useState<Period>('7d');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    if (!recipientId) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.get<StatsData>(
        `/measurements/stats?recipient_id=${recipientId}&type=${type}&period=${period}`,
      );
      setStats(result);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [recipientId, type, period]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  if (loading && !stats) return <LoadingScreen />;

  const chartSeries: ChartSeries[] = stats
    ? stats.type === 'blood_pressure'
      ? buildBpSeries(stats.daily_data)
      : buildBgSeries(stats.daily_data)
    : [];

  const bpAbnormalZone = type === 'blood_pressure'
    ? { low: BP_THRESHOLDS.SYSTOLIC.NORMAL_HIGH, high: BP_THRESHOLDS.SYSTOLIC.HIGH + 20 }
    : undefined;

  const periodLabel = period === '7d' ? '7 天' : '30 天';
  const typeLabel = type === 'blood_pressure' ? '血壓' : '血糖';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* ─── Hero ───────────────────────────────────────────── */}
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
          <Text style={s.heroTagline}>HEALTH TRENDS</Text>
          <Text style={s.heroSubtitle}>{periodLabel}{typeLabel}趨勢分析</Text>
          {stats && stats.abnormal_count > 0 && (
            <View style={s.heroBadge}>
              <View style={s.heroBadgeDot} />
              <Text style={s.heroBadgeText}>{stats.abnormal_count} 筆需留意</Text>
            </View>
          )}
        </View>
      </View>

      {/* ─── Toggles ────────────────────────────────────────── */}
      <View style={s.toggleRow}>
        {(['blood_pressure', 'blood_glucose'] as const).map((t) => {
          const active = type === t;
          return (
            <TouchableOpacity
              key={t}
              style={[s.toggleChip, active && s.chipActive]}
              onPress={() => setType(t)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              activeOpacity={0.7}
            >
              <Text style={[s.toggleText, active && s.chipTextActive]}>
                {t === 'blood_pressure' ? '血壓' : '血糖'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.toggleRow}>
        {(['7d', '30d'] as const).map((p) => {
          const active = period === p;
          return (
            <TouchableOpacity
              key={p}
              style={[s.periodChip, active && s.chipActive]}
              onPress={() => setPeriod(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              activeOpacity={0.7}
            >
              <Text style={[s.periodText, active && s.chipTextActive]}>
                {p === '7d' ? '7 天' : '30 天'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── Content ────────────────────────────────────────── */}
      {error ? (
        <ErrorState message={error} onRetry={() => void fetchStats()} />
      ) : !stats || stats.count === 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <EmptyState
            title="尚無量測資料"
            description="記錄健康數據後，即可在此查看趨勢。"
          />
        </View>
      ) : (
        <>
          {/* Chart */}
          <View style={s.sectionHeader}>
            <IconChart />
            <Text style={s.sectionTitle}>趨勢圖</Text>
          </View>
          <View style={s.card}>
            <TrendChart
              series={chartSeries}
              unit={type === 'blood_pressure' ? 'mmHg' : 'mg/dL'}
              abnormalZone={bpAbnormalZone}
              height={200}
            />
          </View>

          {/* KPI */}
          <View style={s.kpiRow}>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>總筆數</Text>
              <Text style={s.kpiValue}>{stats.count}</Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>需留意</Text>
              <Text style={[s.kpiValue, stats.abnormal_count > 0 && { color: colors.warning }]}>
                {stats.abnormal_count}
              </Text>
            </View>
          </View>

          {/* Averages */}
          <View style={s.sectionHeader}>
            <IconStats />
            <Text style={s.sectionTitle}>平均數值</Text>
          </View>
          {stats.type === 'blood_pressure' && stats.systolic && stats.diastolic ? (
            <View style={s.avgRow}>
              <View style={s.avgCard}>
                <Text style={s.avgLabel}>收縮壓</Text>
                <Text style={s.avgValue}>{Math.round(stats.systolic.avg)}</Text>
                <Text style={s.avgRange}>{stats.systolic.min}–{stats.systolic.max} mmHg</Text>
              </View>
              <View style={s.avgCard}>
                <Text style={s.avgLabel}>舒張壓</Text>
                <Text style={s.avgValue}>{Math.round(stats.diastolic.avg)}</Text>
                <Text style={s.avgRange}>{stats.diastolic.min}–{stats.diastolic.max} mmHg</Text>
              </View>
            </View>
          ) : stats.type === 'blood_glucose' && stats.glucose_value ? (
            <View style={[s.card, { alignItems: 'center', paddingVertical: spacing.lg }]}>
              <Text style={s.avgLabel}>血糖</Text>
              <Text style={s.avgValue}>{Math.round(stats.glucose_value.avg)}</Text>
              <Text style={s.avgRange}>{stats.glucose_value.min}–{stats.glucose_value.max} mg/dL</Text>
            </View>
          ) : null}

          {/* Daily timeline */}
          <View style={s.sectionHeader}>
            <IconCalendar />
            <Text style={s.sectionTitle}>每日紀錄</Text>
          </View>
          <View style={s.timelineCard}>
            {stats.daily_data.map((d, idx) => {
              const isLast = idx === stats.daily_data.length - 1;
              const dotColor = d.is_abnormal ? colors.danger : colors.primary;
              const value = stats.type === 'blood_pressure' && 'systolic_avg' in d
                ? `${d.systolic_avg ?? '—'}/${d.diastolic_avg ?? '—'}`
                : 'glucose_avg' in d ? `${d.glucose_avg ?? '—'}` : '—';
              return (
                <View key={d.date} style={s.timelineRow}>
                  <View style={s.timelineLeft}>
                    <View style={[s.timelineDot, { backgroundColor: dotColor }]} />
                    {!isLast && <View style={s.timelineLine} />}
                  </View>
                  <View style={[s.timelineContent, isLast && { paddingBottom: 0 }]}>
                    <View style={s.timelineTopRow}>
                      <Text style={s.timelineDate}>{d.date.slice(5).replace('-', '/')}</Text>
                      {d.is_abnormal && (
                        <View style={s.alertTag}><Text style={s.alertTagText}>需留意</Text></View>
                      )}
                    </View>
                    <View style={s.timelineValueRow}>
                      <Text style={[s.timelineValue, d.is_abnormal && { color: colors.danger }]}>{value}</Text>
                      <Text style={s.timelineCount}>{d.count} 筆</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
      <View style={{ height: spacing['3xl'] }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['3xl'] },

  // ─── Hero ─────────────────────────────────────────────────
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(46,141,201,0.12)',
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
  heroBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning },
  heroBadgeText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // ─── Chips (unified pill style, navy active) ─────────────
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleChip: {
    flex: 1,
    paddingVertical: spacing.sm + spacing.xxs,
    borderRadius: radius.full,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderDefault,
    alignItems: 'center',
  },
  periodChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderDefault,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  toggleText: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  periodText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.primaryText, fontWeight: '700' },

  // ─── Section header ──────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingLeft: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },

  // ─── Card ────────────────────────────────────────────────
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
  },

  // ─── KPI Row ─────────────────────────────────────────────
  kpiRow: { flexDirection: 'row', gap: spacing.sm },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    marginBottom: spacing.xxs,
  },
  kpiValue: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // ─── Averages ────────────────────────────────────────────
  avgRow: { flexDirection: 'row', gap: spacing.sm },
  avgCard: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.md + 2,
    alignItems: 'center',
  },
  avgLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
    marginBottom: spacing.xxs,
  },
  avgValue: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  avgRange: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginTop: spacing.xxs,
  },

  // ─── Timeline ────────────────────────────────────────────
  timelineCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 50,
  },
  timelineLeft: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10, height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.borderDefault,
    marginTop: 2,
    marginBottom: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.md,
    gap: 2,
  },
  timelineTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timelineDate: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  timelineValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  timelineValue: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timelineCount: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
  },
  alertTag: {
    backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  alertTagText: { fontSize: 10, fontWeight: '600', color: colors.danger },
});
