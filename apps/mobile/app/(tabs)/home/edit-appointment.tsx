/**
 * Edit appointment screen (Section 4.2.2).
 *
 * Reads existing appointment via GET /appointments/[id] (added in Phase 2 Section 4),
 * prefills the form, submits via PUT /appointments/[id].
 *
 * Mirror of add-appointment.tsx with:
 *   - useLocalSearchParams<{ id: string }> instead of recipientId
 *   - api.get on mount + api.put on submit (vs api.post)
 *   - Title 「編輯就醫行程」, button 「儲存變更」
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

interface Appointment {
  id: string;
  recipient_id: string;
  title: string;
  hospital_name: string | null;
  department: string | null;
  doctor_name: string | null;
  appointment_date: string;
  note: string | null;
}

export default function EditAppointmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [title, setTitle] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [department, setDepartment] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAppointment = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const data = await api.get<Appointment>(`/appointments/${id}`);
      setTitle(data.title);
      setHospitalName(data.hospital_name ?? '');
      setDepartment(data.department ?? '');
      setDoctorName(data.doctor_name ?? '');
      setAppointmentDate(new Date(data.appointment_date));
      setNote(data.note ?? '');
    } catch (e) {
      setFetchError(e instanceof ApiError ? e.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchAppointment();
  }, [fetchAppointment]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '請輸入行程標題');
      return;
    }
    if (!appointmentDate) {
      Alert.alert('提示', '請選擇就診日期與時間');
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/appointments/${id}`, {
        title: title.trim(),
        hospital_name: hospitalName.trim() || null,
        department: department.trim() || null,
        doctor_name: doctorName.trim() || null,
        appointment_date: appointmentDate.toISOString(),
        note: note.trim() || null,
      });

      Alert.alert('成功', '行程已更新', [
        { text: '確定', onPress: () => router.back() },
      ]);
    } catch (err) {
      if (err instanceof ApiError) {
        Alert.alert('錯誤', err.message);
      } else {
        Alert.alert('錯誤', '更新失敗，請稍後再試');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (fetchError) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorText}>{fetchError}</Text>
        <TouchableOpacity onPress={() => void fetchAppointment()} activeOpacity={0.7}>
          <Text style={styles.retryText}>重試</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>編輯就醫行程</Text>

      <Text style={styles.sectionLabel}>基本資訊</Text>
      <View style={styles.card}>
        <Text style={styles.label}>行程標題 *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="例如：台大醫院回診"
          placeholderTextColor={colors.textDisabled}
        />

        <Text style={styles.label}>就診日期 *</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <Text style={appointmentDate ? styles.inputValue : styles.inputPlaceholder}>
            {appointmentDate
              ? appointmentDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
              : '選擇日期'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>就診時間 *</Text>
        <TouchableOpacity
          style={[styles.input, !appointmentDate && { opacity: 0.5 }]}
          onPress={() => appointmentDate && setShowTimePicker(true)}
          activeOpacity={0.7}
          disabled={!appointmentDate}
        >
          <Text style={appointmentDate ? styles.inputValue : styles.inputPlaceholder}>
            {appointmentDate
              ? appointmentDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
              : '請先選擇日期'}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={appointmentDate ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, selected) => {
              if (Platform.OS === 'android') setShowDatePicker(false);
              if (selected) {
                const next = appointmentDate ? new Date(appointmentDate) : new Date();
                next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                setAppointmentDate(next);
              }
            }}
          />
        )}
        {Platform.OS === 'ios' && showDatePicker && (
          <TouchableOpacity style={styles.dateConfirm} onPress={() => setShowDatePicker(false)}>
            <Text style={styles.dateConfirmText}>完成</Text>
          </TouchableOpacity>
        )}
        {showTimePicker && (
          <DateTimePicker
            value={appointmentDate ?? new Date()}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, selected) => {
              if (Platform.OS === 'android') setShowTimePicker(false);
              if (selected && appointmentDate) {
                const next = new Date(appointmentDate);
                next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                setAppointmentDate(next);
              }
            }}
          />
        )}
        {Platform.OS === 'ios' && showTimePicker && (
          <TouchableOpacity style={styles.dateConfirm} onPress={() => setShowTimePicker(false)}>
            <Text style={styles.dateConfirmText}>完成</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>醫院名稱</Text>
        <TextInput
          style={styles.input}
          value={hospitalName}
          onChangeText={setHospitalName}
          placeholder="例如：台大醫院"
          placeholderTextColor={colors.textDisabled}
        />

        <Text style={styles.label}>科別</Text>
        <TextInput
          style={styles.input}
          value={department}
          onChangeText={setDepartment}
          placeholder="例如：心臟內科"
          placeholderTextColor={colors.textDisabled}
        />

        <Text style={styles.label}>醫師姓名</Text>
        <TextInput
          style={styles.input}
          value={doctorName}
          onChangeText={setDoctorName}
          placeholder="例如：陳醫師"
          placeholderTextColor={colors.textDisabled}
        />
      </View>

      <Text style={styles.sectionLabel}>備註</Text>
      <View style={styles.card}>
        <Text style={styles.label}>備註</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={note}
          onChangeText={setNote}
          placeholder="其他備註事項..."
          placeholderTextColor={colors.textDisabled}
          multiline
          numberOfLines={3}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.submitText}>{submitting ? '儲存中...' : '儲存變更'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: 40 },
  heading: { ...typography.headingLg, color: colors.textPrimary, marginBottom: spacing.xl },
  sectionLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.low,
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.bodyMd,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: spacing.xs + 2,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.bgSurfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 50,
    justifyContent: 'center',
    ...typography.headingSm,
    fontWeight: '400',
    color: colors.textPrimary,
  },
  inputValue: {
    ...typography.headingSm,
    fontWeight: '400',
    color: colors.textPrimary,
  },
  inputPlaceholder: {
    ...typography.headingSm,
    fontWeight: '400',
    color: colors.textDisabled,
  },
  textArea: { textAlignVertical: 'top', minHeight: 80 },
  dateConfirm: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
  },
  dateConfirmText: { color: colors.primaryText, fontSize: typography.captionSm.fontSize, fontWeight: '600' },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing['2xl'],
    ...shadows.low,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: colors.white, ...typography.bodyLg, fontWeight: '600' },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgScreen,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.bodyMd.fontSize,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryText: {
    color: colors.primary,
    fontSize: typography.bodyMd.fontSize,
    textDecorationLine: 'underline',
  },
});
