import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
import { GLUCOSE_TIMING_DISPLAY } from '@remote-care/shared';

// ─── Types ────────────────────────────────────────────────────

type MeasurementType = 'blood_pressure' | 'blood_glucose';
type GlucoseTiming = 'before_meal' | 'after_meal' | 'fasting' | 'random';

const TIMING_OPTIONS: { value: GlucoseTiming; label: string }[] = Object.entries(
  GLUCOSE_TIMING_DISPLAY,
).map(([value, config]) => ({ value: value as GlucoseTiming, label: config.label }));

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

  return (
    <ScrollView style={styles.container}>
      {/* ── Header Zone ──────────────────────────────────────── */}
      <View style={styles.headerZone}>
        <Text style={styles.title}>新增量測</Text>

        {/* Type toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleChip, isBP && styles.toggleChipActive]}
            onPress={() => setType('blood_pressure')}
            accessibilityRole="button"
            accessibilityState={{ selected: isBP }}
          >
            <Text style={[styles.toggleText, isBP && styles.toggleTextActive]}>血壓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleChip, !isBP && styles.toggleChipActive]}
            onPress={() => setType('blood_glucose')}
            accessibilityRole="button"
            accessibilityState={{ selected: !isBP }}
          >
            <Text style={[styles.toggleText, !isBP && styles.toggleTextActive]}>血糖</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Measurement Fields Card ────────────────────── */}
        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>{isBP ? '血壓數值' : '血糖數值'}</Text>

          {isBP ? (
            <>
              <View style={styles.bpRow}>
                <View style={styles.bpField}>
                  <Text style={styles.label}>收縮壓 *</Text>
                  <TextInput
                    style={styles.inputLarge}
                    value={systolic}
                    onChangeText={setSystolic}
                    keyboardType="numeric"
                    placeholder="120"
                    placeholderTextColor={colors.textDisabled}
                    accessibilityLabel="收縮壓"
                    maxLength={3}
                  />
                  <Text style={styles.unit}>mmHg</Text>
                </View>
                <Text style={styles.bpSeparator}>/</Text>
                <View style={styles.bpField}>
                  <Text style={styles.label}>舒張壓 *</Text>
                  <TextInput
                    style={styles.inputLarge}
                    value={diastolic}
                    onChangeText={setDiastolic}
                    keyboardType="numeric"
                    placeholder="80"
                    placeholderTextColor={colors.textDisabled}
                    accessibilityLabel="舒張壓"
                    maxLength={3}
                  />
                  <Text style={styles.unit}>mmHg</Text>
                </View>
              </View>

              <Text style={styles.label}>心率（選填）</Text>
              <View style={styles.inlineInput}>
                <TextInput
                  style={styles.inputSmall}
                  value={heartRate}
                  onChangeText={setHeartRate}
                  keyboardType="numeric"
                  placeholder="72"
                  placeholderTextColor={colors.textDisabled}
                  accessibilityLabel="心率"
                  maxLength={3}
                />
                <Text style={styles.unit}>bpm</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>血糖值 *</Text>
              <View style={styles.inlineInput}>
                <TextInput
                  style={styles.inputSmall}
                  value={glucoseValue}
                  onChangeText={setGlucoseValue}
                  keyboardType="numeric"
                  placeholder="100"
                  placeholderTextColor={colors.textDisabled}
                  accessibilityLabel="血糖值"
                  maxLength={3}
                />
                <Text style={styles.unit}>mg/dL</Text>
              </View>

              <Text style={styles.label}>量測時機 *</Text>
              <View style={styles.timingRow}>
                {TIMING_OPTIONS.map(({ value, label }) => {
                  const isActive = glucoseTiming === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[styles.timingChip, isActive && styles.timingChipActive]}
                      onPress={() => setGlucoseTiming(value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={label}
                    >
                      <Text style={[styles.timingText, isActive && styles.timingTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {/* ── Note Card ──────────────────────────────────── */}
        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>備註</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={2}
            placeholder="選填，可記錄用藥或身體狀況"
            placeholderTextColor={colors.textDisabled}
            textAlignVertical="top"
            accessibilityLabel="備註"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, saving && styles.submitDisabled]}
          onPress={() => void handleSubmit()}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={saving ? '儲存中' : '儲存量測紀錄'}
        >
          <Text style={styles.submitText}>{saving ? '儲存中...' : '儲存'}</Text>
        </TouchableOpacity>
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
    fontSize: typography.headingMd.fontSize, fontWeight: '700',
    color: colors.textPrimary, marginBottom: spacing.md,
  },
  content: { padding: spacing.lg },

  // ─── Toggle ───────────────────────────────────────────────
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleChip: {
    flex: 1, paddingVertical: spacing.sm + spacing.xxs, borderRadius: radius.sm,
    backgroundColor: colors.bgSurfaceAlt, alignItems: 'center',
  },
  toggleChipActive: { backgroundColor: colors.primaryLight },
  toggleText: { fontSize: typography.bodyMd.fontSize, fontWeight: '600', color: colors.textTertiary },
  toggleTextActive: { color: colors.primaryText },

  // ─── Error ────────────────────────────────────────────────
  errorBox: {
    backgroundColor: colors.dangerLight, borderRadius: radius.sm,
    padding: spacing.md, marginBottom: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: typography.bodyMd.fontSize, textAlign: 'center' },

  // ─── Form Card ────────────────────────────────────────────
  formCard: {
    backgroundColor: colors.bgSurface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg, marginBottom: spacing.md,
    ...shadows.low,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '500', color: colors.textDisabled,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.bodySm.fontSize, fontWeight: '600',
    color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.md,
  },

  // ─── BP Row (side by side) ────────────────────────────────
  bpRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  bpField: { flex: 1 },
  bpSeparator: {
    fontSize: typography.headingLg.fontSize, fontWeight: '300',
    color: colors.textDisabled, paddingBottom: spacing.md,
  },

  // ─── Inputs ───────────────────────────────────────────────
  input: {
    backgroundColor: colors.bgScreen, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.sm, padding: spacing.md,
    fontSize: typography.bodyMd.fontSize, color: colors.textPrimary,
  },
  inputLarge: {
    backgroundColor: colors.bgScreen, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.sm, padding: spacing.md,
    fontSize: typography.headingLg.fontSize, fontWeight: '700',
    color: colors.textPrimary, textAlign: 'center',
  },
  inputSmall: {
    backgroundColor: colors.bgScreen, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.sm, padding: spacing.md,
    fontSize: typography.headingMd.fontSize, fontWeight: '600',
    color: colors.textPrimary, width: 100, textAlign: 'center',
  },
  inlineInput: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unit: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary },
  textArea: { minHeight: 60, textAlignVertical: 'top' },

  // ─── Timing Chips ─────────────────────────────────────────
  timingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timingChip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + spacing.xxs,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: colors.bgSurface,
  },
  timingChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primaryText },
  timingText: { fontSize: typography.bodyMd.fontSize, color: colors.textSecondary, fontWeight: '500' },
  timingTextActive: { color: colors.primaryText, fontWeight: '600' },

  // ─── Submit ───────────────────────────────────────────────
  submitButton: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.lg - spacing.xxs, alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontSize: typography.bodyLg.fontSize, fontWeight: '600' },
});
