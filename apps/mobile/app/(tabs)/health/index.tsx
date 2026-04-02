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
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { TrendChart, type ChartSeries } from '@/components/ui/TrendChart';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
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

// ─── Accent Colors ───────────────────────────────────────────

const METRIC_ACCENTS = {
  bp: { text: '#E8707E', bg: '#FFF2F4' },
  bg: { text: '#E8A44E', bg: '#FFF8EF' },
  count: { text: '#5BB98B', bg: '#F0F9F3' },
} as const;

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

// ─── Component ────────────────────────────────────────────────

export default function HealthScreen() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      <View style={styles.center}>
        <ErrorState message={error} onRetry={() => void fetchRecipients()} />
      </View>
    );
  }

  // ─── Main Render ──────────────────────────────────────────

  return (
    <View style={styles.container}>
      <FlatList
        data={loading ? [] : measurements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onRefresh={() => { void fetchMeasurements(); void fetchStats(); }}
        refreshing={loading}
        ListHeaderComponent={
          <>
            {/* ── Recipient Switcher ─────────────── */}
            {recipients.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll} contentContainerStyle={styles.switcherContent}>
                {recipients.map((r) => {
                  const isActive = r.id === selectedRecipientId;
                  return (
                    <TouchableOpacity key={r.id} style={[styles.switcherChip, isActive && styles.switcherChipActive]} onPress={() => setSelectedRecipientId(r.id)} activeOpacity={0.7}>
                      <Text style={[styles.switcherText, isActive && styles.switcherTextActive]}>{r.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* ── Bento Summary Cards ────────────── */}
            <View style={styles.bentoRow}>
              <TouchableOpacity style={[styles.bentoCard, { backgroundColor: METRIC_ACCENTS.bp.bg }]} onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${selectedRecipientId}&type=blood_pressure`)} activeOpacity={0.7}>
                <Text style={[styles.bentoLabel, { color: METRIC_ACCENTS.bp.text }]}>血壓</Text>
                <Text style={[styles.bentoValue, { color: METRIC_ACCENTS.bp.text }]}>{latestBP ? `${latestBP.systolic}/${latestBP.diastolic}` : '--'}</Text>
                <Text style={styles.bentoAction}>記錄 →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bentoCard, { backgroundColor: METRIC_ACCENTS.bg.bg }]} onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${selectedRecipientId}&type=blood_glucose`)} activeOpacity={0.7}>
                <Text style={[styles.bentoLabel, { color: METRIC_ACCENTS.bg.text }]}>血糖</Text>
                <Text style={[styles.bentoValue, { color: METRIC_ACCENTS.bg.text }]}>{latestBG ? `${latestBG.glucose_value}` : '--'}</Text>
                <Text style={styles.bentoAction}>記錄 →</Text>
              </TouchableOpacity>
              <View style={[styles.bentoCard, { backgroundColor: METRIC_ACCENTS.count.bg }]}>
                <Text style={[styles.bentoLabel, { color: METRIC_ACCENTS.count.text }]}>紀錄</Text>
                <Text style={[styles.bentoValue, { color: METRIC_ACCENTS.count.text }]}>{measurements.length}</Text>
                <Text style={styles.bentoUnit}>筆</Text>
              </View>
            </View>

            {/* ── Trend Section ───────────────────── */}
            <View style={styles.trendCard}>
              {/* Type + Period toggles in one row */}
              <View style={styles.trendControls}>
                <View style={styles.toggleRow}>
                  {(['blood_pressure', 'blood_glucose'] as const).map((t) => {
                    const active = trendType === t;
                    return (
                      <TouchableOpacity key={t} style={[styles.toggleChip, active && styles.toggleChipActive]} onPress={() => setTrendType(t)} activeOpacity={0.7}>
                        <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{t === 'blood_pressure' ? '血壓' : '血糖'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.periodRow}>
                  {(['7d', '30d'] as const).map((p) => {
                    const active = trendPeriod === p;
                    return (
                      <TouchableOpacity key={p} style={[styles.periodChip, active && styles.periodChipActive]} onPress={() => setTrendPeriod(p)} activeOpacity={0.7}>
                        <Text style={[styles.periodText, active && styles.periodTextActive]}>{p === '7d' ? '7天' : '30天'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Chart */}
              {statsLoading ? (
                <View style={styles.chartLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : stats && stats.count > 0 ? (
                <>
                  <TrendChart series={chartSeries} unit={trendType === 'blood_pressure' ? 'mmHg' : 'mg/dL'} abnormalZone={bpAbnormalZone} height={160} />
                  {/* Compact average cards */}
                  {stats.type === 'blood_pressure' && stats.systolic && stats.diastolic && (
                    <View style={styles.avgRow}>
                      <View style={styles.avgItem}>
                        <Text style={styles.avgLabel}>收縮壓均值</Text>
                        <Text style={styles.avgValue}>{Math.round(stats.systolic.avg)}</Text>
                        <Text style={styles.avgRange}>{stats.systolic.min}–{stats.systolic.max}</Text>
                      </View>
                      <View style={styles.avgDivider} />
                      <View style={styles.avgItem}>
                        <Text style={styles.avgLabel}>舒張壓均值</Text>
                        <Text style={styles.avgValue}>{Math.round(stats.diastolic.avg)}</Text>
                        <Text style={styles.avgRange}>{stats.diastolic.min}–{stats.diastolic.max}</Text>
                      </View>
                      <View style={styles.avgDivider} />
                      <View style={styles.avgItem}>
                        <Text style={styles.avgLabel}>需留意</Text>
                        <Text style={[styles.avgValue, stats.abnormal_count > 0 && { color: colors.warning }]}>{stats.abnormal_count}</Text>
                        <Text style={styles.avgRange}>筆</Text>
                      </View>
                    </View>
                  )}
                  {stats.type === 'blood_glucose' && stats.glucose_value && (
                    <View style={styles.avgRow}>
                      <View style={styles.avgItem}>
                        <Text style={styles.avgLabel}>血糖均值</Text>
                        <Text style={styles.avgValue}>{Math.round(stats.glucose_value.avg)}</Text>
                        <Text style={styles.avgRange}>{stats.glucose_value.min}–{stats.glucose_value.max}</Text>
                      </View>
                      <View style={styles.avgDivider} />
                      <View style={styles.avgItem}>
                        <Text style={styles.avgLabel}>需留意</Text>
                        <Text style={[styles.avgValue, stats.abnormal_count > 0 && { color: colors.warning }]}>{stats.abnormal_count}</Text>
                        <Text style={styles.avgRange}>筆</Text>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.chartEmpty}>
                  <Text style={styles.chartEmptyText}>尚無趨勢資料</Text>
                </View>
              )}
            </View>

            {/* ── Quick Link: Export ───────────────── */}
            <TouchableOpacity style={styles.exportLink} onPress={() => router.push('/(tabs)/health/export')} activeOpacity={0.7}>
              <Text style={styles.exportLinkText}>匯出健康紀錄 →</Text>
            </TouchableOpacity>

            {/* ── Section Label ───────────────────── */}
            {measurements.length > 0 && (
              <Text style={styles.sectionLabel}>近期紀錄</Text>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerInline}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>載入中...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerInline}>
              <ErrorState message={error} onRetry={() => void fetchMeasurements()} />
            </View>
          ) : (
            <EmptyState
              title="尚無量測紀錄"
              description="定期記錄血壓與血糖，有助於掌握健康狀況。"
              actionLabel="開始記錄"
              onAction={() => router.push(`/(tabs)/health/add-measurement?recipientId=${selectedRecipientId}&type=blood_pressure`)}
            />
          )
        }
        renderItem={({ item }) => {
          const isBP = item.type === 'blood_pressure';
          return (
            <View style={[styles.measureCard, item.is_abnormal ? styles.measureCardAlert : styles.measureCardNormal]}>
              <View style={styles.cardLeft}>
                <View style={styles.cardTypeRow}>
                  <View style={[styles.typeDot, { backgroundColor: item.is_abnormal ? colors.danger : colors.primary }]} />
                  <Text style={styles.cardType}>{isBP ? '血壓' : '血糖'}</Text>
                  {item.is_abnormal && (
                    <View style={styles.alertTag}><Text style={styles.alertTagText}>需留意</Text></View>
                  )}
                </View>
                <View style={styles.cardValueRow}>
                  <Text style={[styles.cardValue, item.is_abnormal && { color: colors.danger }]}>
                    {isBP ? `${item.systolic}/${item.diastolic}` : `${item.glucose_value}`}
                  </Text>
                  <Text style={styles.cardUnit}>{isBP ? 'mmHg' : 'mg/dL'}</Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardTime}>{formatTime(item.measured_at)}</Text>
                {!isBP && item.glucose_timing && (
                  <Text style={styles.cardTiming}>{formatTiming(item.glucose_timing)}</Text>
                )}
              </View>
            </View>
          );
        }}
        ListFooterComponent={<View style={{ height: 80 }} />}
      />

      {/* ── FAB ──────────────────────────────── */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${selectedRecipientId}&type=blood_pressure`)} activeOpacity={0.85} accessibilityLabel="記錄量測">
        <Text style={styles.fabText}>＋ 記錄</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  centerInline: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['3xl'] },
  loadingText: { marginTop: spacing.sm, fontSize: typography.bodySm.fontSize, color: colors.textTertiary },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  // ─── Recipient Switcher ─────────────────────────────────
  switcherScroll: { maxHeight: 44, marginBottom: spacing.md, marginHorizontal: -spacing.lg },
  switcherContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  switcherChip: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2, borderRadius: radius.full, backgroundColor: colors.bgSurfaceAlt },
  switcherChipActive: { backgroundColor: colors.primary },
  switcherText: { fontSize: typography.bodyMd.fontSize, color: colors.textTertiary, fontWeight: '600' },
  switcherTextActive: { color: colors.white, fontWeight: '700' },

  // ─── Bento Summary Cards ───────────────────────────────
  bentoRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  bentoCard: { flex: 1, borderRadius: radius.xl, padding: spacing.md, ...shadows.low },
  bentoLabel: { fontSize: typography.captionSm.fontSize, fontWeight: '600' },
  bentoValue: { fontSize: 22, fontWeight: '700', marginTop: spacing.xs },
  bentoAction: { fontSize: 10, color: colors.textTertiary, fontWeight: '600', marginTop: spacing.sm },
  bentoUnit: { fontSize: 10, color: colors.textTertiary, marginTop: spacing.sm },

  // ─── Trend Card ─────────────────────────────────────────
  trendCard: {
    backgroundColor: colors.bgSurface, borderRadius: radius.xl,
    padding: spacing.md, marginBottom: spacing.sm, ...shadows.low,
  },
  trendControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  toggleRow: { flexDirection: 'row', gap: spacing.xs },
  toggleChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, backgroundColor: colors.bgSurfaceAlt },
  toggleChipActive: { backgroundColor: colors.primaryLight },
  toggleText: { fontSize: typography.captionSm.fontSize, fontWeight: '600', color: colors.textTertiary },
  toggleTextActive: { color: colors.primaryText },
  periodRow: { flexDirection: 'row', gap: spacing.xs },
  periodChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderDefault },
  periodChipActive: { borderColor: colors.primaryText, backgroundColor: colors.primaryLight },
  periodText: { fontSize: typography.captionSm.fontSize, color: colors.textTertiary },
  periodTextActive: { color: colors.primaryText, fontWeight: '600' },
  chartLoading: { height: 160, alignItems: 'center', justifyContent: 'center' },
  chartEmpty: { height: 100, alignItems: 'center', justifyContent: 'center' },
  chartEmptyText: { fontSize: typography.bodySm.fontSize, color: colors.textDisabled },

  // ─── Average Row ────────────────────────────────────────
  avgRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderDefault },
  avgItem: { flex: 1, alignItems: 'center' },
  avgDivider: { width: 1, height: 28, backgroundColor: colors.borderDefault },
  avgLabel: { fontSize: 10, color: colors.textDisabled, fontWeight: '500', marginBottom: spacing.xxs },
  avgValue: { fontSize: typography.headingSm.fontSize, fontWeight: '700', color: colors.textPrimary },
  avgRange: { fontSize: 10, color: colors.textDisabled, marginTop: 1 },

  // ─── Export Link ────────────────────────────────────────
  exportLink: { alignSelf: 'flex-end', paddingVertical: spacing.xs, marginBottom: spacing.md },
  exportLinkText: { fontSize: typography.bodySm.fontSize, color: colors.primaryText, fontWeight: '600' },

  // ─── Section Label ──────────────────────────────────────
  sectionLabel: { fontSize: typography.bodySm.fontSize, fontWeight: '600', color: colors.textTertiary, marginBottom: spacing.sm },

  // ─── Measurement Card ──────────────────────────────────
  measureCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bgSurface, borderRadius: radius.lg, padding: spacing.md, marginBottom: 6, ...shadows.low,
  },
  measureCardNormal: { borderLeftWidth: 3, borderLeftColor: colors.primaryLight },
  measureCardAlert: { backgroundColor: colors.statusTintConsultDoctor, borderLeftWidth: 3, borderLeftColor: colors.danger },
  cardLeft: { flex: 1 },
  cardTypeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xxs },
  typeDot: { width: 6, height: 6, borderRadius: 3 },
  cardType: { fontSize: typography.captionSm.fontSize, fontWeight: '500', color: colors.textTertiary },
  alertTag: { backgroundColor: colors.dangerLight, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.full },
  alertTagText: { fontSize: 9, fontWeight: '600', color: colors.danger },
  cardValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  cardValue: { fontSize: typography.headingMd.fontSize, fontWeight: '700', color: colors.textPrimary },
  cardUnit: { fontSize: typography.captionSm.fontSize, fontWeight: '400', color: colors.textDisabled },
  cardRight: { alignItems: 'flex-end' },
  cardTime: { fontSize: typography.captionSm.fontSize, color: colors.textDisabled },
  cardTiming: { fontSize: typography.captionSm.fontSize, color: colors.textTertiary, fontWeight: '500', marginTop: 1 },

  // ─── FAB ────────────────────────────────────────────────
  fab: { position: 'absolute', bottom: spacing['2xl'], right: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, ...shadows.high },
  fabText: { color: colors.white, fontSize: typography.bodyMd.fontSize, fontWeight: '700' },
});
