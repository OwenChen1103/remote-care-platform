import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

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

interface LifestyleHabits {
  water_intake?: string;
  exercise_frequency?: string;
  exercise_intensity?: string;
  starch_intake?: string;
  protein_intake?: string;
  manager_fill?: boolean;
}

interface Recipient {
  id: string;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
  relationship: string | null;
  medical_tags: string[];
  // Lifestyle JSON column — RecipientResponseSchema returns `{}` when unset (never undefined).
  // Field shape mirrors RecipientCreateSchema.lifestyle_habits in shared package.
  lifestyle_habits: LifestyleHabits;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  address: string | null;
  notes: string | null;
  // Section 1.7.2: surfaced binding info — populated when recipient.patient_user_id is set.
  patient_user_id: string | null;
  patient_user_email: string | null;
  patient_user_name: string | null;
}

// ─── Section icons ────────────────────────────────────────────

function IconUser() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={colors.primary} strokeWidth={1.8} />
      <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconHeart() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s-7-4.5-7-11a4 4 0 017-2.5A4 4 0 0119 10c0 6.5-7 11-7 11z" stroke={colors.danger} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconLeaf() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M21 3c-9 0-15 6-15 13M21 3c0 7-6 13-13 13H4v-3c0-9 7-13 17-13z" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconLink() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconPhone() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke={colors.warning} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconLocation() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={colors.primary} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx="12" cy="10" r="3" stroke={colors.primary} strokeWidth={1.8} />
    </Svg>
  );
}
function IconNote() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" stroke={colors.textTertiary} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M14 3v6h6M8 13h8M8 17h5" stroke={colors.textTertiary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconCalendar() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={colors.textTertiary} strokeWidth={1.8} />
      <Path d="M3 9h18M8 3v4M16 3v4" stroke={colors.textTertiary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [relationship, setRelationship] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [notes, setNotes] = useState('');
  // Lifestyle habits — mirror add-recipient.tsx state shape so save serialization is identical.
  const [waterIntake, setWaterIntake] = useState('');
  const [exerciseFrequency, setExerciseFrequency] = useState('');
  const [exerciseIntensity, setExerciseIntensity] = useState('');
  const [starchIntake, setStarchIntake] = useState('');
  const [proteinIntake, setProteinIntake] = useState('');
  const [managerFillLifestyle, setManagerFillLifestyle] = useState(false);
  // Section 1.7.2: patient binding state. `boundEmail` snapshots the server-side current
  // binding for diffing on save (knowing whether to send `null` for explicit unbind).
  const [patientEmail, setPatientEmail] = useState('');
  const [boundEmail, setBoundEmail] = useState<string | null>(null);
  const [boundName, setBoundName] = useState<string | null>(null);
  // Section 4.2.3: destructive zone state.
  const [deleting, setDeleting] = useState(false);

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
      // Lifestyle hydration — `data.lifestyle_habits` is always object (default {}),
      // so optional chaining + nullish coalesce on each field is safe.
      const lh = data.lifestyle_habits ?? {};
      setWaterIntake(lh.water_intake ?? '');
      setExerciseFrequency(lh.exercise_frequency ?? '');
      setExerciseIntensity(lh.exercise_intensity ?? '');
      setStarchIntake(lh.starch_intake ?? '');
      setProteinIntake(lh.protein_intake ?? '');
      setManagerFillLifestyle(lh.manager_fill === true);
      // Patient binding hydration (Section 1.7.2)
      setBoundEmail(data.patient_user_email);
      setBoundName(data.patient_user_name);
      setPatientEmail(data.patient_user_email ?? '');
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
      // Lifestyle serialization — mirrors add-recipient.tsx pattern for parity.
      // Manager-fill toggle short-circuits the 5 detail fields (server stores either form).
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
      // Always send (could be {}) — server overwrites the column, allowing user to clear all fields.
      data.lifestyle_habits = lifestylePayload;
      data.address = address.trim() || null;
      data.emergency_contact_name = emergencyName.trim() || null;
      data.emergency_contact_phone = emergencyPhone.trim() || null;
      data.notes = notes.trim() || null;
      // Patient binding update semantics (Section 1.7.2):
      //   - Email entered → server resolves & binds (or returns typed error)
      //   - Email cleared but was previously bound → send null for explicit unbind
      //   - Email empty AND wasn't bound → omit field (no change)
      const trimmedEmail = patientEmail.trim().toLowerCase();
      if (trimmedEmail) {
        data.patient_user_email = trimmedEmail;
      } else if (boundEmail) {
        data.patient_user_email = null;
      }

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

  // Section 4.2.3: soft-delete recipient (server-side guards against in-flight SR).
  function confirmDelete() {
    Alert.alert(
      '刪除被照護者',
      `確定要刪除「${name}」？此動作無法復原。量測紀錄會保留但不可訪問，已建立的服務需求需先完成或取消。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.delete(`/recipients/${recipientId}`);
              Alert.alert('已刪除', '已將此被照護者從列表中移除', [
                { text: '確定', onPress: () => router.replace('/(tabs)/home') },
              ]);
            } catch (e) {
              if (e instanceof ApiError) Alert.alert('無法刪除', e.message);
              else Alert.alert('錯誤', '刪除失敗，請稍後再試');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  if (loading) return <LoadingScreen />;

  if (fetchError) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{fetchError}</Text>
        <TouchableOpacity style={s.retryButton} onPress={() => void fetchRecipient()} activeOpacity={0.7}>
          <Text style={s.retryText}>重試</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initial = name.charAt(0) || '?';
  const formattedDob = dateOfBirth
    ? new Date(dateOfBirth).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const dobValue = dateOfBirth ? new Date(dateOfBirth) : new Date(1950, 0, 1);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* ── Hero Card — recipient avatar + name ─────────────── */}
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
          <View style={s.avatarBig}>
            <Text style={s.avatarBigText}>{initial}</Text>
          </View>
          <Text style={s.heroTitle}>編輯 {name || '被照護者'} 的資料</Text>
          <Text style={s.heroSubtitle}>更新基本資訊、健康狀態與聯絡資料</Text>
        </View>
      </View>

      {error ? (
        <View style={s.errorBox}>
          <Text style={s.errorBoxText}>{error}</Text>
        </View>
      ) : null}

      {/* ── Section: Basic Info ──────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconUser />
        <Text style={s.sectionTitle}>基本資料</Text>
      </View>
      <View style={s.card}>
        <View style={s.field}>
          <Text style={s.fieldLabel}>姓名 <Text style={s.required}>*</Text></Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="例：王奶奶"
            placeholderTextColor={colors.textDisabled}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>生日</Text>
          <TouchableOpacity style={s.input} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
            <View style={s.dateRow}>
              <Text style={[s.inputText, !formattedDob && { color: colors.textDisabled }]}>
                {formattedDob || '選擇生日（選填）'}
              </Text>
              <IconCalendar />
            </View>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={dobValue}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selected) => {
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (selected) {
                  const yyyy = selected.getFullYear();
                  const mm = String(selected.getMonth() + 1).padStart(2, '0');
                  const dd = String(selected.getDate()).padStart(2, '0');
                  setDateOfBirth(`${yyyy}-${mm}-${dd}`);
                }
              }}
              maximumDate={new Date()}
            />
          )}
          {Platform.OS === 'ios' && showDatePicker && (
            <TouchableOpacity style={s.dateConfirm} onPress={() => setShowDatePicker(false)} activeOpacity={0.7}>
              <Text style={s.dateConfirmText}>完成</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[s.field, { marginBottom: 0 }]}>
          <Text style={s.fieldLabel}>性別</Text>
          <View style={s.chipRow}>
            {([
              { value: 'male' as const, label: '男' },
              { value: 'female' as const, label: '女' },
              { value: 'other' as const, label: '其他' },
            ]).map(({ value, label }) => {
              const active = gender === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setGender(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── Section: Relationship ────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconLink />
        <Text style={s.sectionTitle}>與您的關係</Text>
      </View>
      <View style={s.card}>
        <View style={[s.field, { marginBottom: 0 }]}>
          <View style={s.tagGrid}>
            {RELATIONSHIP_OPTIONS.map(({ value, label }) => {
              const active = relationship === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setRelationship(active ? '' : value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── Section: Patient Account Binding (Section 1.7.2) ───── */}
      <View style={s.sectionHeader}>
        <IconLink />
        <Text style={s.sectionTitle}>連結被照護者帳號</Text>
      </View>
      <View style={s.card}>
        {boundEmail ? (
          <View style={s.bindingPill}>
            <Text style={s.bindingPillLabel}>已連結</Text>
            <Text style={s.bindingPillBody}>
              {boundName ?? '(無名稱)'}（{boundEmail}）
            </Text>
            <Text style={s.bindingPillHint}>
              清空下方欄位並儲存可解除連結。
            </Text>
          </View>
        ) : (
          <Text style={s.helperHint}>
            若被照護者本人也想用 App 查看自己的健康資料，請輸入他/她的註冊 Email。對方需先以「被照護者」角色註冊。
          </Text>
        )}
        <TextInput
          style={[s.input, { marginTop: spacing.sm }]}
          value={patientEmail}
          onChangeText={setPatientEmail}
          placeholder="patient@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          accessibilityLabel="被照護者 Email"
        />
      </View>

      {/* ── Section: Medical Info ────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconHeart />
        <Text style={s.sectionTitle}>健康資訊</Text>
      </View>
      <View style={s.card}>
        <View style={[s.field, { marginBottom: 0 }]}>
          <Text style={s.fieldLabel}>疾病標籤</Text>
          <View style={s.tagGrid}>
            {PRESET_MEDICAL_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => toggleTag(tag)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedTags.filter((t) => !(PRESET_MEDICAL_TAGS as readonly string[]).includes(t)).length > 0 && (
            <View style={s.customTagRow}>
              {selectedTags
                .filter((t) => !(PRESET_MEDICAL_TAGS as readonly string[]).includes(t))
                .map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.chip, s.chipActive]}
                    onPress={() => toggleTag(t)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.chipTextActive}>{t} ✕</Text>
                  </TouchableOpacity>
                ))}
            </View>
          )}

          <View style={s.customTagInputRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={customTagInput}
              onChangeText={setCustomTagInput}
              placeholder="其他病史（手動輸入）"
              placeholderTextColor={colors.textDisabled}
              returnKeyType="done"
              onSubmitEditing={addCustomTag}
            />
            <TouchableOpacity
              style={[s.addTagButton, !customTagInput.trim() && { opacity: 0.4 }]}
              onPress={addCustomTag}
              disabled={!customTagInput.trim()}
              activeOpacity={0.7}
            >
              <Text style={s.addTagText}>新增</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Section: Lifestyle Habits ────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconLeaf />
        <Text style={s.sectionTitle}>生活習慣</Text>
      </View>
      <View style={s.card}>
        <View style={s.helperRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.helperTitle}>讓健康管家幫忙填寫</Text>
            <Text style={s.helperHint}>不確定怎麼填？我們可以協助您完成</Text>
          </View>
          <Switch
            value={managerFillLifestyle}
            onValueChange={setManagerFillLifestyle}
            trackColor={{ false: colors.borderStrong, true: colors.accent }}
            thumbColor={colors.white}
            accessibilityLabel="讓健康管家幫忙填寫生活習慣"
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>每日喝水量</Text>
          <TextInput
            style={[s.input, managerFillLifestyle && s.inputDisabled]}
            value={waterIntake}
            onChangeText={setWaterIntake}
            placeholder="例：2000ml"
            placeholderTextColor={colors.textDisabled}
            editable={!managerFillLifestyle}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>運動頻次</Text>
          <TextInput
            style={[s.input, managerFillLifestyle && s.inputDisabled]}
            value={exerciseFrequency}
            onChangeText={setExerciseFrequency}
            placeholder="例：每週3次"
            placeholderTextColor={colors.textDisabled}
            editable={!managerFillLifestyle}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>運動強度</Text>
          <TextInput
            style={[s.input, managerFillLifestyle && s.inputDisabled]}
            value={exerciseIntensity}
            onChangeText={setExerciseIntensity}
            placeholder="例：低強度散步"
            placeholderTextColor={colors.textDisabled}
            editable={!managerFillLifestyle}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>澱粉補充量</Text>
          <TextInput
            style={[s.input, managerFillLifestyle && s.inputDisabled]}
            value={starchIntake}
            onChangeText={setStarchIntake}
            placeholder="例：每日半碗飯"
            placeholderTextColor={colors.textDisabled}
            editable={!managerFillLifestyle}
          />
        </View>

        <View style={[s.field, { marginBottom: 0 }]}>
          <Text style={s.fieldLabel}>蛋白質補充量</Text>
          <TextInput
            style={[s.input, managerFillLifestyle && s.inputDisabled]}
            value={proteinIntake}
            onChangeText={setProteinIntake}
            placeholder="例：每日一顆蛋"
            placeholderTextColor={colors.textDisabled}
            editable={!managerFillLifestyle}
          />
        </View>
      </View>

      {/* ── Section: Primary Contact (PDF p2 (5)「聯絡方式」) ──
          Schema columns remain `emergency_contact_*`; G11 is a UI label rename only. */}
      <View style={s.sectionHeader}>
        <IconPhone />
        <Text style={s.sectionTitle}>主要聯絡人</Text>
      </View>
      <View style={s.card}>
        <View style={s.field}>
          <Text style={s.fieldLabel}>姓名</Text>
          <TextInput
            style={s.input}
            value={emergencyName}
            onChangeText={setEmergencyName}
            placeholder="選填"
            placeholderTextColor={colors.textDisabled}
          />
        </View>
        <View style={[s.field, { marginBottom: 0 }]}>
          <Text style={s.fieldLabel}>電話</Text>
          <TextInput
            style={s.input}
            value={emergencyPhone}
            onChangeText={setEmergencyPhone}
            keyboardType="phone-pad"
            placeholder="選填"
            placeholderTextColor={colors.textDisabled}
          />
        </View>
      </View>

      {/* ── Section: Address ─────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconLocation />
        <Text style={s.sectionTitle}>居住地址</Text>
      </View>
      <View style={s.card}>
        <View style={[s.field, { marginBottom: 0 }]}>
          <TextInput
            style={s.input}
            value={address}
            onChangeText={setAddress}
            placeholder="選填"
            placeholderTextColor={colors.textDisabled}
          />
        </View>
      </View>

      {/* ── Section: Notes ───────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconNote />
        <Text style={s.sectionTitle}>備註</Text>
      </View>
      <View style={s.card}>
        <View style={[s.field, { marginBottom: 0 }]}>
          <TextInput
            style={[s.input, s.textArea]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="選填"
            placeholderTextColor={colors.textDisabled}
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* ── Submit ───────────────────────────────────────────── */}
      <TouchableOpacity
        style={[s.submitWrap, saving && { opacity: 0.6 }]}
        onPress={() => void handleSave()}
        disabled={saving}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={saving ? '儲存中' : '儲存變更'}
      >
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.submitBtn}
        >
          <Text style={s.submitText}>{saving ? '儲存中...' : '儲存變更'}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Danger Zone (Section 4.2.3) ──────────────────────── */}
      <View style={s.dangerZone}>
        <Text style={s.dangerLabel}>危險區域</Text>
        <TouchableOpacity
          style={[s.deleteBtn, deleting && { opacity: 0.6 }]}
          onPress={() => confirmDelete()}
          activeOpacity={0.85}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="刪除被照護者"
        >
          <Text style={s.deleteBtnText}>{deleting ? '刪除中...' : '刪除被照護者'}</Text>
        </TouchableOpacity>
        <Text style={s.dangerHint}>
          刪除後將不再顯示此被照護者，量測紀錄會保留但不可訪問。如有進行中的服務需求，需先完成或取消。
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] + spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bgScreen },

  // ─── Hero Card ────────────────────────────────────────────
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(46,141,201,0.12)',
    marginBottom: spacing.sm,
  },
  heroHaloTopRight: {
    position: 'absolute',
    top: -40, right: -50,
    width: 180, height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  heroHaloBottomLeft: {
    position: 'absolute',
    bottom: -50, left: -30,
    width: 160, height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  heroContent: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  avatarBig: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.bgSurface,
    borderWidth: 2, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarBigText: { fontSize: 26, fontWeight: '700', color: colors.primaryText },
  heroTitle: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  heroSubtitle: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
    textAlign: 'center',
  },

  // ─── Error ────────────────────────────────────────────────
  errorBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1, borderColor: 'rgba(217,83,79,0.2)',
  },
  errorBoxText: { color: colors.danger, fontSize: typography.bodySm.fontSize, textAlign: 'center' },
  errorText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.danger,
    backgroundColor: colors.dangerLight,
    padding: spacing.md,
    borderRadius: radius.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryText: { color: colors.white, fontWeight: '600' },

  // ─── Section header (above each card) ─────────────────────
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

  // ─── Card ─────────────────────────────────────────────────
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
  },

  // ─── Field ────────────────────────────────────────────────
  field: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  required: { color: colors.danger },
  input: {
    backgroundColor: colors.bgScreen,
    borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md + 2,
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
    minHeight: 46,
    justifyContent: 'center',
  },
  inputText: { fontSize: typography.bodyMd.fontSize, color: colors.textPrimary },
  inputDisabled: {
    opacity: 0.45,
    backgroundColor: colors.bgSurfaceAlt,
  },
  textArea: { minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.md },

  // Manager-fill row (used in 生活習慣 section, mirrors add-recipient.tsx)
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  helperTitle: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.secondaryText,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateConfirm: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
  },
  dateConfirmText: { color: colors.primaryText, fontSize: typography.captionSm.fontSize, fontWeight: '600' },

  // ─── Chips ────────────────────────────────────────────────
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
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

  // ─── Custom tag ───────────────────────────────────────────
  customTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  customTagInputRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
  addTagButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
  },
  addTagText: { color: colors.primaryText, fontWeight: '600', fontSize: typography.bodyMd.fontSize },

  // ─── Submit ───────────────────────────────────────────────
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

  // Patient binding (Section 1.7.2)
  helperHint: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  bindingPill: {
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  bindingPillLabel: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bindingPillBody: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  bindingPillHint: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    marginTop: 4,
  },

  // Danger zone (Section 4.2.3)
  dangerZone: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerLight,
    backgroundColor: colors.dangerLight,
  },
  dangerLabel: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
    color: colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  deleteBtn: {
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
  },
  dangerHint: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});
