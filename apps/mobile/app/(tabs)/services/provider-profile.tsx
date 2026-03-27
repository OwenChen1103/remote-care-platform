import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';

interface ProviderProfile {
  id: string;
  name: string;
  review_status: string;
  level: string;
  phone: string;
  email: string;
  education: string | null;
  experience_years: number | null;
  specialties: string[];
  certifications: string[];
  service_areas: string[];
  available_services: string[];
  available_schedule: Record<string, string[]>;
  schedule_note: string | null;
  availability_status: string;
}

// Service categories for the onboarding service picker
const SERVICE_OPTIONS = [
  { code: 'escort_visit', label: '陪診師' },
  { code: 'functional_assessment', label: '身體功能檢測' },
  { code: 'exercise_program', label: '運動項目' },
  { code: 'home_cleaning', label: '打掃清潔' },
  { code: 'pre_visit_consult', label: '診前諮詢' },
  { code: 'daily_living_support', label: '生活輔助' },
  { code: 'nutrition_consult', label: '營養表諮詢' },
  { code: 'shopping_assist', label: '購物服務' },
] as const;

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: '審核中',
  approved: '已核准',
  rejected: '未通過',
};

const AVAILABILITY_OPTIONS: { key: string; label: string; color: string; bg: string }[] = [
  { key: 'available', label: '可接案', color: '#15803D', bg: '#DCFCE7' },
  { key: 'busy', label: '忙碌中', color: '#C2410C', bg: '#FFEDD5' },
  { key: 'offline', label: '離線', color: '#6B7280', bg: '#F3F4F6' },
];

export default function ProviderProfileScreen() {
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<ProviderProfile>('/provider/me');
      setProfile(result);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  // ── Onboarding state (for pending providers) ──
  const [obDateOfBirth, setObDateOfBirth] = useState('');
  const [obEducation, setObEducation] = useState('');
  const [obPhone, setObPhone] = useState('');
  const [obSpecialties, setObSpecialties] = useState('');
  const [obCertifications, setObCertifications] = useState('');
  const [obExperienceYears, setObExperienceYears] = useState('');
  const [obServiceAreas, setObServiceAreas] = useState('');
  const [obSelectedServices, setObSelectedServices] = useState<string[]>([]);
  const [obSaving, setObSaving] = useState(false);

  const isOnboarding = profile?.review_status === 'pending'
    && !(profile.specialties as string[])?.length
    && !profile.education;

  function toggleService(code: string) {
    setObSelectedServices((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  const submitOnboarding = async () => {
    if (!obPhone.trim()) {
      Alert.alert('提示', '請填寫聯絡電話');
      return;
    }
    setObSaving(true);
    try {
      const payload: Record<string, unknown> = {
        phone: obPhone.trim(),
      };
      if (obEducation.trim()) payload.education = obEducation.trim();
      if (obSpecialties.trim()) {
        payload.specialties = obSpecialties.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (obCertifications.trim()) {
        payload.certifications = obCertifications.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (obExperienceYears.trim()) {
        payload.experience_years = parseInt(obExperienceYears, 10);
      }
      if (obServiceAreas.trim()) {
        payload.service_areas = obServiceAreas.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (obSelectedServices.length > 0) {
        payload.available_services = obSelectedServices;
      }
      // Save provider-specific fields
      const result = await api.put<ProviderProfile>('/provider/me', payload);
      setProfile(result);
      // Save date_of_birth on user profile (separate endpoint)
      if (obDateOfBirth.trim()) {
        try {
          await api.put('/auth/me', { date_of_birth: obDateOfBirth.trim() });
        } catch {
          // Non-critical: provider data saved, user DOB save failed silently
        }
      }
      Alert.alert('已送出', '您的資料已送出，等待審核通知。');
    } catch (e) {
      if (e instanceof ApiError) Alert.alert('錯誤', e.message);
      else Alert.alert('錯誤', '送出失敗，請稍後再試');
    } finally {
      setObSaving(false);
    }
  };

  const handleAvailability = async (status: string) => {
    if (!profile || profile.availability_status === status) return;
    setUpdating(true);
    try {
      const result = await api.put<ProviderProfile>('/provider/me', {
        availability_status: status,
      });
      setProfile(result);
    } catch (e) {
      if (e instanceof ApiError) Alert.alert('錯誤', e.message);
      else Alert.alert('錯誤', '更新失敗');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;
  }

  if (error || !profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || '載入失敗'}</Text>
        <TouchableOpacity onPress={() => void fetchProfile()}>
          <Text style={styles.retryText}>重試</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Onboarding view ──
  if (isOnboarding) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.onboardingBanner}>
          <Text style={styles.onboardingTitle}>歡迎加入！</Text>
          <Text style={styles.onboardingDesc}>
            請填寫以下資料以完成註冊，送出後將由平台審核。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本資料</Text>

          <Text style={styles.fieldLabel}>聯絡電話 *</Text>
          <TextInput
            style={styles.obInput}
            value={obPhone}
            onChangeText={setObPhone}
            placeholder="09xxxxxxxx"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
          />

          <Text style={styles.fieldLabel}>生日</Text>
          <TextInput
            style={styles.obInput}
            value={obDateOfBirth}
            onChangeText={setObDateOfBirth}
            placeholder="YYYY-MM-DD（選填）"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.fieldLabel}>學歷科系</Text>
          <TextInput
            style={styles.obInput}
            value={obEducation}
            onChangeText={setObEducation}
            placeholder="例：護理系（選填）"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.fieldLabel}>年資</Text>
          <TextInput
            style={styles.obInput}
            value={obExperienceYears}
            onChangeText={setObExperienceYears}
            placeholder="例：3"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>專業資訊</Text>

          <Text style={styles.fieldLabel}>相關證照（逗號分隔）</Text>
          <TextInput
            style={styles.obInput}
            value={obCertifications}
            onChangeText={setObCertifications}
            placeholder="例：護理師執照,照服員證"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.fieldLabel}>專長項目（逗號分隔）</Text>
          <TextInput
            style={styles.obInput}
            value={obSpecialties}
            onChangeText={setObSpecialties}
            placeholder="例：陪診,居家照護"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.fieldLabel}>可接案項目</Text>
          <View style={styles.obChipGrid}>
            {SERVICE_OPTIONS.map((opt) => {
              const active = obSelectedServices.includes(opt.code);
              return (
                <TouchableOpacity
                  key={opt.code}
                  style={[styles.obChip, active && styles.obChipActive]}
                  onPress={() => toggleService(opt.code)}
                >
                  <Text style={[styles.obChipText, active && styles.obChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>服務區域</Text>
          <Text style={styles.fieldLabel}>服務區域（逗號分隔）</Text>
          <TextInput
            style={styles.obInput}
            value={obServiceAreas}
            onChangeText={setObServiceAreas}
            placeholder="例：台北市大安區,台北市信義區"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, obSaving && styles.submitDisabled]}
          onPress={() => void submitOnboarding()}
          disabled={obSaving}
        >
          <Text style={styles.submitText}>{obSaving ? '送出中...' : '送出審核'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Normal profile view ──
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基本資訊</Text>
        <InfoRow label="姓名" value={profile.name} />
        <InfoRow
          label="審核狀態"
          value={REVIEW_STATUS_LABELS[profile.review_status] ?? profile.review_status}
        />
        <InfoRow label="等級" value={profile.level} />
        <InfoRow label="電話" value={profile.phone} />
        <InfoRow label="信箱" value={profile.email} />
        <InfoRow label="經驗年數" value={`${profile.experience_years} 年`} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>專長項目</Text>
        <View style={styles.tagRow}>
          {profile.specialties.length > 0 ? (
            profile.specialties.map((s) => (
              <View key={s} style={styles.tag}>
                <Text style={styles.tagText}>{s}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyTag}>尚未設定</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>服務地區</Text>
        <View style={styles.tagRow}>
          {profile.service_areas.length > 0 ? (
            profile.service_areas.map((a) => (
              <View key={a} style={styles.tag}>
                <Text style={styles.tagText}>{a}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyTag}>尚未設定</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>接案狀態</Text>
        <View style={styles.availabilityRow}>
          {AVAILABILITY_OPTIONS.map((opt) => {
            const isActive = profile.availability_status === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.availabilityCard,
                  { backgroundColor: opt.bg },
                  isActive && styles.availabilityCardActive,
                  isActive && { borderColor: opt.color },
                ]}
                onPress={() => void handleAvailability(opt.key)}
                disabled={updating}
              >
                <Text
                  style={[
                    styles.availabilityLabel,
                    { color: opt.color },
                    isActive && styles.availabilityLabelActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {/* Available Services */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>可接案項目</Text>
        <View style={styles.obChipGrid}>
          {SERVICE_OPTIONS.map((opt) => {
            const active = ((profile.available_services ?? []) as string[]).includes(opt.code);
            return (
              <TouchableOpacity
                key={opt.code}
                style={[styles.obChip, active && styles.obChipActive]}
                onPress={() => {
                  const current = ((profile.available_services ?? []) as string[]);
                  const next = current.includes(opt.code)
                    ? current.filter((c) => c !== opt.code)
                    : [...current, opt.code];
                  void (async () => {
                    try {
                      const result = await api.put<ProviderProfile>('/provider/me', {
                        available_services: next,
                      });
                      setProfile(result);
                    } catch {
                      Alert.alert('錯誤', '更新失敗');
                    }
                  })();
                }}
                disabled={updating}
              >
                <Text style={[styles.obChipText, active && styles.obChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40 },
  loader: { flex: 1, justifyContent: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#DC2626', fontSize: 14, marginBottom: 8 },
  retryText: { color: '#2563EB', fontSize: 14, textDecorationLine: 'underline' },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    maxWidth: '60%' as unknown as number,
    textAlign: 'right',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: { color: '#1D4ED8', fontSize: 13, fontWeight: '500' },
  emptyTag: { color: '#9CA3AF', fontSize: 14 },
  availabilityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  availabilityCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  availabilityCardActive: {
    borderWidth: 2,
  },
  availabilityLabel: { fontSize: 14, fontWeight: '500' },
  availabilityLabelActive: { fontWeight: '700' },

  // ─── Onboarding ─────────────────────────────────────────────
  onboardingBanner: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  onboardingTitle: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: typography.headingLg.fontWeight,
    color: colors.primaryText,
    marginBottom: spacing.xs,
  },
  onboardingDesc: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
    lineHeight: typography.bodyMd.fontSize * 1.6,
  },
  fieldLabel: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  obInput: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
  },
  obChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  obChip: {
    paddingHorizontal: spacing.lg - spacing.xxs,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgSurface,
  },
  obChipActive: {
    borderColor: colors.primaryText,
    backgroundColor: colors.primaryLight,
  },
  obChipText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textTertiary,
  },
  obChipTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg - spacing.xxs,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: {
    color: colors.white,
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
  },
});
