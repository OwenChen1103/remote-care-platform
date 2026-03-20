import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';

// ─── Component ────────────────────────────────────────────────

export default function AddRecipientScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [medicalTags, setMedicalTags] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!name.trim()) {
      setError('姓名為必填');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data: Record<string, unknown> = { name: name.trim() };
      if (dateOfBirth.trim()) data.date_of_birth = dateOfBirth.trim();
      if (gender) data.gender = gender;
      if (medicalTags.trim()) {
        data.medical_tags = medicalTags.split(',').map((t) => t.trim()).filter(Boolean);
      }
      if (emergencyName.trim()) data.emergency_contact_name = emergencyName.trim();
      if (emergencyPhone.trim()) data.emergency_contact_phone = emergencyPhone.trim();
      if (notes.trim()) data.notes = notes.trim();

      await api.post('/recipients', data);
      router.back();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('新增失敗，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      {/* ── Header Zone ──────────────────────────────────────── */}
      <View style={styles.headerZone}>
        <Text style={styles.title}>新增被照護者</Text>
        <Text style={styles.subtitle}>填寫基本資料，即可開始記錄健康數據。</Text>
      </View>

      <View style={styles.content}>
        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Section: Basic Info ─────────────────────────── */}
        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>基本資料</Text>

          <Text style={styles.label}>姓名 *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="例：王奶奶"
            placeholderTextColor={colors.textDisabled}
            accessibilityLabel="姓名"
          />

          <Text style={styles.label}>生日</Text>
          <TextInput
            style={styles.input}
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="YYYY-MM-DD（選填）"
            placeholderTextColor={colors.textDisabled}
            accessibilityLabel="生日"
          />

          <Text style={styles.label}>性別</Text>
          <View style={styles.chipRow}>
            {([
              { value: 'male' as const, label: '男' },
              { value: 'female' as const, label: '女' },
              { value: 'other' as const, label: '其他' },
            ]).map(({ value, label }) => {
              const active = gender === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setGender(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Section: Medical Info ───────────────────────── */}
        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>健康資訊</Text>

          <Text style={styles.label}>疾病標籤</Text>
          <TextInput
            style={styles.input}
            value={medicalTags}
            onChangeText={setMedicalTags}
            placeholder="例：高血壓,糖尿病（以逗號分隔）"
            placeholderTextColor={colors.textDisabled}
            accessibilityLabel="疾病標籤"
          />
        </View>

        {/* ── Section: Emergency Contact ──────────────────── */}
        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>緊急聯絡人</Text>

          <Text style={styles.label}>姓名</Text>
          <TextInput
            style={styles.input}
            value={emergencyName}
            onChangeText={setEmergencyName}
            placeholder="選填"
            placeholderTextColor={colors.textDisabled}
            accessibilityLabel="緊急聯絡人姓名"
          />

          <Text style={styles.label}>電話</Text>
          <TextInput
            style={styles.input}
            value={emergencyPhone}
            onChangeText={setEmergencyPhone}
            keyboardType="phone-pad"
            placeholder="選填"
            placeholderTextColor={colors.textDisabled}
            accessibilityLabel="緊急聯絡人電話"
          />
        </View>

        {/* ── Section: Notes ──────────────────────────────── */}
        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>備註</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="選填"
            placeholderTextColor={colors.textDisabled}
            textAlignVertical="top"
            accessibilityLabel="備註"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitDisabled]}
          onPress={() => void handleSubmit()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={loading ? '新增中' : '新增被照護者'}
        >
          <Text style={styles.submitText}>{loading ? '新增中...' : '新增'}</Text>
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
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    ...shadows.low,
  },
  title: { fontSize: typography.headingMd.fontSize, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary, marginTop: spacing.xs },
  content: { padding: spacing.lg },

  // ─── Error ────────────────────────────────────────────────
  errorBox: {
    backgroundColor: colors.dangerLight, borderRadius: radius.sm,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  errorText: { color: colors.danger, fontSize: typography.bodyMd.fontSize, textAlign: 'center' },

  // ─── Form Card (section grouping) ─────────────────────────
  formCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.low,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '500', color: colors.textDisabled,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.md,
  },

  // ─── Form Fields ──────────────────────────────────────────
  label: {
    fontSize: typography.bodyMd.fontSize, fontWeight: '600', color: colors.textSecondary,
    marginBottom: spacing.sm, marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.bgScreen, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.sm, padding: spacing.md, fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  // ─── Chips (Gender) ───────────────────────────────────────
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + spacing.xxs,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: colors.bgSurface,
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primaryText },
  chipText: { fontSize: typography.bodyMd.fontSize, color: colors.textTertiary, fontWeight: '500' },
  chipTextActive: { color: colors.primaryText, fontWeight: '600' },

  // ─── Submit ───────────────────────────────────────────────
  submitButton: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.lg - spacing.xxs, alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontSize: typography.bodyLg.fontSize, fontWeight: '600' },
});
