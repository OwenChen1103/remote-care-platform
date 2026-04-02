import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';

// ─── Relationship options (client-requested dropdown) ─────────
const RELATIONSHIP_OPTIONS = [
  { value: 'father', label: '父親' },
  { value: 'mother', label: '母親' },
  { value: 'grandfather', label: '祖父' },
  { value: 'grandmother', label: '祖母' },
  { value: 'spouse', label: '配偶' },
  { value: 'sibling', label: '兄弟姊妹' },
  { value: 'child', label: '子女' },
  { value: 'other', label: '其他' },
] as const;

// ─── Preset medical conditions (client-requested dropdown) ────
const PRESET_MEDICAL_TAGS = [
  '高血壓', '糖尿病', '心臟病', '中風', '腎臟病',
  '肝臟病', '肺部疾病', '癌症', '失智症', '帕金森氏症',
  '骨質疏鬆', '關節炎',
] as const;

// ─── Component ────────────────────────────────────────────────

export default function AddRecipientScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [relationship, setRelationship] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [notes, setNotes] = useState('');
  // ─── Lifestyle habits ─────────────────────────────────────
  const [waterIntake, setWaterIntake] = useState('');
  const [exerciseFrequency, setExerciseFrequency] = useState('');
  const [exerciseIntensity, setExerciseIntensity] = useState('');
  const [starchIntake, setStarchIntake] = useState('');
  const [proteinIntake, setProteinIntake] = useState('');
  const [managerFillLifestyle, setManagerFillLifestyle] = useState(false);

  // ─── Medical tags manager fill ────────────────────────────
  const [managerFillMedical, setManagerFillMedical] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function addCustomTag() {
    const tag = customTagInput.trim();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag]);
    }
    setCustomTagInput('');
  }

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
      if (relationship) data.relationship = relationship;
      if (selectedTags.length > 0) {
        data.medical_tags = selectedTags;
      }
      if (managerFillMedical) {
        data.medical_tags = [...(selectedTags), '__manager_fill__'];
      }
      // Lifestyle habits
      const lifestylePayload: Record<string, unknown> = {};
      if (managerFillLifestyle) {
        lifestylePayload.manager_fill = true;
      } else {
        if (waterIntake.trim()) lifestylePayload.water_intake = waterIntake.trim();
        if (exerciseFrequency.trim()) lifestylePayload.exercise_frequency = exerciseFrequency.trim();
        if (exerciseIntensity.trim()) lifestylePayload.exercise_intensity = exerciseIntensity.trim();
        if (starchIntake.trim()) lifestylePayload.starch_intake = starchIntake.trim();
        if (proteinIntake.trim()) lifestylePayload.protein_intake = proteinIntake.trim();
      }
      if (Object.keys(lifestylePayload).length > 0) {
        data.lifestyle_habits = lifestylePayload;
      }
      if (address.trim()) data.address = address.trim();
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

          <Text style={styles.label}>與您的關係</Text>
          <View style={styles.tagGrid}>
            {RELATIONSHIP_OPTIONS.map(({ value, label }) => {
              const active = relationship === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setRelationship(active ? '' : value)}
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
          <View style={styles.tagGrid}>
            {PRESET_MEDICAL_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleTag(tag)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom tags already added */}
          {selectedTags.filter((t) => !(PRESET_MEDICAL_TAGS as readonly string[]).includes(t)).length > 0 && (
            <View style={styles.customTagRow}>
              {selectedTags
                .filter((t) => !(PRESET_MEDICAL_TAGS as readonly string[]).includes(t))
                .map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, styles.chipActive]}
                    onPress={() => toggleTag(t)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: true }}
                  >
                    <Text style={styles.chipTextActive}>{t} ✕</Text>
                  </TouchableOpacity>
                ))}
            </View>
          )}

          {/* Custom input */}
          <View style={styles.customTagInputRow}>
            <TextInput
              style={[styles.input, styles.customTagField]}
              value={customTagInput}
              onChangeText={setCustomTagInput}
              placeholder="其他病史（手動輸入）"
              placeholderTextColor={colors.textDisabled}
              returnKeyType="done"
              onSubmitEditing={addCustomTag}
              accessibilityLabel="自定義疾病標籤"
            />
            <TouchableOpacity
              style={styles.addTagButton}
              onPress={addCustomTag}
              disabled={!customTagInput.trim()}
              accessibilityLabel="新增自定義標籤"
            >
              <Text style={[styles.addTagText, !customTagInput.trim() && styles.addTagDisabled]}>新增</Text>
            </TouchableOpacity>
          </View>

          {/* Manager fill switch — medical */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>讓健康管家幫忙填寫病史</Text>
            <Switch
              value={managerFillMedical}
              onValueChange={setManagerFillMedical}
              trackColor={{ false: colors.borderStrong, true: colors.primaryLight }}
              thumbColor={managerFillMedical ? colors.primary : colors.bgSurfaceAlt}
              accessibilityLabel="讓健康管家幫忙填寫病史"
            />
          </View>
        </View>

        {/* ── Section: Lifestyle Habits ───────────────────── */}
        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>生活習慣</Text>

          {/* Manager fill switch — lifestyle */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>讓健康管家幫忙填寫</Text>
            <Switch
              value={managerFillLifestyle}
              onValueChange={setManagerFillLifestyle}
              trackColor={{ false: colors.borderStrong, true: colors.primaryLight }}
              thumbColor={managerFillLifestyle ? colors.primary : colors.bgSurfaceAlt}
              accessibilityLabel="讓健康管家幫忙填寫生活習慣"
            />
          </View>

          <Text style={styles.label}>每日喝水量</Text>
          <TextInput
            style={[styles.input, managerFillLifestyle && styles.inputDisabled]}
            value={waterIntake}
            onChangeText={setWaterIntake}
            placeholder="例：2000ml"
            placeholderTextColor={colors.textDisabled}
            editable={!managerFillLifestyle}
            accessibilityLabel="每日喝水量"
          />

          <Text style={styles.label}>運動頻次</Text>
          <TextInput
            style={[styles.input, managerFillLifestyle && styles.inputDisabled]}
            value={exerciseFrequency}
            onChangeText={setExerciseFrequency}
            placeholder="例：每週3次"
            placeholderTextColor={colors.textDisabled}
            editable={!managerFillLifestyle}
            accessibilityLabel="運動頻次"
          />

          <Text style={styles.label}>運動強度</Text>
          <TextInput
            style={[styles.input, managerFillLifestyle && styles.inputDisabled]}
            value={exerciseIntensity}
            onChangeText={setExerciseIntensity}
            placeholder="例：低強度散步"
            placeholderTextColor={colors.textDisabled}
            editable={!managerFillLifestyle}
            accessibilityLabel="運動強度"
          />

          <Text style={styles.label}>澱粉補充量</Text>
          <TextInput
            style={[styles.input, managerFillLifestyle && styles.inputDisabled]}
            value={starchIntake}
            onChangeText={setStarchIntake}
            placeholder="例：每日半碗飯"
            placeholderTextColor={colors.textDisabled}
            editable={!managerFillLifestyle}
            accessibilityLabel="澱粉補充量"
          />

          <Text style={styles.label}>蛋白質補充量</Text>
          <TextInput
            style={[styles.input, managerFillLifestyle && styles.inputDisabled]}
            value={proteinIntake}
            onChangeText={setProteinIntake}
            placeholder="例：每日一顆蛋"
            placeholderTextColor={colors.textDisabled}
            editable={!managerFillLifestyle}
            accessibilityLabel="蛋白質補充量"
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

        {/* ── Section: Address ───────────────────────────── */}
        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>居住地址</Text>

          <Text style={styles.label}>地址</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="選填"
            placeholderTextColor={colors.textDisabled}
            accessibilityLabel="居住地址"
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

  // ─── Tag Grid (Medical) ──────────────────────────────────
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  customTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  customTagInputRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
  customTagField: { flex: 1 },
  addTagButton: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.primaryLight, borderRadius: radius.sm,
  },
  addTagText: { color: colors.primaryText, fontWeight: '600', fontSize: typography.bodyMd.fontSize },
  addTagDisabled: { opacity: 0.4 },

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

  // ─── Switch Row ───────────────────────────────────────────
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
  },
  switchLabel: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.primaryText,
    flex: 1,
    marginRight: spacing.md,
  },

  // ─── Disabled input ───────────────────────────────────────
  inputDisabled: {
    opacity: 0.45,
    backgroundColor: colors.bgSurfaceAlt,
  },

  // ─── Submit ───────────────────────────────────────────────
  submitButton: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: spacing.lg - spacing.xxs, alignItems: 'center',
    marginTop: spacing.sm,
    ...shadows.high,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontSize: typography.bodyLg.fontSize, fontWeight: '600' },
});
