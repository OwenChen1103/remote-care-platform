/**
 * Provider self-edit (G7).
 *
 * Pushed from `provider-profile.tsx` via "編輯個人資料" button (post-onboarding view only —
 * onboarding-stage providers use the full form embedded in provider-profile.tsx).
 *
 * Two backend writes:
 *   1. PUT /provider/me  → phone, education, specialties, certifications, experience_years,
 *                          service_areas, available_services, available_schedule, schedule_note
 *   2. PUT /auth/me      → date_of_birth, address (these live on User, not Provider)
 *
 * Partial-success pattern (mirrors provider-profile onboarding submit): if /provider/me succeeds
 * but /auth/me fails, surface a clear partial-success Alert so user knows which side missed.
 *
 * Certifications field uses ';' as a separator between 「相關證照」 / 「其他證照」 (see G5 in
 * MVP_GAPS_IMPLEMENTATION_PLAN.md). Schema stays single-array; UI splits and re-joins.
 *
 * Available schedule: 7 days × 3 slots grid, stored as Record<DayKey, SlotKey[]>.
 * Empty days are omitted from the payload (server treats undefined as "no specific schedule").
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ProviderPhotoUploader } from '@/components/forms/ProviderPhotoUploader';

// ─── Types ─────────────────────────────────────────────────────

interface ProviderProfile {
  id: string;
  name: string;
  review_status: string;
  phone: string;
  // G12: photo_url is owned by Provider table; updates go via POST/DELETE /provider/me/photo
  // (separate endpoint from PUT /provider/me — file upload is multipart, not JSON).
  photo_url: string | null;
  education: string | null;
  experience_years: number | null;
  specialties: string[];
  certifications: string[];
  service_areas: string[];
  available_services: string[];
  available_schedule: Record<string, string[]>;
  schedule_note: string | null;
}

interface UserProfile {
  date_of_birth: string | null;
  address: string | null;
}

// ─── Constants ────────────────────────────────────────────────

const SERVICE_OPTIONS = [
  { code: 'escort_visit',          label: '陪診師' },
  { code: 'functional_assessment', label: '身體功能檢測' },
  { code: 'exercise_program',      label: '運動項目' },
  { code: 'home_cleaning',         label: '打掃清潔' },
  { code: 'pre_visit_consult',     label: '診前諮詢' },
  { code: 'daily_living_support',  label: '生活輔助' },
  { code: 'nutrition_consult',     label: '營養表諮詢' },
  { code: 'shopping_assist',       label: '購物服務' },
] as const;

const DAYS = [
  { key: 'mon', label: '一' },
  { key: 'tue', label: '二' },
  { key: 'wed', label: '三' },
  { key: 'thu', label: '四' },
  { key: 'fri', label: '五' },
  { key: 'sat', label: '六' },
  { key: 'sun', label: '日' },
] as const;

const SLOTS = [
  { key: 'morning',   label: '上午' },
  { key: 'afternoon', label: '下午' },
  { key: 'evening',   label: '晚上' },
] as const;

// ─── Icons ────────────────────────────────────────────────────

function IconUser() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={colors.primary} strokeWidth={1.8} />
      <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconBriefcase() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="7" width="20" height="14" rx="2" stroke={colors.accent} strokeWidth={1.8} />
      <Path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M2 13h20" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" />
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
function IconCalendar() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={colors.textTertiary} strokeWidth={1.8} />
      <Path d="M3 9h18M8 3v4M16 3v4" stroke={colors.textTertiary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconSchedule() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={colors.warning} strokeWidth={1.8} />
      <Path d="M12 7v5l3 2" stroke={colors.warning} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Split a flat certifications array (with optional ';' marker) back into related + other parts.
 * - Before any ';' → related
 * - After first ';' → other
 * - No ';' → all related
 */
function splitCertifications(arr: string[] | undefined): { related: string[]; other: string[] } {
  if (!arr || arr.length === 0) return { related: [], other: [] };
  const sepIdx = arr.indexOf(';');
  if (sepIdx === -1) return { related: arr, other: [] };
  return { related: arr.slice(0, sepIdx), other: arr.slice(sepIdx + 1) };
}

// ─── Component ────────────────────────────────────────────────

export default function ProviderEditScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [error, setError] = useState('');
  const [reviewStatus, setReviewStatus] = useState<string>('approved');
  const [providerId, setProviderId] = useState<string>('');
  const [providerName, setProviderName] = useState<string>('');
  // G12: photo upload is async + separate from form save. State is updated immediately
  // after upload/delete success (server returns updated provider), independent of save button.
  // photoUrl is local state (re-hydrated from server after each upload/delete via the
  // ProviderPhotoUploader callback). photoBusy is owned inside the uploader component.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Provider fields
  const [phone, setPhone] = useState('');
  const [education, setEducation] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [relatedCerts, setRelatedCerts] = useState('');
  const [otherCerts, setOtherCerts] = useState('');
  const [serviceAreas, setServiceAreas] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<Record<string, string[]>>({});
  const [scheduleNote, setScheduleNote] = useState('');

  // User fields (date_of_birth + address live on User, not Provider)
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [address, setAddress] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    // Promise.allSettled (not Promise.all) so a transient /auth/me failure doesn't
    // block the whole edit form. Provider data is required (hard fail); user data
    // (dob/address) is best-effort — fields stay empty if /auth/me rejects.
    const [providerResult, userResult] = await Promise.allSettled([
      api.get<ProviderProfile>('/provider/me'),
      api.get<UserProfile>('/auth/me'),
    ]);

    if (providerResult.status === 'rejected') {
      const e = providerResult.reason;
      setFetchError(e instanceof ApiError ? e.message : '載入失敗，請稍後再試');
      setLoading(false);
      return;
    }

    const provider = providerResult.value;
    setReviewStatus(provider.review_status);
    setProviderId(provider.id);
    setProviderName(provider.name ?? '');
    setPhotoUrl(provider.photo_url ?? null);
    setPhone(provider.phone ?? '');
    setEducation(provider.education ?? '');
    setExperienceYears(provider.experience_years != null ? String(provider.experience_years) : '');
    setSpecialties((provider.specialties ?? []).join(', '));
    const { related, other } = splitCertifications(provider.certifications);
    setRelatedCerts(related.join(', '));
    setOtherCerts(other.join(', '));
    setServiceAreas((provider.service_areas ?? []).join(', '));
    setSelectedServices(provider.available_services ?? []);
    setSchedule(provider.available_schedule ?? {});
    setScheduleNote(provider.schedule_note ?? '');

    // User-side fields degrade gracefully — empty values mean user can fill fresh.
    if (userResult.status === 'fulfilled') {
      setDateOfBirth(userResult.value.date_of_birth ?? '');
      setAddress(userResult.value.address ?? '');
    }
    // else: leave dob/address empty; user can fill them via the form. Save flow will
    // PUT /auth/me with whatever the user enters. We deliberately don't surface a
    // banner for this — partial /auth/me failure is rare and recoverable on save.

    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  function toggleService(code: string) {
    setSelectedServices((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function toggleSlot(day: string, slot: string) {
    setSchedule((prev) => {
      const slots = prev[day] ?? [];
      const next = slots.includes(slot) ? slots.filter((s) => s !== slot) : [...slots, slot];
      // Drop the day key entirely when no slot left (keeps payload tidy).
      const updated = { ...prev };
      if (next.length === 0) {
        delete updated[day];
      } else {
        updated[day] = next;
      }
      return updated;
    });
  }

  async function handleSave() {
    if (!phone.trim()) {
      setError('聯絡電話為必填');
      return;
    }
    setError('');
    setSaving(true);
    try {
      // Provider payload — only include fields that have meaningful values to avoid
      // overwriting with empty arrays unintentionally. Server's PUT /provider/me uses
      // ProviderSelfUpdateSchema (.optional()) so omitting = no change.
      const providerPayload: Record<string, unknown> = {
        phone: phone.trim(),
        education: education.trim() || null,
        schedule_note: scheduleNote.trim() || null,
        available_services: selectedServices,
        available_schedule: schedule,
      };
      if (experienceYears.trim()) {
        const n = parseInt(experienceYears, 10);
        if (!Number.isNaN(n)) providerPayload.experience_years = n;
      }
      providerPayload.specialties = specialties
        .split(',').map((s) => s.trim()).filter(Boolean);
      providerPayload.service_areas = serviceAreas
        .split(',').map((s) => s.trim()).filter(Boolean);
      // Certifications: rejoin related + other with ';' separator (only when other is non-empty).
      const related = relatedCerts.split(',').map((s) => s.trim()).filter(Boolean);
      const other = otherCerts.split(',').map((s) => s.trim()).filter(Boolean);
      providerPayload.certifications = other.length > 0
        ? [...related, ';', ...other]
        : related;

      await api.put('/provider/me', providerPayload);

      // Partial-success: User-side fields go via /auth/me. If this fails, the
      // provider-side already committed — surface a clear message rather than rolling back.
      let userMetaError: string | null = null;
      try {
        await api.put('/auth/me', {
          date_of_birth: dateOfBirth.trim() || null,
          address: address.trim() || null,
        });
      } catch (e) {
        userMetaError = e instanceof ApiError ? e.message : '個人資料儲存失敗';
      }

      if (userMetaError) {
        Alert.alert(
          '部分儲存成功',
          `服務人員資料已更新，但個人資料未能儲存：${userMetaError}`,
          [{ text: '確定', onPress: () => router.back() }],
        );
      } else {
        Alert.alert('儲存成功', '個人資料已更新', [
          { text: '確定', onPress: () => router.back() },
        ]);
      }
    } catch (e) {
      // INVALID_STATE_TRANSITION here means review_status === 'rejected'.
      // Provider should use 「重新送審」button on profile page instead — not edit directly.
      setError(e instanceof ApiError ? e.message : '儲存失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingScreen />;

  if (fetchError) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{fetchError}</Text>
        <TouchableOpacity onPress={() => void fetchAll()} style={s.retryBtn} activeOpacity={0.7}>
          <Text style={s.retryBtnText}>重試</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Section 4 audit fix #2: editing rejected profile is blocked server-side,
  // but warn upfront so user isn't surprised by the error toast.
  const isRejected = reviewStatus === 'rejected';

  const dobValue = dateOfBirth ? new Date(dateOfBirth) : new Date(1980, 0, 1);
  const formattedDob = dateOfBirth
    ? new Date(dateOfBirth).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {error ? (
        <View style={s.errorBox}><Text style={s.errorBoxText}>{error}</Text></View>
      ) : null}

      {isRejected && (
        <View style={s.warningBox}>
          <Text style={s.warningText}>
            審核未通過時無法直接修改資料。請先回到個人資料頁點選「重新送審」。
          </Text>
        </View>
      )}

      {/* ── 個人照片 (G12) ─────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconUser />
        <Text style={s.sectionTitle}>個人照片</Text>
      </View>
      <View style={s.card}>
        <ProviderPhotoUploader
          providerId={providerId}
          providerName={providerName}
          photoUrl={photoUrl}
          onPhotoUpdated={setPhotoUrl}
          disabled={isRejected}
          disabledReason="審核未通過時無法修改照片，請先重新送審"
        />
      </View>

      {/* ── 基本資料 ─────────────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconUser />
        <Text style={s.sectionTitle}>基本資料</Text>
      </View>
      <View style={s.card}>
        <View style={s.field}>
          <Text style={s.fieldLabel}>聯絡電話 <Text style={s.required}>*</Text></Text>
          <TextInput
            style={s.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="09xxxxxxxx"
            placeholderTextColor={colors.textDisabled}
            keyboardType="phone-pad"
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>生日</Text>
          <TouchableOpacity style={s.input} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
            <View style={s.dateRow}>
              <Text style={[s.inputText, !formattedDob && { color: colors.textDisabled }]}>
                {formattedDob || '選擇生日'}
              </Text>
              <IconCalendar />
            </View>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={dobValue}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_event, selected) => {
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
            <TouchableOpacity style={s.dateConfirm} onPress={() => setShowDatePicker(false)}>
              <Text style={s.dateConfirmText}>完成</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>居住地址</Text>
          <TextInput
            style={s.input}
            value={address}
            onChangeText={setAddress}
            placeholder="例：台北市大安區忠孝東路四段"
            placeholderTextColor={colors.textDisabled}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>學歷科系</Text>
          <TextInput
            style={s.input}
            value={education}
            onChangeText={setEducation}
            placeholder="例：護理系"
            placeholderTextColor={colors.textDisabled}
          />
        </View>

        <View style={[s.field, { marginBottom: 0 }]}>
          <Text style={s.fieldLabel}>年資</Text>
          <TextInput
            style={s.input}
            value={experienceYears}
            onChangeText={setExperienceYears}
            placeholder="例：3"
            placeholderTextColor={colors.textDisabled}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {/* ── 專業資訊 ─────────────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconBriefcase />
        <Text style={s.sectionTitle}>專業資訊</Text>
      </View>
      <View style={s.card}>
        <View style={s.field}>
          <Text style={s.fieldLabel}>相關證照</Text>
          <TextInput
            style={s.input}
            value={relatedCerts}
            onChangeText={setRelatedCerts}
            placeholder="與接案項目相關的證照（多項以逗號分隔）"
            placeholderTextColor={colors.textDisabled}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>其他證照</Text>
          <TextInput
            style={s.input}
            value={otherCerts}
            onChangeText={setOtherCerts}
            placeholder="例：駕照、急救證（多項以逗號分隔）"
            placeholderTextColor={colors.textDisabled}
          />
        </View>

        <View style={[s.field, { marginBottom: 0 }]}>
          <Text style={s.fieldLabel}>專長項目</Text>
          <TextInput
            style={s.input}
            value={specialties}
            onChangeText={setSpecialties}
            placeholder="多項以逗號分隔，例：陪診,居家照護"
            placeholderTextColor={colors.textDisabled}
          />
        </View>
      </View>

      {/* ── 服務區域 ─────────────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconLocation />
        <Text style={s.sectionTitle}>服務區域</Text>
      </View>
      <View style={s.card}>
        <View style={[s.field, { marginBottom: 0 }]}>
          <TextInput
            style={s.input}
            value={serviceAreas}
            onChangeText={setServiceAreas}
            placeholder="多項以逗號分隔，例：台北市大安區,台北市信義區"
            placeholderTextColor={colors.textDisabled}
          />
        </View>
      </View>

      {/* ── 可接案項目 ───────────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconBriefcase />
        <Text style={s.sectionTitle}>可接案項目</Text>
      </View>
      <View style={s.card}>
        <View style={s.chipGrid}>
          {SERVICE_OPTIONS.map((opt) => {
            const active = selectedServices.includes(opt.code);
            return (
              <TouchableOpacity
                key={opt.code}
                style={[s.chip, active && s.chipActive]}
                onPress={() => toggleService(opt.code)}
                activeOpacity={0.7}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── 可接案時段 (G7 核心) ─────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconSchedule />
        <Text style={s.sectionTitle}>可接案時段</Text>
      </View>
      <View style={s.card}>
        <Text style={s.scheduleHint}>點選每個格子來標記可接案時段。空白代表該時段不接案。</Text>
        <View style={s.scheduleHeader}>
          <View style={s.scheduleDayLabelHead} />
          {SLOTS.map((slot) => (
            <Text key={slot.key} style={s.scheduleSlotHead}>{slot.label}</Text>
          ))}
        </View>
        {DAYS.map((day) => (
          <View key={day.key} style={s.scheduleRow}>
            <Text style={s.scheduleDayLabel}>{day.label}</Text>
            {SLOTS.map((slot) => {
              const active = (schedule[day.key] ?? []).includes(slot.key);
              return (
                <TouchableOpacity
                  key={slot.key}
                  style={[s.scheduleCell, active && s.scheduleCellActive]}
                  onPress={() => toggleSlot(day.key, slot.key)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`週${day.label} ${slot.label}`}
                >
                  {active && <Text style={s.scheduleCellTick}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View style={[s.field, { marginTop: spacing.md, marginBottom: 0 }]}>
          <Text style={s.fieldLabel}>備註</Text>
          <TextInput
            style={[s.input, s.textArea]}
            value={scheduleNote}
            onChangeText={setScheduleNote}
            placeholder="例：除緊急狀況外，請於前一日預約"
            placeholderTextColor={colors.textDisabled}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* ── Submit ───────────────────────────────────────────── */}
      <TouchableOpacity
        style={[s.submitWrap, (saving || isRejected) && { opacity: 0.5 }]}
        onPress={() => void handleSave()}
        disabled={saving || isRejected}
        activeOpacity={0.85}
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
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] + spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bgScreen },

  errorText: { color: colors.danger, fontSize: typography.bodyMd.fontSize, textAlign: 'center', marginBottom: spacing.md },
  retryBtn: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  retryBtnText: { color: colors.white, fontWeight: '600' },

  errorBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1, borderColor: 'rgba(217,83,79,0.2)',
  },
  errorBoxText: { color: colors.danger, fontSize: typography.bodySm.fontSize, textAlign: 'center' },

  warningBox: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  warningText: { color: colors.warning, fontSize: typography.bodySm.fontSize },

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

  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
  },

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
  textArea: { minHeight: 70, textAlignVertical: 'top', paddingTop: spacing.md },

  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateConfirm: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
  },
  dateConfirmText: { color: colors.primaryText, fontSize: typography.captionSm.fontSize, fontWeight: '600' },

  // Service chip grid (mirrors provider-profile.tsx onboarding chip layout)
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  chipText: { fontSize: typography.bodySm.fontSize, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: colors.primaryText, fontWeight: '700' },

  // Schedule grid
  scheduleHint: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
    marginBottom: spacing.xs,
  },
  scheduleDayLabelHead: { width: 28 },
  scheduleSlotHead: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: spacing.xs,
  },
  scheduleDayLabel: {
    width: 28,
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  scheduleCell: {
    flex: 1,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgScreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleCellActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  scheduleCellTick: {
    color: colors.primaryText,
    fontWeight: '700',
    fontSize: 14,
  },

  // Submit button
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
