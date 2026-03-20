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
import { colors, typography, spacing, radius } from '@/lib/theme';
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

    // Client-side validation
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
        // Health advisory — user should acknowledge before leaving
        Alert.alert('量測提醒', '此次量測數值超出一般參考範圍，建議留意。', [
          { text: '知道了', onPress: () => router.back() },
        ]);
      } else {
        // Normal success — navigate back immediately
        router.back();
      }
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('儲存失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>新增量測</Text>

      {/* Type toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, type === 'blood_pressure' && styles.toggleActive]}
          onPress={() => setType('blood_pressure')}
          accessibilityRole="button"
          accessibilityState={{ selected: type === 'blood_pressure' }}
        >
          <Text style={[styles.toggleText, type === 'blood_pressure' && styles.toggleTextActive]}>
            血壓
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, type === 'blood_glucose' && styles.toggleActive]}
          onPress={() => setType('blood_glucose')}
          accessibilityRole="button"
          accessibilityState={{ selected: type === 'blood_glucose' }}
        >
          <Text style={[styles.toggleText, type === 'blood_glucose' && styles.toggleTextActive]}>
            血糖
          </Text>
        </TouchableOpacity>
      </View>

      {/* Validation error */}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Blood Pressure fields */}
      {type === 'blood_pressure' ? (
        <>
          <Text style={styles.label}>收縮壓 (mmHg) *</Text>
          <TextInput
            style={styles.input}
            value={systolic}
            onChangeText={setSystolic}
            keyboardType="numeric"
            placeholder="40-300"
            placeholderTextColor={colors.textDisabled}
            accessibilityLabel="收縮壓"
          />

          <Text style={styles.label}>舒張壓 (mmHg) *</Text>
          <TextInput
            style={styles.input}
            value={diastolic}
            onChangeText={setDiastolic}
            keyboardType="numeric"
            placeholder="20-200"
            placeholderTextColor={colors.textDisabled}
            accessibilityLabel="舒張壓"
          />

          <Text style={styles.label}>心率 (bpm)</Text>
          <TextInput
            style={styles.input}
            value={heartRate}
            onChangeText={setHeartRate}
            keyboardType="numeric"
            placeholder="30-250（選填）"
            placeholderTextColor={colors.textDisabled}
            accessibilityLabel="心率"
          />
        </>
      ) : (
        <>
          {/* Blood Glucose fields */}
          <Text style={styles.label}>血糖值 (mg/dL) *</Text>
          <TextInput
            style={styles.input}
            value={glucoseValue}
            onChangeText={setGlucoseValue}
            keyboardType="numeric"
            placeholder="10-800"
            placeholderTextColor={colors.textDisabled}
            accessibilityLabel="血糖值"
          />

          <Text style={styles.label}>量測時機 *</Text>
          <View style={styles.timingRow}>
            {TIMING_OPTIONS.map(({ value, label }) => {
              const isActive = glucoseTiming === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.timingButton, isActive && styles.timingActive]}
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

      {/* Note */}
      <Text style={styles.label}>備註</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={2}
        placeholder="選填"
        placeholderTextColor={colors.textDisabled}
        accessibilityLabel="備註"
      />

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
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.headingXl.fontSize,
    fontWeight: typography.headingXl.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },

  // ─── Type Toggle ──────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSurfaceAlt,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: colors.primaryLight,
  },
  toggleText: {
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.primaryText,
  },

  // ─── Form Fields ──────────────────────────────────────────
  label: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: typography.bodyLg.fontSize,
    color: colors.textPrimary,
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },

  // ─── Timing Selector ─────────────────────────────────────
  timingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timingButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + spacing.xxs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgSurface,
  },
  timingActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryText,
  },
  timingText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  timingTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },

  // ─── Error ────────────────────────────────────────────────
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerLight,
    padding: spacing.md,
    borderRadius: radius.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontSize: typography.bodyMd.fontSize,
    overflow: 'hidden',
  },

  // ─── Submit ───────────────────────────────────────────────
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing['2xl'],
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: colors.white,
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
  },
});
