import { useState } from 'react';
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
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';

export default function AddAppointmentScreen() {
  const { recipientId } = useLocalSearchParams<{ recipientId: string }>();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [department, setDepartment] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '請輸入行程標題');
      return;
    }
    if (!dateStr.trim()) {
      Alert.alert('提示', '請輸入就診日期（格式：YYYY-MM-DD）');
      return;
    }
    if (!recipientId) {
      Alert.alert('錯誤', '缺少被照護者資訊');
      return;
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr.trim())) {
      Alert.alert('提示', '日期格式不正確，請使用 YYYY-MM-DD 格式');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/appointments', {
        recipient_id: recipientId,
        title: title.trim(),
        hospital_name: hospitalName.trim() || undefined,
        department: department.trim() || undefined,
        doctor_name: doctorName.trim() || undefined,
        appointment_date: new Date(dateStr.trim()).toISOString(),
        note: note.trim() || undefined,
      });

      Alert.alert('成功', '行程已新增', [
        { text: '確定', onPress: () => router.back() },
      ]);
    } catch (err) {
      if (err instanceof ApiError) {
        Alert.alert('錯誤', err.message);
      } else {
        Alert.alert('錯誤', '新增失敗，請稍後再試');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Default date hint: 7 days from now
  const defaultHint = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>新增就醫行程</Text>

      {/* Card 1 — 基本資訊 */}
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
        <TextInput
          style={styles.input}
          value={dateStr}
          onChangeText={setDateStr}
          placeholder={`格式：${defaultHint}`}
          placeholderTextColor={colors.textDisabled}
          keyboardType={Platform.OS === 'ios' ? 'default' : 'default'}
        />

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

      {/* Card 2 — 備註 */}
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
        <Text style={styles.submitText}>{submitting ? '新增中...' : '新增行程'}</Text>
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
    ...typography.headingSm,
    fontWeight: '400',
    color: colors.textPrimary,
  },
  textArea: { textAlignVertical: 'top', minHeight: 80 },
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
});
