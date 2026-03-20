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
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
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

  // Derive latest readings from already-loaded data (no extra API call)
  const latestBP = measurements.find((m) => m.type === 'blood_pressure');
  const latestBG = measurements.find((m) => m.type === 'blood_glucose');

  // ─── Fatal Error ──────────────────────────────────────────────

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
      {/* ── Header Zone ──────────────────────────────────────── */}
      <View style={styles.headerZone}>
        {/* Recipient selector */}
        {recipients.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectorList}
            contentContainerStyle={styles.selectorContent}
          >
            {recipients.map((r) => {
              const isActive = r.id === selectedRecipientId;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.selectorChip, isActive && styles.selectorChipActive]}
                  onPress={() => setSelectedRecipientId(r.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`選擇 ${r.name}`}
                >
                  <Text style={[styles.selectorText, isActive && styles.selectorTextActive]}>
                    {r.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Title */}
        {selectedName ? (
          <Text style={styles.title}>{selectedName} 的健康紀錄</Text>
        ) : null}

        {/* Primary actions — record BP / BG */}
        {selectedRecipientId && (
          <View style={styles.primaryActions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${selectedRecipientId}&type=blood_pressure`)}
              activeOpacity={0.7}
            >
              <View style={styles.primaryButtonIcon}>
                <View style={styles.bpIcon}>
                  <View style={styles.bpIconBar} />
                  <View style={[styles.bpIconBar, styles.bpIconBarShort]} />
                </View>
              </View>
              <Text style={styles.primaryButtonText}>記錄血壓</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${selectedRecipientId}&type=blood_glucose`)}
              activeOpacity={0.7}
            >
              <View style={styles.primaryButtonIcon}>
                <View style={styles.bgIcon} />
              </View>
              <Text style={styles.primaryButtonText}>記錄血糖</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Secondary actions — trends / export */}
        {selectedRecipientId && (
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push(`/(tabs)/health/trends?recipientId=${selectedRecipientId}`)}
            >
              <Text style={styles.secondaryButtonText}>趨勢分析</Text>
              <Text style={styles.secondaryArrow}>→</Text>
            </TouchableOpacity>
            <View style={styles.secondaryDivider} />
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/(tabs)/health/export')}
            >
              <Text style={styles.secondaryButtonText}>匯出紀錄</Text>
              <Text style={styles.secondaryArrow}>→</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Latest Reading Summary ────────────────────────────── */}
      {!loading && measurements.length > 0 && (
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>最近血壓</Text>
            {latestBP ? (
              <Text style={[
                styles.summaryValue,
                latestBP.is_abnormal && styles.summaryValueAlert,
              ]}>
                {latestBP.systolic}/{latestBP.diastolic}
              </Text>
            ) : (
              <Text style={styles.summaryValueEmpty}>—</Text>
            )}
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>最近血糖</Text>
            {latestBG ? (
              <Text style={[
                styles.summaryValue,
                latestBG.is_abnormal && styles.summaryValueAlert,
              ]}>
                {latestBG.glucose_value}
              </Text>
            ) : (
              <Text style={styles.summaryValueEmpty}>—</Text>
            )}
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>總筆數</Text>
            <Text style={styles.summaryValue}>{measurements.length}</Text>
          </View>
        </View>
      )}

      {/* ── Measurement List ─────────────────────────────────── */}
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
          ListHeaderComponent={
            <Text style={styles.listSectionLabel}>近期紀錄</Text>
          }
          renderItem={({ item }) => {
            const isBP = item.type === 'blood_pressure';

            return (
              <Card style={[
                styles.measurementCard,
                item.is_abnormal && styles.measurementCardAlert,
              ]}>
                <View style={styles.cardTop}>
                  {/* Left: type indicator + value */}
                  <View style={styles.cardMain}>
                    <View style={styles.cardTypeRow}>
                      <View style={[
                        styles.typeDot,
                        { backgroundColor: item.is_abnormal ? colors.danger : colors.primary },
                      ]} />
                      <Text style={styles.cardType}>
                        {isBP ? '血壓' : '血糖'}
                      </Text>
                      {item.is_abnormal && (
                        <View style={styles.alertTag}>
                          <Text style={styles.alertTagText}>需留意</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[
                      styles.cardValue,
                      item.is_abnormal && styles.cardValueAlert,
                    ]}>
                      {isBP
                        ? `${item.systolic}/${item.diastolic}`
                        : `${item.glucose_value}`}
                      <Text style={styles.cardUnit}> {isBP ? 'mmHg' : 'mg/dL'}</Text>
                    </Text>
                  </View>

                  {/* Right: meta */}
                  <View style={styles.cardMeta}>
                    <Text style={styles.cardTime}>{formatTime(item.measured_at)}</Text>
                    {!isBP && item.glucose_timing && (
                      <Text style={styles.cardTiming}>{formatTiming(item.glucose_timing)}</Text>
                    )}
                  </View>
                </View>
              </Card>
            );
          }}
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

  // ─── Header Zone ──────────────────────────────────────────
  headerZone: {
    backgroundColor: colors.bgSurface,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    ...shadows.low,
  },

  // ─── Title ────────────────────────────────────────────────
  title: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },

  // ─── Recipient Selector ───────────────────────────────────
  selectorList: {
    maxHeight: 44,
    marginHorizontal: -spacing.lg,
  },
  selectorContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  selectorChip: {
    paddingHorizontal: spacing.md + spacing.xxs,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSurfaceAlt,
  },
  selectorChipActive: {
    backgroundColor: colors.primaryLight,
  },
  selectorText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
  },
  selectorTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },

  // ─── Primary Actions ─────────────────────────────────────
  primaryActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  primaryButtonIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.primaryText,
  },

  // Custom BP icon (two horizontal bars)
  bpIcon: {
    gap: spacing.xxs,
    alignItems: 'center',
  },
  bpIconBar: {
    width: 12,
    height: 2.5,
    borderRadius: 1,
    backgroundColor: colors.primaryText,
  },
  bpIconBarShort: {
    width: 8,
  },

  // Custom BG icon (small circle)
  bgIcon: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.primaryText,
  },

  // ─── Secondary Actions ────────────────────────────────────
  secondaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm + spacing.xxs,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  secondaryButtonText: {
    fontSize: typography.caption.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  secondaryArrow: {
    fontSize: typography.caption.fontSize,
    color: colors.textDisabled,
  },
  secondaryDivider: {
    width: 1,
    height: 14,
    backgroundColor: colors.borderDefault,
  },

  // ─── Summary Strip ────────────────────────────────────────
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xxs,
  },
  summaryValue: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryValueAlert: {
    color: colors.warning,
  },
  summaryValueEmpty: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '400',
    color: colors.textDisabled,
  },
  summaryDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.borderDefault,
  },

  // ─── Measurement List ─────────────────────────────────────
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  listSectionLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  // ─── Measurement Card ─────────────────────────────────────
  measurementCard: {
    marginBottom: spacing.sm,
    padding: spacing.md + spacing.xxs,
  },
  measurementCardAlert: {
    borderColor: colors.dangerLight,
    backgroundColor: '#FEFAFA',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardMain: {
    flex: 1,
  },
  cardTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardType: {
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  alertTag: {
    backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  alertTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.danger,
  },
  cardValue: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardValueAlert: {
    color: colors.danger,
  },
  cardUnit: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '400',
    color: colors.textTertiary,
  },

  // ─── Card Meta (right side) ───────────────────────────────
  cardMeta: {
    alignItems: 'flex-end',
    paddingTop: spacing.xxs,
  },
  cardTime: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginBottom: spacing.xxs,
  },
  cardTiming: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
  },
});
