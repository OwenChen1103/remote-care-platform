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
import { colors, typography, spacing, radius } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { GLUCOSE_TIMING_DISPLAY } from '@remote-care/shared';

// ─── Types ────────────────────────────────────────────────────

interface Recipient {
  id: string;
  name: string;
}

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

// ─── Helpers ──────────────────────────────────────────────────

function formatTiming(timing: string | null): string {
  if (!timing) return '';
  return GLUCOSE_TIMING_DISPLAY[timing]?.label ?? '';
}

// ─── Component ────────────────────────────────────────────────

export default function HealthScreen() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRecipients = useCallback(async () => {
    try {
      const result = await api.get<Recipient[]>('/recipients');
      setRecipients(result);
      const first = result[0];
      if (first && !selectedRecipientId) {
        setSelectedRecipientId(first.id);
      }
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
      const result = await api.get<Measurement[]>(
        `/measurements?recipient_id=${selectedRecipientId}&limit=10`,
      );
      setMeasurements(result);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [selectedRecipientId]);

  useEffect(() => {
    void fetchRecipients();
  }, [fetchRecipients]);

  useEffect(() => {
    void fetchMeasurements();
  }, [fetchMeasurements]);

  const selectedName = recipients.find((r) => r.id === selectedRecipientId)?.name ?? '';

  // ─── Fatal Error (no recipients loaded) ─────────────────────

  if (error && recipients.length === 0) {
    return (
      <View style={styles.center}>
        <ErrorState message={error} onRetry={() => void fetchRecipients()} />
      </View>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Recipient selector */}
      {recipients.length > 1 && (
        <FlatList
          horizontal
          data={recipients}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          style={styles.selectorList}
          contentContainerStyle={styles.selectorContent}
          renderItem={({ item }) => {
            const isActive = item.id === selectedRecipientId;
            return (
              <TouchableOpacity
                style={[styles.selectorChip, isActive && styles.selectorChipActive]}
                onPress={() => setSelectedRecipientId(item.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`選擇 ${item.name}`}
              >
                <Text style={[styles.selectorText, isActive && styles.selectorTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Section title */}
      {selectedName ? (
        <Text style={styles.title}>{selectedName} 的健康紀錄</Text>
      ) : null}

      {/* Quick actions */}
      {selectedRecipientId && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${selectedRecipientId}&type=blood_pressure`)}
          >
            <Text style={styles.actionText}>記錄血壓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${selectedRecipientId}&type=blood_glucose`)}
          >
            <Text style={styles.actionText}>記錄血糖</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/(tabs)/health/trends?recipientId=${selectedRecipientId}`)}
          >
            <Text style={styles.actionText}>看趨勢</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/health/export')}
          >
            <Text style={styles.actionText}>匯出</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Measurement list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>載入中...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerPadded}>
          <ErrorState message={error} onRetry={() => void fetchMeasurements()} />
        </View>
      ) : measurements.length === 0 ? (
        <EmptyState
          title="尚無量測紀錄"
          description="定期記錄血壓與血糖，有助於掌握健康狀況。"
          actionLabel="開始記錄"
          onAction={() => router.push(`/(tabs)/health/add-measurement?recipientId=${selectedRecipientId}&type=blood_pressure`)}
        />
      ) : (
        <FlatList
          data={measurements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card
              style={[
                styles.measurementCard,
                { borderLeftColor: item.is_abnormal ? colors.danger : colors.primary },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardType}>
                  {item.type === 'blood_pressure' ? '血壓' : '血糖'}
                </Text>
                {item.is_abnormal && (
                  <View style={styles.abnormalBadge}>
                    <Text style={styles.abnormalText}>需留意</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardValue}>
                {item.type === 'blood_pressure'
                  ? `${item.systolic}/${item.diastolic} mmHg`
                  : `${item.glucose_value} mg/dL`}
              </Text>
              {item.type === 'blood_glucose' && item.glucose_timing && (
                <Text style={styles.cardTiming}>{formatTiming(item.glucose_timing)}</Text>
              )}
              <Text style={styles.cardTime}>
                {new Date(item.measured_at).toLocaleString('zh-TW')}
              </Text>
            </Card>
          )}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  centerPadded: {
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
  },

  // ─── Title ────────────────────────────────────────────────
  title: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: typography.headingLg.fontWeight,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // ─── Recipient Selector ───────────────────────────────────
  selectorList: {
    maxHeight: 50,
  },
  selectorContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  selectorChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurfaceAlt,
  },
  selectorChipActive: {
    backgroundColor: colors.primaryLight,
  },
  selectorText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
  },
  selectorTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },

  // ─── Quick Actions ────────────────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  actionText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.primaryText,
  },

  // ─── Measurement List ─────────────────────────────────────
  list: {
    padding: spacing.md,
  },

  // ─── Measurement Card ─────────────────────────────────────
  measurementCard: {
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardType: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  abnormalBadge: {
    marginLeft: spacing.sm,
    backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  abnormalText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.danger,
  },
  cardValue: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  cardTiming: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
    marginBottom: spacing.xxs,
  },
  cardTime: {
    fontSize: typography.caption.fontSize,
    color: colors.textTertiary,
  },
});
