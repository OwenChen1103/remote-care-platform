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

type MeasurementType = 'blood_pressure' | 'blood_glucose';
type GlucoseTiming = 'before_meal' | 'after_meal' | 'fasting' | 'random';

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
        Alert.alert('提醒', '此次量測數值偏高或偏低，建議留意', [
          { text: '確定', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('成功', '量測紀錄已儲存', [
          { text: '確定', onPress: () => router.back() },
        ]);
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
        >
          <Text style={[styles.toggleText, type === 'blood_pressure' && styles.toggleTextActive]}>
            血壓
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, type === 'blood_glucose' && styles.toggleActive]}
          onPress={() => setType('blood_glucose')}
        >
          <Text style={[styles.toggleText, type === 'blood_glucose' && styles.toggleTextActive]}>
            血糖
          </Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {type === 'blood_pressure' ? (
        <>
          <Text style={styles.label}>收縮壓 (mmHg) *</Text>
          <TextInput
            style={styles.input}
            value={systolic}
            onChangeText={setSystolic}
            keyboardType="numeric"
            placeholder="40-300"
          />

          <Text style={styles.label}>舒張壓 (mmHg) *</Text>
          <TextInput
            style={styles.input}
            value={diastolic}
            onChangeText={setDiastolic}
            keyboardType="numeric"
            placeholder="20-200"
          />

          <Text style={styles.label}>心率 (bpm)</Text>
          <TextInput
            style={styles.input}
            value={heartRate}
            onChangeText={setHeartRate}
            keyboardType="numeric"
            placeholder="30-250（選填）"
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>血糖值 (mg/dL) *</Text>
          <TextInput
            style={styles.input}
            value={glucoseValue}
            onChangeText={setGlucoseValue}
            keyboardType="numeric"
            placeholder="10-800"
          />

          <Text style={styles.label}>量測時機 *</Text>
          <View style={styles.timingRow}>
            {([
              ['fasting', '空腹'],
              ['before_meal', '餐前'],
              ['after_meal', '餐後'],
              ['random', '隨機'],
            ] as const).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[styles.timingButton, glucoseTiming === value && styles.timingActive]}
                onPress={() => setGlucoseTiming(value)}
              >
                <Text style={[styles.timingText, glucoseTiming === value && styles.timingTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>備註</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={2}
        placeholder="選填"
      />

      <TouchableOpacity
        style={[styles.submitButton, saving && styles.submitDisabled]}
        onPress={() => void handleSubmit()}
        disabled={saving}
      >
        <Text style={styles.submitText}>{saving ? '儲存中...' : '儲存'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 },
  toggleRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: '#3b82f6' },
  toggleText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  toggleTextActive: { color: '#fff' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: { height: 60, textAlignVertical: 'top' },
  timingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timingButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  timingActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  timingText: { color: '#374151', fontWeight: '500' },
  timingTextActive: { color: '#fff' },
  error: { color: '#dc2626', marginBottom: 12, fontSize: 14 },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
