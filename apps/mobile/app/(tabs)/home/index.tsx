import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

// ─── Types ────────────────────────────────────────────────────

interface Recipient {
  id: string;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
  medical_tags: string[];
  created_at: string;
}

interface LatestReport {
  id: string;
  status_label: string;
  summary: string;
  generated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

const STATUS_DISPLAY: Record<string, { dot: string; bg: string; label: string }> = {
  stable: { dot: '#22c55e', bg: '#f0fdf4', label: '狀況穩定' },
  attention: { dot: '#eab308', bg: '#fefce8', label: '需注意' },
  consult_doctor: { dot: '#ef4444', bg: '#fef2f2', label: '建議就醫' },
};

const DEFAULT_STATUS_DISPLAY = { dot: '#22c55e', bg: '#f0fdf4', label: '狀況穩定' };

function formatReportDate(dateStr: string): string {
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

// ─── Component ────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [latestReports, setLatestReports] = useState<Record<string, LatestReport>>({});
  const [reportsLoading, setReportsLoading] = useState(false);

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<Recipient[]>('/recipients');
      setRecipients(result);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('載入失敗，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch latest health_summary for each recipient (parallel, lightweight)
  const fetchLatestReports = useCallback(async (recipientList: Recipient[]) => {
    if (recipientList.length === 0) return;
    setReportsLoading(true);
    const results: Record<string, LatestReport> = {};

    await Promise.all(
      recipientList.map(async (r) => {
        try {
          const reports = await api.get<LatestReport[]>(
            `/ai/reports?recipient_id=${r.id}&report_type=health_summary&limit=1`,
          );
          const first = reports[0];
          if (first) {
            results[r.id] = first;
          }
        } catch {
          // Non-critical — card will show "尚未生成" state
        }
      }),
    );

    setLatestReports(results);
    setReportsLoading(false);
  }, []);

  useEffect(() => {
    void fetchRecipients();
  }, [fetchRecipients]);

  useEffect(() => {
    if (recipients.length > 0) {
      void fetchLatestReports(recipients);
    }
  }, [recipients, fetchLatestReports]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void fetchRecipients()}>
          <Text style={styles.retryText}>重試</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutButton} onPress={() => { void logout().then(() => router.replace('/(auth)/login')); }}>
          <Text style={styles.logoutText}>登出</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>你好，{user?.name ?? ''}！</Text>
          {recipients.length > 0 && (
            <Text style={styles.sectionHint}>今日家人安心報</Text>
          )}
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={() => { void logout().then(() => router.replace('/(auth)/login')); }}>
          <Text style={styles.logoutText}>登出</Text>
        </TouchableOpacity>
      </View>

      {recipients.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>尚無被照護者，請點擊右下角新增。</Text>
        </View>
      ) : (
        <FlatList
          data={recipients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const report = latestReports[item.id];
            const status = report
              ? (STATUS_DISPLAY[report.status_label] ?? DEFAULT_STATUS_DISPLAY)
              : null;

            return (
              <View style={styles.card}>
                {/* Header: name + age → tap to recipient detail */}
                <TouchableOpacity
                  style={styles.cardHeaderTouchable}
                  onPress={() => router.push(`/(tabs)/home/${item.id}`)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    {item.date_of_birth && (
                      <Text style={styles.cardAge}>{calculateAge(item.date_of_birth)} 歲</Text>
                    )}
                    <Text style={styles.cardDetailArrow}>›</Text>
                  </View>
                  {item.medical_tags.length > 0 && (
                    <View style={styles.tagsRow}>
                      {item.medical_tags.map((tag) => (
                        <View key={tag} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.cardDivider} />

                {/* AI summary section */}
                {reportsLoading && !report ? (
                  <View style={styles.summaryLoading}>
                    <ActivityIndicator size="small" color="#9ca3af" />
                    <Text style={styles.summaryLoadingText}>載入近況中...</Text>
                  </View>
                ) : report && status ? (
                  <TouchableOpacity
                    style={styles.summarySection}
                    onPress={() => router.push('/(tabs)/ai')}
                  >
                    <View style={[styles.statusRow, { backgroundColor: status.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
                      <Text style={[styles.statusLabel, { color: status.dot }]}>{status.label}</Text>
                      <Text style={styles.reportDate}>{formatReportDate(report.generated_at)}</Text>
                    </View>
                    <Text style={styles.summaryText} numberOfLines={2}>
                      {report.summary}
                    </Text>
                    <Text style={styles.viewDetail}>查看安心報 ›</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.summarySection}
                    onPress={() => router.push('/(tabs)/ai')}
                  >
                    <Text style={styles.noReportText}>尚未生成安心報</Text>
                    <Text style={styles.viewDetail}>前往查看 ›</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/home/add-recipient')}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    paddingRight: 16,
    paddingTop: 8,
  },
  welcome: { fontSize: 18, fontWeight: '600', color: '#1f2937', paddingHorizontal: 16, paddingTop: 8 },
  sectionHint: { fontSize: 13, color: '#6b7280', paddingHorizontal: 16, paddingTop: 2, paddingBottom: 4 },
  logoutButton: { backgroundColor: '#ef4444', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, marginTop: 10 },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  list: { padding: 16, paddingTop: 8 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  cardHeaderTouchable: { padding: 16, paddingBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardName: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  cardAge: { fontSize: 14, color: '#6b7280', marginLeft: 8 },
  cardDetailArrow: { fontSize: 18, color: '#9ca3af', marginLeft: 'auto' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { backgroundColor: '#dbeafe', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 12, color: '#1d4ed8' },

  cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e7eb', marginHorizontal: 16 },

  summarySection: { padding: 16, paddingTop: 0 },
  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: -16,
    marginBottom: 8,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  statusLabel: { fontSize: 14, fontWeight: '700' },
  reportDate: { fontSize: 11, color: '#9ca3af', marginLeft: 'auto' },
  summaryText: { fontSize: 14, color: '#4b5563', lineHeight: 21 },
  viewDetail: { fontSize: 13, color: '#3b82f6', fontWeight: '500', marginTop: 8 },

  summaryLoading: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 12, gap: 8 },
  summaryLoadingText: { fontSize: 13, color: '#9ca3af' },

  noReportText: { fontSize: 14, color: '#9ca3af', marginBottom: 4 },

  emptyText: { fontSize: 16, color: '#9ca3af', textAlign: 'center' },
  errorText: { fontSize: 14, color: '#dc2626', backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, textAlign: 'center', marginBottom: 12, overflow: 'hidden' },
  retryButton: { backgroundColor: '#3b82f6', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
});
