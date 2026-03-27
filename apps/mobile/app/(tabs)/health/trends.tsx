import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
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

// ─── Chart Colors (aligned with visual-direction-v1.md Part 8) ──

const CHART_COLORS = {
  systolic: colors.primary,       // #2563EB
  diastolic: '#60A5FA',           // lighter blue per spec
} as const;

// ─── Helpers ──────────────────────────────────────────────────

/** Format date string to MM/DD for chart x-axis */
function toChartLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parts[1]}/${parts[2]}`;
}

/** Build chart series from BP stats daily_data */
function buildBpSeries(data: BpStats['daily_data']): ChartSeries[] {
  return [
    {
      name: '收縮壓',
      color: CHART_COLORS.systolic,
      data: data.map((d) => ({
        label: toChartLabel(d.date),
        value: d.systolic_avg,
        isAbnormal: d.is_abnormal,
      })),
    },
    {
      name: '舒張壓',
      color: CHART_COLORS.diastolic,
      data: data.map((d) => ({
        label: toChartLabel(d.date),
        value: d.diastolic_avg,
        isAbnormal: d.is_abnormal,
      })),
    },
  ];
}

/** Build chart series from BG stats daily_data */
function buildBgSeries(data: BgStats['daily_data']): ChartSeries[] {
  return [
    {
      name: '血糖',
      color: CHART_COLORS.systolic,
      data: data.map((d) => ({
        label: toChartLabel(d.date),
        value: d.glucose_avg,
        isAbnormal: d.is_abnormal,
      })),
    },
  ];
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

  // Build chart data from stats
  const chartSeries: ChartSeries[] = stats
    ? stats.type === 'blood_pressure'
      ? buildBpSeries(stats.daily_data)
      : buildBgSeries(stats.daily_data)
    : [];

  // Abnormal zone for BP chart (systolic HIGH threshold)
  const bpAbnormalZone = type === 'blood_pressure'
    ? { low: BP_THRESHOLDS.SYSTOLIC.NORMAL_HIGH, high: BP_THRESHOLDS.SYSTOLIC.HIGH + 20 }
    : undefined;

  return (
    <ScrollView style={styles.container}>
      {/* ── Header Zone ──────────────────────────────────────── */}
      <View style={styles.headerZone}>
        <Text style={styles.title}>趨勢分析</Text>

        {/* Type toggle */}
        <View style={styles.toggleRow}>
          {(['blood_pressure', 'blood_glucose'] as const).map((t) => {
            const active = type === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.toggleChip, active && styles.toggleChipActive]}
                onPress={() => setType(t)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                  {t === 'blood_pressure' ? '血壓' : '血糖'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Period toggle */}
        <View style={styles.periodRow}>
          {(['7d', '30d'] as const).map((p) => {
            const active = period === p;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.periodChip, active && styles.periodChipActive]}
                onPress={() => setPeriod(p)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.periodText, active && styles.periodTextActive]}>
                  {p === '7d' ? '7 天' : '30 天'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Content ──────────────────────────────────────────── */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>載入中...</Text>
          </View>
        ) : error ? (
          <ErrorState message={error} onRetry={() => void fetchStats()} />
        ) : !stats || stats.count === 0 ? (
          <EmptyState
            title="尚無量測資料"
            description="記錄健康數據後，即可在此查看趨勢。"
          />
        ) : (
          <>
            {/* ── Trend Chart ──────────────────────────────── */}
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>
                {type === 'blood_pressure' ? '血壓趨勢' : '血糖趨勢'}
              </Text>
              <TrendChart
                series={chartSeries}
                unit={type === 'blood_pressure' ? 'mmHg' : 'mg/dL'}
                abnormalZone={bpAbnormalZone}
                height={200}
              />
            </Card>

            {/* ── KPI Summary ─────────────────────────────── */}
            <Card style={styles.kpiCard}>
              <View style={styles.kpiRow}>
                <View style={styles.kpiItem}>
                  <Text style={styles.kpiValue}>{stats.count}</Text>
                  <Text style={styles.kpiLabel}>總筆數</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpiItem}>
                  <Text style={[
                    styles.kpiValue,
                    stats.abnormal_count > 0 && styles.kpiValueWarn,
                  ]}>
                    {stats.abnormal_count}
                  </Text>
                  <Text style={styles.kpiLabel}>需留意</Text>
                </View>
              </View>
            </Card>

            {/* ── Averages ────────────────────────────────── */}
            {stats.type === 'blood_pressure' && stats.systolic && stats.diastolic && (
              <View style={styles.avgRow}>
                <Card style={styles.avgCard}>
                  <Text style={styles.avgLabel}>收縮壓平均</Text>
                  <Text style={styles.avgValue}>{Math.round(stats.systolic.avg)}</Text>
                  <Text style={styles.avgRange}>{stats.systolic.min}–{stats.systolic.max} mmHg</Text>
                </Card>
                <Card style={styles.avgCard}>
                  <Text style={styles.avgLabel}>舒張壓平均</Text>
                  <Text style={styles.avgValue}>{Math.round(stats.diastolic.avg)}</Text>
                  <Text style={styles.avgRange}>{stats.diastolic.min}–{stats.diastolic.max} mmHg</Text>
                </Card>
              </View>
            )}

            {stats.type === 'blood_glucose' && stats.glucose_value && (
              <Card style={styles.avgCardFull}>
                <Text style={styles.avgLabel}>血糖平均</Text>
                <Text style={styles.avgValue}>{Math.round(stats.glucose_value.avg)}</Text>
                <Text style={styles.avgRange}>{stats.glucose_value.min}–{stats.glucose_value.max} mg/dL</Text>
              </Card>
            )}

            {/* ── Daily Records ───────────────────────────── */}
            <Text style={styles.sectionLabel}>每日紀錄</Text>
            {stats.daily_data.map((d) => (
              <Card
                key={d.date}
                style={[styles.dailyCard, d.is_abnormal && styles.dailyCardAlert]}
              >
                <View style={styles.dailyMain}>
                  <View style={styles.dailyLeft}>
                    <View style={[
                      styles.dailyDot,
                      { backgroundColor: d.is_abnormal ? colors.danger : colors.primary },
                    ]} />
                    <Text style={styles.dailyDate}>{d.date.slice(5)}</Text>
                  </View>
                  <Text style={styles.dailyValue}>
                    {stats.type === 'blood_pressure' && 'systolic_avg' in d
                      ? `${d.systolic_avg}/${d.diastolic_avg}`
                      : 'glucose_avg' in d ? `${d.glucose_avg}` : '—'}
                  </Text>
                  <Text style={styles.dailyCount}>{d.count} 筆</Text>
                </View>
              </Card>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  headerZone: {
    backgroundColor: colors.bgSurface,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    ...shadows.low,
  },
  title: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  content: { padding: spacing.lg },
  center: { alignItems: 'center', paddingVertical: spacing['3xl'], gap: spacing.sm },
  loadingText: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary },

  // ─── Toggles ──────────────────────────────────────────────
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  toggleChip: {
    flex: 1,
    paddingVertical: spacing.sm + spacing.xxs,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSurfaceAlt,
    alignItems: 'center',
  },
  toggleChipActive: { backgroundColor: colors.primaryLight },
  toggleText: { fontSize: typography.bodyMd.fontSize, fontWeight: '600', color: colors.textTertiary },
  toggleTextActive: { color: colors.primaryText },

  periodRow: { flexDirection: 'row', gap: spacing.sm },
  periodChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
  },
  periodChipActive: { borderColor: colors.primaryText, backgroundColor: colors.primaryLight },
  periodText: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary },
  periodTextActive: { color: colors.primaryText, fontWeight: '600' },

  // ─── Chart Card ───────────────────────────────────────────
  chartCard: { marginBottom: spacing.md, padding: spacing.lg },
  chartTitle: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  // ─── KPI Card ─────────────────────────────────────────────
  kpiCard: { marginBottom: spacing.md, padding: spacing.md },
  kpiRow: { flexDirection: 'row', alignItems: 'center' },
  kpiItem: { flex: 1, alignItems: 'center' },
  kpiValue: { fontSize: typography.headingXl.fontSize, fontWeight: '700', color: colors.textPrimary },
  kpiValueWarn: { color: colors.warning },
  kpiLabel: { fontSize: typography.captionSm.fontSize, color: colors.textTertiary, marginTop: spacing.xxs },
  kpiDivider: { width: 1, height: 28, backgroundColor: colors.borderDefault },

  // ─── Average Cards ────────────────────────────────────────
  avgRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  avgCard: { flex: 1, padding: spacing.md, alignItems: 'center' },
  avgCardFull: { padding: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  avgLabel: { fontSize: typography.captionSm.fontSize, color: colors.textTertiary, fontWeight: '500', marginBottom: spacing.xxs },
  avgValue: { fontSize: typography.headingLg.fontSize, fontWeight: '700', color: colors.textPrimary },
  avgRange: { fontSize: typography.captionSm.fontSize, color: colors.textDisabled, marginTop: spacing.xxs },

  // ─── Section Label ────────────────────────────────────────
  sectionLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

  // ─── Daily Cards ──────────────────────────────────────────
  dailyCard: { marginBottom: spacing.sm, padding: spacing.md },
  dailyCardAlert: { borderColor: colors.dangerLight },
  dailyMain: { flexDirection: 'row', alignItems: 'center' },
  dailyLeft: { flexDirection: 'row', alignItems: 'center', width: 80, gap: spacing.sm },
  dailyDot: { width: 6, height: 6, borderRadius: 3 },
  dailyDate: { fontSize: typography.bodySm.fontSize, color: colors.textSecondary },
  dailyValue: { flex: 1, fontSize: typography.headingSm.fontSize, fontWeight: '700', color: colors.textPrimary },
  dailyCount: { fontSize: typography.caption.fontSize, color: colors.textDisabled },
});
