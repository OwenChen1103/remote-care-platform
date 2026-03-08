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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>趨勢圖表</Text>

      {/* Type toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, type === 'blood_pressure' && styles.toggleActive]}
          onPress={() => setType('blood_pressure')}
        >
          <Text style={[styles.toggleText, type === 'blood_pressure' && styles.toggleTextActive]}>血壓</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, type === 'blood_glucose' && styles.toggleActive]}
          onPress={() => setType('blood_glucose')}
        >
          <Text style={[styles.toggleText, type === 'blood_glucose' && styles.toggleTextActive]}>血糖</Text>
        </TouchableOpacity>
      </View>

      {/* Period toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.periodButton, period === '7d' && styles.periodActive]}
          onPress={() => setPeriod('7d')}
        >
          <Text style={[styles.periodText, period === '7d' && styles.periodTextActive]}>7 天</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, period === '30d' && styles.periodActive]}
          onPress={() => setPeriod('30d')}
        >
          <Text style={[styles.periodText, period === '30d' && styles.periodTextActive]}>30 天</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !stats || stats.count === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>尚無量測資料，請先記錄健康數據。</Text>
        </View>
      ) : (
        <>
          {/* Stats cards */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>筆數</Text>
              <Text style={styles.statValue}>{stats.count}</Text>
            </View>
            <View style={[styles.statCard, styles.statCardDanger]}>
              <Text style={styles.statLabel}>異常</Text>
              <Text style={[styles.statValue, stats.abnormal_count > 0 && styles.statValueDanger]}>
                {stats.abnormal_count}
              </Text>
            </View>
          </View>

          {stats.type === 'blood_pressure' && stats.systolic && stats.diastolic ? (
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>收縮壓</Text>
                <Text style={styles.statValue}>{stats.systolic.avg}</Text>
                <Text style={styles.statRange}>{stats.systolic.min}-{stats.systolic.max}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>舒張壓</Text>
                <Text style={styles.statValue}>{stats.diastolic.avg}</Text>
                <Text style={styles.statRange}>{stats.diastolic.min}-{stats.diastolic.max}</Text>
              </View>
            </View>
          ) : null}

          {stats.type === 'blood_glucose' && stats.glucose_value ? (
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>平均血糖</Text>
                <Text style={styles.statValue}>{stats.glucose_value.avg}</Text>
                <Text style={styles.statRange}>{stats.glucose_value.min}-{stats.glucose_value.max} mg/dL</Text>
              </View>
            </View>
          ) : null}

          {/* Daily data table */}
          <Text style={styles.sectionTitle}>每日紀錄</Text>
          {stats.daily_data.map((d) => (
            <View key={d.date} style={[styles.dailyRow, d.is_abnormal && styles.dailyRowAbnormal]}>
              <Text style={styles.dailyDate}>{d.date}</Text>
              <Text style={styles.dailyValue}>
                {stats.type === 'blood_pressure' && 'systolic_avg' in d
                  ? `${d.systolic_avg}/${d.diastolic_avg}`
                  : 'glucose_avg' in d ? `${d.glucose_avg} mg/dL` : '-'}
              </Text>
              <Text style={styles.dailyCount}>{d.count} 筆</Text>
              {d.is_abnormal && <Text style={styles.abnormalDot}>!</Text>}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 },
  toggleRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  toggleButton: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#e5e7eb', alignItems: 'center',
  },
  toggleActive: { backgroundColor: '#3b82f6' },
  toggleText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  toggleTextActive: { color: '#fff' },
  periodButton: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center',
  },
  periodActive: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  periodText: { fontSize: 14, color: '#6b7280' },
  periodTextActive: { color: '#1d4ed8', fontWeight: '600' },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 14, alignItems: 'center',
  },
  statCardDanger: {},
  statLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '700', color: '#1f2937' },
  statValueDanger: { color: '#dc2626' },
  statRange: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 8 },
  dailyRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 4, gap: 8,
  },
  dailyRowAbnormal: { borderLeftWidth: 3, borderLeftColor: '#dc2626' },
  dailyDate: { fontSize: 14, color: '#374151', width: 90 },
  dailyValue: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1f2937' },
  dailyCount: { fontSize: 12, color: '#9ca3af' },
  abnormalDot: {
    fontSize: 14, fontWeight: 'bold', color: '#dc2626',
    backgroundColor: '#fef2f2', width: 22, height: 22, textAlign: 'center', lineHeight: 22, borderRadius: 11,
  },
  emptyText: { fontSize: 16, color: '#9ca3af', textAlign: 'center' },
  errorText: { fontSize: 16, color: '#dc2626' },
});
