import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';

// ─── Types ────────────────────────────────────────────────────

interface Recipient {
  id: string;
  name: string;
}

type MeasurementType = 'blood_pressure' | 'blood_glucose';

// ─── Icons ────────────────────────────────────────────────────

function IconUser() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={colors.primary} strokeWidth={1.8} />
      <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconType() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M3 17l5-5 4 4 8-8M16 8h5v5" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCalendar() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={colors.primary} strokeWidth={1.8} />
      <Path d="M3 9h18M8 3v4M16 3v4" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconDownloadLg() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCopy() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="9" width="11" height="11" rx="2" stroke={colors.primaryText} strokeWidth={1.8} />
      <Path d="M5 15V5a2 2 0 012-2h10" stroke={colors.primaryText} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconShare() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke={colors.primaryText} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCalendarSmall() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={colors.textTertiary} strokeWidth={1.8} />
      <Path d="M3 9h18M8 3v4M16 3v4" stroke={colors.textTertiary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function ExportScreen() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [type, setType] = useState<MeasurementType>('blood_pressure');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pickingFrom, setPickingFrom] = useState(false);
  const [pickingTo, setPickingTo] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRecipients = useCallback(async () => {
    try {
      const result = await api.get<Recipient[]>('/recipients');
      setRecipients(result);
      const first = result[0];
      if (first) setSelectedRecipientId(first.id);
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

  const formatDate = (s: string): string => {
    if (!s) return '選擇日期';
    return new Date(s).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const fromValue = fromDate ? new Date(fromDate) : new Date();
  const toValue = toDate ? new Date(toDate) : new Date();

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
          <View style={s.heroIconWrap}>
            <IconDownloadLg />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTagline}>EXPORT RECORDS</Text>
            <Text style={s.heroSubtitle}>產生文字摘要分享給醫師或家人</Text>
          </View>
        </View>
      </View>

      {/* ─── Consolidated Form Card ─────────────────────────── */}
      <View style={s.card}>
        {/* Recipient */}
        {recipients.length > 0 && (
          <View style={s.field}>
            <View style={s.fieldHeader}>
              <IconUser />
              <Text style={s.fieldLabel}>被照護者</Text>
            </View>
            <View style={s.chipRow}>
              {recipients.map((r) => {
                const active = r.id === selectedRecipientId;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setSelectedRecipientId(r.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{r.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Type */}
        <View style={s.field}>
          <View style={s.fieldHeader}>
            <IconType />
            <Text style={s.fieldLabel}>量測類型</Text>
          </View>
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
        </View>

        {/* Date range */}
        <View style={[s.field, { marginBottom: 0 }]}>
          <View style={s.fieldHeader}>
            <IconCalendar />
            <Text style={s.fieldLabel}>日期範圍</Text>
          </View>
          <View style={s.dateRow}>
            <TouchableOpacity style={s.dateBtn} onPress={() => { setPickingFrom(true); setPickingTo(false); }} activeOpacity={0.7}>
              <Text style={s.dateHint}>起始</Text>
              <View style={s.dateValueRow}>
                <Text style={s.dateValue}>{formatDate(fromDate)}</Text>
                <IconCalendarSmall />
              </View>
            </TouchableOpacity>
            <Text style={s.dateSep}>—</Text>
            <TouchableOpacity style={s.dateBtn} onPress={() => { setPickingTo(true); setPickingFrom(false); }} activeOpacity={0.7}>
              <Text style={s.dateHint}>結束</Text>
              <View style={s.dateValueRow}>
                <Text style={s.dateValue}>{formatDate(toDate)}</Text>
                <IconCalendarSmall />
              </View>
            </TouchableOpacity>
          </View>

          {pickingFrom && (
            <View>
              <DateTimePicker
                value={fromValue}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selected) => {
                  if (Platform.OS === 'android') setPickingFrom(false);
                  if (selected) {
                    setFromDate(selected.toISOString().slice(0, 10));
                  }
                }}
                maximumDate={new Date()}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={s.dateConfirm} onPress={() => setPickingFrom(false)} activeOpacity={0.7}>
                  <Text style={s.dateConfirmText}>完成</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {pickingTo && (
            <View>
              <DateTimePicker
                value={toValue}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selected) => {
                  if (Platform.OS === 'android') setPickingTo(false);
                  if (selected) {
                    setToDate(selected.toISOString().slice(0, 10));
                  }
                }}
                maximumDate={new Date()}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={s.dateConfirm} onPress={() => setPickingTo(false)} activeOpacity={0.7}>
                  <Text style={s.dateConfirmText}>完成</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      {/* ─── Error ──────────────────────────────────────────── */}
      {error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* ─── Generate (gradient) ────────────────────────────── */}
      <TouchableOpacity
        style={[s.generateWrap, loading && { opacity: 0.6 }]}
        onPress={() => void handleGenerate()}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={loading ? '產生中' : '產生摘要'}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.generateBtn}
        >
          {loading ? (
            <View style={s.generatingRow}>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={s.generateText}>產生中...</Text>
            </View>
          ) : (
            <Text style={s.generateText}>產生摘要</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* ─── Preview ────────────────────────────────────────── */}
      {text ? (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>摘要預覽</Text>
          </View>
          <View style={s.previewCard}>
            <Text style={s.previewText}>{text}</Text>
          </View>
          <View style={s.shareRow}>
            <TouchableOpacity style={s.shareButton} onPress={() => void handleCopy()} accessibilityLabel="複製摘要" activeOpacity={0.7}>
              <IconCopy />
              <Text style={s.shareButtonText}>複製</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.shareButton} onPress={() => void handleShare()} accessibilityLabel="分享摘要" activeOpacity={0.7}>
              <IconShare />
              <Text style={s.shareButtonText}>分享</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] + spacing.lg, gap: spacing.md },

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  heroIconWrap: {
    width: 44, height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
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

  // ─── Card ────────────────────────────────────────────────
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
  },

  // ─── Field ───────────────────────────────────────────────
  field: { marginBottom: spacing.md + 2 },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // ─── Chips (recipient) ──────────────────────────────────
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderDefault,
  },
  chipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.primaryText,
    fontWeight: '700',
  },

  // ─── Type Toggle ─────────────────────────────────────────
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleChip: {
    flex: 1,
    paddingVertical: spacing.sm + spacing.xxs,
    borderRadius: radius.full,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderDefault,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '500',
    color: colors.textSecondary,
  },

  // ─── Date ────────────────────────────────────────────────
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateBtn: {
    flex: 1,
    backgroundColor: colors.bgScreen,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderDefault,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  dateHint: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  dateValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dateValue: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  dateSep: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textDisabled,
    marginTop: spacing.md,
  },
  dateConfirm: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
  },
  dateConfirmText: {
    color: colors.primaryText,
    fontSize: typography.captionSm.fontSize,
    fontWeight: '600',
  },

  // ─── Error ────────────────────────────────────────────────
  errorBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1, borderColor: 'rgba(217,83,79,0.2)',
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.bodySm.fontSize,
    textAlign: 'center',
  },

  // ─── Generate ────────────────────────────────────────────
  generateWrap: {
    borderRadius: radius.full,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  generateBtn: {
    paddingVertical: spacing.md + 2,
    alignItems: 'center', justifyContent: 'center',
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  generateText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    letterSpacing: 1,
  },

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

  // ─── Preview ─────────────────────────────────────────────
  previewCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
  },
  previewText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
    lineHeight: typography.bodyMd.fontSize * 1.6,
  },

  // ─── Share buttons ───────────────────────────────────────
  shareRow: { flexDirection: 'row', gap: spacing.sm },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 2,
  },
  shareButtonText: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '700',
    color: colors.primaryText,
  },
});
