import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { GLUCOSE_TIMING_DISPLAY } from '@remote-care/shared';

// ─── Types ────────────────────────────────────────────────────

type MeasurementType = 'blood_pressure' | 'blood_glucose';
type GlucoseTiming = 'before_meal' | 'after_meal' | 'fasting' | 'random';

const TIMING_OPTIONS: { value: GlucoseTiming; label: string }[] = Object.entries(
  GLUCOSE_TIMING_DISPLAY,
).map(([value, config]) => ({ value: value as GlucoseTiming, label: config.label }));

// ─── Icons ────────────────────────────────────────────────────

function IconHeart({ size = 20, color = colors.danger }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s-7-4.5-7-11a4 4 0 017-2.5A4 4 0 0119 10c0 6.5-7 11-7 11z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconDrop({ size = 20, color = colors.warning }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2C8 6 5 9 5 14a7 7 0 0014 0c0-5-3-8-7-12z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconNote({ size = 16, color = colors.textTertiary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M14 3v6h6M8 13h8M8 17h5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function AddMeasurementScreen() {
  const { recipientId, type: initialType } = useLocalSearchParams<{
    recipientId: string;
    type?: string;
  }>();
  const router = useRouter();

  const [type, setType] = useState<MeasurementType>(
    initialType === 'blood_glucose' ? 'blood_glucose' : 'blood_pressure',
  );
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [glucoseValue, setGlucoseValue] = useState('');
  const [glucoseTiming, setGlucoseTiming] = useState<GlucoseTiming>('fasting');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      const urlType = initialType === 'blood_glucose' ? 'blood_glucose' : 'blood_pressure';
      setType(urlType);
      setSystolic('');
      setDiastolic('');
      setHeartRate('');
      setGlucoseValue('');
      setGlucoseTiming('fasting');
      setNote('');
      setError('');
    }, [initialType]),
  );

  async function handleSubmit() {
    setError('');

    if (type === 'blood_pressure') {
      const sys = Number(systolic);
      const dia = Number(diastolic);
      if (!systolic || sys < 40 || sys > 300) {
        setError('收縮壓需介於 40-300');
        return;
      }
      if (!diastolic || dia < 20 || dia > 200) {
        setError('舒張壓需介於 20-200');
        return;
      }
      if (heartRate && (Number(heartRate) < 30 || Number(heartRate) > 250)) {
        setError('心率需介於 30-250');
        return;
      }
    } else {
      const gv = Number(glucoseValue);
      if (!glucoseValue || gv < 10 || gv > 800) {
        setError('血糖值需介於 10-800');
        return;
      }
    }

    setSaving(true);
    try {
      const measuredAt = new Date().toISOString();
      let body: Record<string, unknown>;

      if (type === 'blood_pressure') {
        body = {
          recipient_id: recipientId,
          type: 'blood_pressure',
          systolic: Number(systolic),
          diastolic: Number(diastolic),
          heart_rate: heartRate ? Number(heartRate) : undefined,
          unit: 'mmHg',
          measured_at: measuredAt,
          note: note.trim() || undefined,
        };
      } else {
        body = {
          recipient_id: recipientId,
          type: 'blood_glucose',
          glucose_value: Number(glucoseValue),
          glucose_timing: glucoseTiming,
          unit: 'mg/dL',
          measured_at: measuredAt,
          note: note.trim() || undefined,
        };
      }

      const result = await api.post<{ is_abnormal: boolean }>('/measurements', body);

      if (result.is_abnormal) {
        Alert.alert('量測提醒', '此次量測數值超出一般參考範圍，建議留意。', [
          { text: '知道了', onPress: () => router.back() },
        ]);
      } else {
        router.back();
      }
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('儲存失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  }

  const isBP = type === 'blood_pressure';
  const heroTagline = isBP ? 'BLOOD PRESSURE' : 'BLOOD GLUCOSE';
  const heroSubtitle = isBP ? '記錄血壓量測值' : '記錄血糖量測值';

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
            {isBP ? <IconHeart size={20} /> : <IconDrop size={20} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTagline}>{heroTagline}</Text>
            <Text style={s.heroSubtitle}>{heroSubtitle}</Text>
          </View>
        </View>
      </View>

      {/* ─── Type toggle ───────────────────────────────────── */}
      <View style={s.toggleRow}>
        <TouchableOpacity
          style={[s.toggleChip, isBP && s.toggleChipActive]}
          onPress={() => setType('blood_pressure')}
          accessibilityRole="button"
          accessibilityState={{ selected: isBP }}
          activeOpacity={0.7}
        >
          <Text style={[s.toggleText, isBP && s.toggleTextActive]}>血壓</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleChip, !isBP && s.toggleChipActive]}
          onPress={() => setType('blood_glucose')}
          accessibilityRole="button"
          accessibilityState={{ selected: !isBP }}
          activeOpacity={0.7}
        >
          <Text style={[s.toggleText, !isBP && s.toggleTextActive]}>血糖</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Error ──────────────────────────────────────────── */}
      {error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* ─── Measurement Card ───────────────────────────────── */}
      <View style={s.card}>
        {isBP ? (
          <>
            <View style={s.bpRow}>
              <View style={s.bpField}>
                <Text style={s.fieldLabel}>收縮壓 <Text style={s.required}>*</Text></Text>
                <TextInput
                  style={s.inputLarge}
                  value={systolic}
                  onChangeText={setSystolic}
                  keyboardType="numeric"
                  placeholder="120"
                  placeholderTextColor={colors.textDisabled}
                  accessibilityLabel="收縮壓"
                  maxLength={3}
                />
                <Text style={s.unit}>mmHg</Text>
              </View>
              <View style={s.bpField}>
                <Text style={s.fieldLabel}>舒張壓 <Text style={s.required}>*</Text></Text>
                <TextInput
                  style={s.inputLarge}
                  value={diastolic}
                  onChangeText={setDiastolic}
                  keyboardType="numeric"
                  placeholder="80"
                  placeholderTextColor={colors.textDisabled}
                  accessibilityLabel="舒張壓"
                  maxLength={3}
                />
                <Text style={s.unit}>mmHg</Text>
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.fieldLabel}>心率（選填）</Text>
              <View style={s.inlineInput}>
                <TextInput
                  style={s.inputSmall}
                  value={heartRate}
                  onChangeText={setHeartRate}
                  keyboardType="numeric"
                  placeholder="72"
                  placeholderTextColor={colors.textDisabled}
                  accessibilityLabel="心率"
                  maxLength={3}
                />
                <Text style={s.unit}>bpm</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={s.field}>
              <Text style={s.fieldLabel}>血糖值 <Text style={s.required}>*</Text></Text>
              <View style={s.inlineInput}>
                <TextInput
                  style={s.inputSmall}
                  value={glucoseValue}
                  onChangeText={setGlucoseValue}
                  keyboardType="numeric"
                  placeholder="100"
                  placeholderTextColor={colors.textDisabled}
                  accessibilityLabel="血糖值"
                  maxLength={3}
                />
                <Text style={s.unit}>mg/dL</Text>
              </View>
            </View>

            <View style={[s.field, { marginBottom: 0 }]}>
              <Text style={s.fieldLabel}>量測時機 <Text style={s.required}>*</Text></Text>
              <View style={s.timingRow}>
                {TIMING_OPTIONS.map(({ value, label }) => {
                  const isActive = glucoseTiming === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[s.timingChip, isActive && s.timingChipActive]}
                      onPress={() => setGlucoseTiming(value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={label}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.timingText, isActive && s.timingTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </View>

      {/* ─── Note section ───────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconNote />
        <Text style={s.sectionTitle}>備註</Text>
      </View>
      <View style={s.card}>
        <TextInput
          style={s.textArea}
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
          placeholder="選填，可記錄用藥或身體狀況"
          placeholderTextColor={colors.textDisabled}
          textAlignVertical="top"
          accessibilityLabel="備註"
        />
      </View>

      {/* ─── Submit (gradient) ──────────────────────────────── */}
      <TouchableOpacity
        style={[s.submitWrap, saving && { opacity: 0.6 }]}
        onPress={() => void handleSubmit()}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={saving ? '儲存中' : '完成記錄'}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.submitBtn}
        >
          <Text style={s.submitText}>{saving ? '儲存中...' : '完成記錄'}</Text>
        </LinearGradient>
      </TouchableOpacity>
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
  toggleChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  toggleText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.primaryText,
    fontWeight: '700',
  },

  // ─── Error ────────────────────────────────────────────────
  errorBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1, borderColor: 'rgba(217,83,79,0.2)',
  },
  errorText: { color: colors.danger, fontSize: typography.bodySm.fontSize, textAlign: 'center' },

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

  // ─── Field ───────────────────────────────────────────────
  field: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  required: { color: colors.danger },

  // ─── BP Row ──────────────────────────────────────────────
  bpRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  bpField: {
    flex: 1,
    alignItems: 'center',
  },

  // ─── Inputs ──────────────────────────────────────────────
  inputLarge: {
    backgroundColor: colors.bgScreen,
    borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.headingLg.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    width: '100%',
  },
  inputSmall: {
    backgroundColor: colors.bgScreen,
    borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.headingMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
    width: 110,
    textAlign: 'center',
  },
  inlineInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unit: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  textArea: {
    backgroundColor: colors.bgScreen,
    borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
    minHeight: 88,
    textAlignVertical: 'top',
  },

  // ─── Timing Chips (pill style) ───────────────────────────
  timingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timingChip: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
  },
  timingChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  timingText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  timingTextActive: {
    color: colors.primaryText,
    fontWeight: '700',
  },

  // ─── Submit ──────────────────────────────────────────────
  submitWrap: {
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  submitBtn: {
    paddingVertical: spacing.md + 2,
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
