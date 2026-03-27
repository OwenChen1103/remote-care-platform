import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';

// ─── Relationship options (same as add-recipient) ─────────────
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

// ─── Preset medical conditions (same as add-recipient) ────────
const PRESET_MEDICAL_TAGS = [
  '高血壓', '糖尿病', '心臟病', '中風', '腎臟病',
  '肝臟病', '肺部疾病', '癌症', '失智症', '帕金森氏症',
  '骨質疏鬆', '關節炎',
] as const;

interface Recipient {
  id: string;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
  relationship: string | null;
  medical_tags: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  address: string | null;
  notes: string | null;
}

export default function EditRecipientScreen() {
  const { recipientId } = useLocalSearchParams<{ recipientId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [error, setError] = useState('');

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

  const fetchRecipient = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const data = await api.get<Recipient>(`/recipients/${recipientId}`);
      setName(data.name);
      setDateOfBirth(data.date_of_birth ?? '');
      setGender((data.gender as typeof gender) || '');
      setRelationship(data.relationship ?? '');
      setSelectedTags(data.medical_tags);
      setAddress(data.address ?? '');
      setEmergencyName(data.emergency_contact_name ?? '');
      setEmergencyPhone(data.emergency_contact_phone ?? '');
      setNotes(data.notes ?? '');
    } catch (e) {
      if (e instanceof ApiError) {
        setFetchError(e.message);
      } else {
        setFetchError('載入失敗，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  }, [recipientId]);

  useEffect(() => {
    void fetchRecipient();
  }, [fetchRecipient]);

  async function handleSave() {
    if (!name.trim()) {
      setError('姓名為必填');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const data: Record<string, unknown> = { name: name.trim() };
      data.date_of_birth = dateOfBirth.trim() || null;
      data.gender = gender || null;
      data.relationship = relationship || null;
      data.medical_tags = selectedTags;
      data.address = address.trim() || null;
      data.emergency_contact_name = emergencyName.trim() || null;
      data.emergency_contact_phone = emergencyPhone.trim() || null;
      data.notes = notes.trim() || null;

      await api.put(`/recipients/${recipientId}`, data);
      Alert.alert('成功', '已更新被照護者資料', [{ text: '確定', onPress: () => router.back() }]);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('更新失敗，請稍後再試');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{fetchError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void fetchRecipient()}>
          <Text style={styles.retryText}>重試</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>編輯被照護者</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>姓名 *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="例：王奶奶" />

      <Text style={styles.label}>生日</Text>
      <TextInput
        style={styles.input}
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        placeholder="YYYY-MM-DD"
      />

      <Text style={styles.label}>性別</Text>
      <View style={styles.genderRow}>
        {(['male', 'female', 'other'] as const).map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.genderButton, gender === g && styles.genderActive]}
            onPress={() => setGender(g)}
          >
            <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
              {g === 'male' ? '男' : g === 'female' ? '女' : '其他'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>與您的關係</Text>
      <View style={styles.tagGrid}>
        {RELATIONSHIP_OPTIONS.map(({ value, label }) => {
          const active = relationship === value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.tagChip, active && styles.tagChipActive]}
              onPress={() => setRelationship(active ? '' : value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>疾病標籤</Text>
      <View style={styles.tagGrid}>
        {PRESET_MEDICAL_TAGS.map((tag) => {
          const active = selectedTags.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.tagChip, active && styles.tagChipActive]}
              onPress={() => toggleTag(tag)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                {tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Custom tags */}
      {selectedTags.filter((t) => !(PRESET_MEDICAL_TAGS as readonly string[]).includes(t)).length > 0 && (
        <View style={styles.customTagRow}>
          {selectedTags
            .filter((t) => !(PRESET_MEDICAL_TAGS as readonly string[]).includes(t))
            .map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tagChip, styles.tagChipActive]}
                onPress={() => toggleTag(t)}
              >
                <Text style={styles.tagChipTextActive}>{t} ✕</Text>
              </TouchableOpacity>
            ))}
        </View>
      )}

      <View style={styles.customInputRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={customTagInput}
          onChangeText={setCustomTagInput}
          placeholder="其他病史（手動輸入）"
          returnKeyType="done"
          onSubmitEditing={addCustomTag}
        />
        <TouchableOpacity
          style={styles.addTagBtn}
          onPress={addCustomTag}
          disabled={!customTagInput.trim()}
        >
          <Text style={[styles.addTagBtnText, !customTagInput.trim() && { opacity: 0.4 }]}>新增</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>緊急聯絡人姓名</Text>
      <TextInput style={styles.input} value={emergencyName} onChangeText={setEmergencyName} />

      <Text style={styles.label}>緊急聯絡人電話</Text>
      <TextInput
        style={styles.input}
        value={emergencyPhone}
        onChangeText={setEmergencyPhone}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>居住地址</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="選填"
      />

      <Text style={styles.label}>備註</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity
        style={[styles.submitButton, saving && styles.submitDisabled]}
        onPress={() => void handleSave()}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  customTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  customInputRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
  tagChip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: colors.bgSurface,
  },
  tagChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primaryText },
  tagChipText: { fontSize: typography.bodyMd.fontSize, color: colors.textTertiary, fontWeight: '500' },
  tagChipTextActive: { color: colors.primaryText, fontWeight: '600', fontSize: typography.bodyMd.fontSize },
  addTagBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.primaryLight, borderRadius: radius.sm,
  },
  addTagBtnText: { color: colors.primaryText, fontWeight: '600', fontSize: typography.bodyMd.fontSize },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  genderActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  genderText: { color: '#374151', fontWeight: '500' },
  genderTextActive: { color: '#fff' },
  error: { color: '#dc2626', backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, textAlign: 'center', marginBottom: 12, fontSize: 14, overflow: 'hidden' },
  errorText: { fontSize: 14, color: '#dc2626', backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, textAlign: 'center', marginBottom: 12, overflow: 'hidden' },
  retryButton: { backgroundColor: '#3b82f6', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
