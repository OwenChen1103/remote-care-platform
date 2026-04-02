import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
import { Card } from '@/components/ui/Card';

// ─── Types ────────────────────────────────────────────────────

interface Recipient {
  id: string;
  name: string;
}

type MeasurementType = 'blood_pressure' | 'blood_glucose';

// ─── Component ────────────────────────────────────────────────

export default function ExportScreen() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [type, setType] = useState<MeasurementType>('blood_pressure');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRecipients = useCallback(async () => {
    try {
      const result = await api.get<Recipient[]>('/recipients');
      setRecipients(result);
      const first = result[0];
      if (first) {
        setSelectedRecipientId(first.id);
      }
    } catch {
      setError('載入被照護者失敗');
    }
  }, []);

  useEffect(() => {
    void fetchRecipients();
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(now.toISOString().slice(0, 10));
  }, [fetchRecipients]);

  async function handleGenerate() {
    if (!selectedRecipientId || !fromDate || !toDate) {
      setError('請選擇被照護者與日期範圍');
      return;
    }
    setLoading(true);
    setError('');
    setText('');
    try {
      const result = await api.get<{ text: string }>(
        `/measurements/export?recipient_id=${selectedRecipientId}&type=${type}&from=${fromDate}T00:00:00Z&to=${toDate}T23:59:59Z`,
      );
      setText(result.text);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('產生摘要失敗');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await Clipboard.setStringAsync(text);
  }

  async function handleShare() {
    await Share.share({ message: text });
  }

  return (
    <ScrollView style={styles.container}>
      {/* ── Header Zone ──────────────────────────────────────── */}
      <View style={styles.headerZone}>
        <Text style={styles.title}>匯出分享</Text>
        <Text style={styles.subtitle}>選擇條件後，產生文字摘要供分享給醫師或家人。</Text>
      </View>

      <View style={styles.content}>
        {/* Recipient selector */}
        {recipients.length > 0 && (
          <View style={styles.card}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>被照護者</Text>
              <View style={styles.chipRow}>
                {recipients.map((r) => {
                  const active = r.id === selectedRecipientId;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSelectedRecipientId(r.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {r.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Type selector */}
        <View style={styles.card}>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>量測類型</Text>
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
          </View>
        </View>

        {/* Date range */}
        <View style={styles.card}>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>日期範圍</Text>
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.dateHint}>起始</Text>
                <TextInput
                  style={styles.input}
                  value={fromDate}
                  onChangeText={setFromDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textDisabled}
                  accessibilityLabel="起始日期"
                />
              </View>
              <Text style={styles.dateSep}>至</Text>
              <View style={styles.dateField}>
                <Text style={styles.dateHint}>結束</Text>
                <TextInput
                  style={styles.input}
                  value={toDate}
                  onChangeText={setToDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textDisabled}
                  accessibilityLabel="結束日期"
                />
              </View>
            </View>
          </View>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Generate */}
        <TouchableOpacity
          style={[styles.generateButton, loading && styles.buttonDisabled]}
          onPress={() => void handleGenerate()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={loading ? '產生中' : '產生摘要'}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.generateText}>產生摘要</Text>
          )}
        </TouchableOpacity>

        {/* Preview result */}
        {text ? (
          <Card style={styles.previewCard}>
            <Text style={styles.previewLabel}>摘要預覽</Text>
            <Text style={styles.previewText}>{text}</Text>
            <View style={styles.shareRow}>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => void handleCopy()}
                accessibilityLabel="複製摘要"
              >
                <Text style={styles.shareButtonText}>複製</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => void handleShare()}
                accessibilityLabel="分享摘要"
              >
                <Text style={styles.shareButtonText}>分享</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}
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
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    ...shadows.low,
  },
  title: { fontSize: typography.headingMd.fontSize, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary, marginTop: spacing.xs },
  content: { padding: spacing.lg },

  // ─── Card container ───────────────────────────────────────
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.low,
    marginBottom: spacing.sm,
  },

  // ─── Sections ─────────────────────────────────────────────
  section: { marginBottom: 0 },
  sectionLabel: {
    fontSize: 10, fontWeight: '500', color: colors.textDisabled,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm,
  },

  // ─── Chips ────────────────────────────────────────────────
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md + spacing.xxs, paddingVertical: spacing.sm,
    borderRadius: radius.sm, backgroundColor: colors.bgSurfaceAlt,
  },
  chipActive: { backgroundColor: colors.primaryLight },
  chipText: { fontSize: typography.bodyMd.fontSize, color: colors.textTertiary },
  chipTextActive: { color: colors.primaryText, fontWeight: '600' },

  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleChip: {
    flex: 1, paddingVertical: spacing.sm + spacing.xxs, borderRadius: radius.sm,
    backgroundColor: colors.bgSurfaceAlt, alignItems: 'center',
  },
  toggleChipActive: { backgroundColor: colors.primaryLight },
  toggleText: { fontSize: typography.bodyMd.fontSize, fontWeight: '600', color: colors.textTertiary },
  toggleTextActive: { color: colors.primaryText },

  // ─── Date Range ───────────────────────────────────────────
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  dateField: { flex: 1 },
  dateHint: { fontSize: typography.captionSm.fontSize, color: colors.textDisabled, marginBottom: spacing.xs },
  dateSep: { fontSize: typography.bodyMd.fontSize, color: colors.textTertiary, paddingBottom: spacing.md },
  input: {
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.sm, padding: spacing.md, fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
  },

  // ─── Error ────────────────────────────────────────────────
  errorBox: {
    backgroundColor: colors.dangerLight, borderRadius: radius.sm,
    padding: spacing.md, marginBottom: spacing.md, marginTop: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: typography.bodyMd.fontSize, textAlign: 'center' },

  // ─── Generate ─────────────────────────────────────────────
  generateButton: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: spacing.lg - spacing.xxs, alignItems: 'center',
    marginTop: spacing.sm,
    ...shadows.low,
  },
  buttonDisabled: { opacity: 0.5 },
  generateText: { color: colors.white, fontSize: typography.bodyLg.fontSize, fontWeight: '600' },

  // ─── Preview Card ─────────────────────────────────────────
  previewCard: { marginTop: spacing.lg, padding: spacing.lg },
  previewLabel: {
    fontSize: 10, fontWeight: '500', color: colors.textDisabled,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm,
  },
  previewText: { fontSize: typography.bodyMd.fontSize, color: colors.textPrimary, lineHeight: typography.bodyMd.fontSize * 1.6 },
  shareRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  shareButton: {
    flex: 1, backgroundColor: colors.primaryLight, borderRadius: radius.sm,
    paddingVertical: spacing.sm + spacing.xxs, alignItems: 'center',
  },
  shareButtonText: { fontSize: typography.bodyMd.fontSize, fontWeight: '600', color: colors.primaryText },
});
