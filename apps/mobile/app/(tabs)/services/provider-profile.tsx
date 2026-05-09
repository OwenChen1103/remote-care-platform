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
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

// ─── Types ────────────────────────────────────────────────────

interface ProviderProfile {
  id: string;
  name: string;
  // Section 4.1.1: 4 review states — pending / approved / rejected / suspended.
  // 'rejected' provider can reapply via /provider/me/reapply (section 4.1.6).
  review_status: string;
  // Section 4.1.8: surface review lifecycle audit fields for the banner UI.
  admin_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
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

const REVIEW_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: '審核中', color: colors.warning,     bg: colors.warningLight },
  approved: { label: '已核准', color: colors.success,     bg: colors.successLight },
  rejected: { label: '未通過', color: colors.danger,      bg: colors.dangerLight },
};

const LEVEL_LABELS: Record<string, string> = { L1: '初級', L2: '中級', L3: '資深' };

const AVAILABILITY_OPTIONS: { key: string; label: string; color: string; bg: string; activeBg: string; border: string }[] = [
  { key: 'available', label: '可接案', color: colors.success,        bg: colors.bgSurface, activeBg: colors.successLight, border: colors.success },
  { key: 'busy',      label: '忙碌中', color: colors.warning,        bg: colors.bgSurface, activeBg: colors.warningLight, border: colors.warning },
  { key: 'offline',   label: '離線',   color: colors.textTertiary,   bg: colors.bgSurface, activeBg: colors.bgSurfaceAlt, border: colors.borderStrong },
];

// ─── Section Icons ────────────────────────────────────────────

function IconUser({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={1.8} />
      <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function IconBriefcase({ color = colors.accent }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="7" width="20" height="14" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M2 13h20" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function IconLocation({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx="12" cy="10" r="3" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

function IconStar({ color = colors.warning }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

function IconStatus({ color = colors.accent }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={1.8} />
      <Circle cx="12" cy="12" r="3.5" fill={color} />
    </Svg>
  );
}

function IconHandshake({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M11 17l2 2 4-4M5 12l4-4 4 4-4 4-4-4z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 8l3-3M15 13l3-3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function IconCalendarSm({ color = colors.textTertiary }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M3 9h18M8 3v4M16 3v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Component ────────────────────────────────────────────────

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

  // ── Onboarding state ─────────────────────────────────────
  const [obDateOfBirth, setObDateOfBirth] = useState('');
  const [obShowDatePicker, setObShowDatePicker] = useState(false);
  const [obEducation, setObEducation] = useState('');
  const [obPhone, setObPhone] = useState('');
  const [obSpecialties, setObSpecialties] = useState('');
  const [obCertifications, setObCertifications] = useState('');
  const [obExperienceYears, setObExperienceYears] = useState('');
  const [obServiceAreas, setObServiceAreas] = useState('');
  const [obSelectedServices, setObSelectedServices] = useState<string[]>([]);
  const [obSaving, setObSaving] = useState(false);

  // Section 4.1.8: replace brittle "no fields filled" heuristic with a true onboarding signal.
  // submitted_at is only stamped after the first real PUT with onboarding fields (see provider/me PUT).
  // If submitted_at IS NULL → never submitted → still onboarding.
  // If submitted_at present → either pending review or post-decision; show normal profile view.
  const isOnboarding = profile?.review_status === 'pending' && !profile?.submitted_at;

  function toggleObService(code: string) {
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
      const payload: Record<string, unknown> = { phone: obPhone.trim() };
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
      const result = await api.put<ProviderProfile>('/provider/me', payload);
      setProfile(result);
      // Section 4.1.8: don't silently swallow DOB save error — provider deserves to know
      // their birthday didn't save. The provider-profile data already committed via /provider/me,
      // so we partial-succeed rather than failing the whole submission.
      let dobError: string | null = null;
      if (obDateOfBirth.trim()) {
        try {
          await api.put('/auth/me', { date_of_birth: obDateOfBirth.trim() });
        } catch (e) {
          dobError = e instanceof ApiError ? e.message : '生日儲存失敗';
        }
      }
      if (dobError) {
        Alert.alert(
          '部分送出成功',
          `服務人員資料已送出審核，但生日未能儲存：${dobError}\n您可稍後在個人資料頁更新。`,
        );
      } else {
        Alert.alert('已送出', '您的資料已送出，等待審核通知。');
      }
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

  // Section 4.1.6: provider re-submits for review after rejection.
  // Server requires acknowledged_note: true (provider has read the rejection reason).
  const handleReapply = async () => {
    Alert.alert(
      '重新送審',
      '確定要重新送出審核嗎？平台將重新檢視您目前的資料。建議您先確認個人資料已修正前次未通過的問題。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '送出',
          onPress: async () => {
            setUpdating(true);
            try {
              const result = await api.post<ProviderProfile>('/provider/me/reapply', {
                acknowledged_note: true,
              });
              setProfile(result);
              Alert.alert('已送出', '已重新送出審核，請耐心等候管理員審核結果。');
            } catch (e) {
              if (e instanceof ApiError) Alert.alert('錯誤', e.message);
              else Alert.alert('錯誤', '送出失敗，請稍後再試');
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  };

  const toggleService = async (code: string) => {
    if (!profile) return;
    const current = (profile.available_services ?? []) as string[];
    const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
    try {
      const result = await api.put<ProviderProfile>('/provider/me', { available_services: next });
      setProfile(result);
    } catch {
      Alert.alert('錯誤', '更新失敗');
    }
  };

  if (loading) return <LoadingScreen />;

  if (error || !profile) {
    return (
      <View style={s.errorContainer}>
        <Text style={s.errorText}>{error || '載入失敗'}</Text>
        <TouchableOpacity onPress={() => void fetchProfile()} style={s.errorBtn} activeOpacity={0.7}>
          <Text style={s.errorBtnText}>重試</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Onboarding view ──────────────────────────────────────

  if (isOnboarding) {
    const dobValue = obDateOfBirth ? new Date(obDateOfBirth) : new Date(1980, 0, 1);
    const formattedDob = obDateOfBirth
      ? new Date(obDateOfBirth).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        {/* ── Welcome Hero ──────────────────────── */}
        <View style={s.welcomeHero}>
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

          <View style={s.welcomeHeroContent}>
            <View style={s.welcomeIconWrap}>
              <IconHandshake />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTagline}>WELCOME PROVIDER</Text>
              <Text style={s.heroSubtitle}>歡迎加入 WhoCares</Text>
              <Text style={s.heroDesc}>填寫以下資料完成註冊，送出後將由平台審核。</Text>
            </View>
          </View>
        </View>

        {/* ── Section: 基本資料 ──────────────────── */}
        <View style={s.sectionHeader}>
          <IconUser />
          <Text style={s.sectionLabel}>基本資料</Text>
        </View>
        <View style={s.card}>
          <View style={s.field}>
            <Text style={s.fieldLabel}>聯絡電話 <Text style={s.required}>*</Text></Text>
            <TextInput
              style={s.input}
              value={obPhone}
              onChangeText={setObPhone}
              placeholder="09xxxxxxxx"
              placeholderTextColor={colors.textDisabled}
              keyboardType="phone-pad"
            />
          </View>

          <View style={s.field}>
            <Text style={s.fieldLabel}>生日</Text>
            <TouchableOpacity style={s.input} onPress={() => setObShowDatePicker(true)} activeOpacity={0.7}>
              <View style={s.dateRow}>
                <Text style={[s.inputText, !formattedDob && { color: colors.textDisabled }]}>
                  {formattedDob || '選擇生日（選填）'}
                </Text>
                <IconCalendarSm />
              </View>
            </TouchableOpacity>
            {obShowDatePicker && (
              <DateTimePicker
                value={dobValue}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selected) => {
                  if (Platform.OS === 'android') setObShowDatePicker(false);
                  if (selected) {
                    const yyyy = selected.getFullYear();
                    const mm = String(selected.getMonth() + 1).padStart(2, '0');
                    const dd = String(selected.getDate()).padStart(2, '0');
                    setObDateOfBirth(`${yyyy}-${mm}-${dd}`);
                  }
                }}
                maximumDate={new Date()}
              />
            )}
            {Platform.OS === 'ios' && obShowDatePicker && (
              <TouchableOpacity style={s.dateConfirm} onPress={() => setObShowDatePicker(false)} activeOpacity={0.7}>
                <Text style={s.dateConfirmText}>完成</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={s.field}>
            <Text style={s.fieldLabel}>學歷科系</Text>
            <TextInput
              style={s.input}
              value={obEducation}
              onChangeText={setObEducation}
              placeholder="例：護理系（選填）"
              placeholderTextColor={colors.textDisabled}
            />
          </View>

          <View style={[s.field, { marginBottom: 0 }]}>
            <Text style={s.fieldLabel}>年資</Text>
            <TextInput
              style={s.input}
              value={obExperienceYears}
              onChangeText={setObExperienceYears}
              placeholder="例：3"
              placeholderTextColor={colors.textDisabled}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* ── Section: 專業資訊 ──────────────────── */}
        <View style={s.sectionHeader}>
          <IconBriefcase />
          <Text style={s.sectionLabel}>專業資訊</Text>
        </View>
        <View style={s.card}>
          <View style={s.field}>
            <Text style={s.fieldLabel}>相關證照</Text>
            <TextInput
              style={s.input}
              value={obCertifications}
              onChangeText={setObCertifications}
              placeholder="多項以逗號分隔，例：護理師執照,照服員證"
              placeholderTextColor={colors.textDisabled}
            />
          </View>

          <View style={s.field}>
            <Text style={s.fieldLabel}>專長項目</Text>
            <TextInput
              style={s.input}
              value={obSpecialties}
              onChangeText={setObSpecialties}
              placeholder="多項以逗號分隔，例：陪診,居家照護"
              placeholderTextColor={colors.textDisabled}
            />
          </View>

          <View style={[s.field, { marginBottom: 0 }]}>
            <Text style={s.fieldLabel}>可接案項目</Text>
            <View style={s.chipGrid}>
              {SERVICE_OPTIONS.map((opt) => {
                const active = obSelectedServices.includes(opt.code);
                return (
                  <TouchableOpacity
                    key={opt.code}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => toggleObService(opt.code)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── Section: 服務區域 ──────────────────── */}
        <View style={s.sectionHeader}>
          <IconLocation />
          <Text style={s.sectionLabel}>服務區域</Text>
        </View>
        <View style={s.card}>
          <View style={[s.field, { marginBottom: 0 }]}>
            <TextInput
              style={s.input}
              value={obServiceAreas}
              onChangeText={setObServiceAreas}
              placeholder="多項以逗號分隔，例：台北市大安區,台北市信義區"
              placeholderTextColor={colors.textDisabled}
            />
          </View>
        </View>

        {/* ── Submit (gradient) ──────────────────── */}
        <TouchableOpacity
          style={[s.submitWrap, obSaving && { opacity: 0.6 }]}
          onPress={() => void submitOnboarding()}
          disabled={obSaving}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[colors.primary, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.submitBtn}
          >
            <Text style={s.submitText}>{obSaving ? '送出中...' : '送出審核'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── Approved / Rejected view ─────────────────────────────

  const review = REVIEW_STATUS_LABELS[profile.review_status] ?? REVIEW_STATUS_LABELS.pending!;
  const initial = profile.name?.charAt(0) ?? '';
  const levelLabel = LEVEL_LABELS[profile.level] ?? profile.level;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* ── Profile Hero ─────────────────────────────────── */}
      <View style={s.profileHero}>
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

        <View style={s.profileHeroContent}>
          <View style={s.heroAvatar}>
            <Text style={s.heroAvatarText}>{initial}</Text>
          </View>
          <Text style={s.heroName}>{profile.name}</Text>
          <View style={s.heroBadgesRow}>
            <View style={s.levelBadge}>
              <Text style={s.levelBadgeText}>{profile.level} · {levelLabel}</Text>
            </View>
            <View style={[s.reviewBadge, { backgroundColor: review.bg }]}>
              <Text style={[s.reviewBadgeText, { color: review.color }]}>{review.label}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Section 4.1.8: Review status banners ────────────────
          Rejected: shown above all profile content with admin_note + reapply CTA.
          Suspended: shown with admin_note + customer-service hint (no self-recovery). */}
      {profile.review_status === 'rejected' && (
        <View style={s.rejectionCard}>
          <View style={s.rejectionHeader}>
            <Text style={s.rejectionTitle}>審核未通過</Text>
            {profile.reviewed_at && (
              <Text style={s.rejectionDate}>
                {new Date(profile.reviewed_at).toLocaleDateString('zh-TW')}
              </Text>
            )}
          </View>
          {profile.admin_note ? (
            <Text style={s.rejectionBody}>原因：{profile.admin_note}</Text>
          ) : (
            <Text style={s.rejectionBody}>請聯繫客服了解詳情。</Text>
          )}
          <TouchableOpacity
            style={[s.reapplyBtn, updating && { opacity: 0.6 }]}
            onPress={() => void handleReapply()}
            disabled={updating}
            activeOpacity={0.8}
          >
            <Text style={s.reapplyBtnText}>{updating ? '送出中...' : '修正後重新送審'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {profile.review_status === 'suspended' && (
        <View style={s.suspendedCard}>
          <Text style={s.suspendedTitle}>帳號已停權</Text>
          {profile.admin_note ? (
            <Text style={s.suspendedBody}>{profile.admin_note}</Text>
          ) : null}
          <Text style={s.suspendedHint}>如需恢復，請聯繫客服。</Text>
        </View>
      )}

      {/* ── Section: 基本資訊 ──────────────────── */}
      <View style={s.sectionHeader}>
        <IconUser />
        <Text style={s.sectionLabel}>基本資訊</Text>
      </View>
      <View style={s.card}>
        <InfoRow label="姓名" value={profile.name} />
        <InfoRow label="電話" value={profile.phone} />
        <InfoRow label="信箱" value={profile.email} />
        <InfoRow label="等級" value={`${profile.level}（${levelLabel}）`} />
        {profile.experience_years != null && (
          <InfoRow label="經驗年數" value={`${profile.experience_years} 年`} />
        )}
        {profile.education && <InfoRow label="學歷" value={profile.education} isLast />}
        {!profile.education && profile.experience_years == null && (
          <InfoRow label="等級" value={`${profile.level}（${levelLabel}）`} isLast />
        )}
      </View>

      {/* ── Section: 接案狀態 ──────────────────── */}
      <View style={s.sectionHeader}>
        <IconStatus />
        <Text style={s.sectionLabel}>接案狀態</Text>
      </View>
      <View style={s.availabilityRow}>
        {AVAILABILITY_OPTIONS.map((opt) => {
          const isActive = profile.availability_status === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                s.availCard,
                isActive && {
                  backgroundColor: opt.activeBg,
                  borderColor: opt.border,
                  borderWidth: 1.5,
                },
              ]}
              onPress={() => void handleAvailability(opt.key)}
              disabled={updating}
              activeOpacity={0.7}
            >
              <View style={[s.availDot, { backgroundColor: opt.color }]} />
              <Text
                style={[
                  s.availLabel,
                  isActive && { color: opt.color, fontWeight: '700' },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Section: 專長項目 ──────────────────── */}
      <View style={s.sectionHeader}>
        <IconStar />
        <Text style={s.sectionLabel}>專長項目</Text>
      </View>
      <View style={s.card}>
        {profile.specialties.length > 0 ? (
          <View style={s.tagRow}>
            {profile.specialties.map((sp) => (
              <View key={sp} style={s.tag}>
                <Text style={s.tagText}>{sp}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.emptyText}>尚未設定</Text>
        )}
      </View>

      {/* ── Section: 證照 ──────────────────────── */}
      {profile.certifications.length > 0 && (
        <>
          <View style={s.sectionHeader}>
            <IconBriefcase color={colors.primary} />
            <Text style={s.sectionLabel}>專業證照</Text>
          </View>
          <View style={s.card}>
            <View style={s.tagRow}>
              {profile.certifications.map((c) => (
                <View key={c} style={s.tagAlt}>
                  <Text style={s.tagAltText}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {/* ── Section: 服務地區 ──────────────────── */}
      <View style={s.sectionHeader}>
        <IconLocation />
        <Text style={s.sectionLabel}>服務地區</Text>
      </View>
      <View style={s.card}>
        {profile.service_areas.length > 0 ? (
          <View style={s.tagRow}>
            {profile.service_areas.map((a) => (
              <View key={a} style={s.tag}>
                <Text style={s.tagText}>{a}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.emptyText}>尚未設定</Text>
        )}
      </View>

      {/* ── Section: 可接案項目 ────────────────── */}
      <View style={s.sectionHeader}>
        <IconBriefcase color={colors.accent} />
        <Text style={s.sectionLabel}>可接案項目</Text>
      </View>
      <View style={s.card}>
        <View style={s.chipGrid}>
          {SERVICE_OPTIONS.map((opt) => {
            const active = ((profile.available_services ?? []) as string[]).includes(opt.code);
            return (
              <TouchableOpacity
                key={opt.code}
                style={[s.chip, active && s.chipActive]}
                onPress={() => void toggleService(opt.code)}
                disabled={updating}
                activeOpacity={0.7}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────

function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[s.infoRow, isLast && { borderBottomWidth: 0, paddingBottom: 0 }]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] + spacing.lg, gap: spacing.md },

  // ─── Error ────────────────────────────────────────────────
  errorContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: spacing.xl, backgroundColor: colors.bgScreen, gap: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: typography.bodyMd.fontSize, textAlign: 'center' },
  errorBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.primary,
  },
  errorBtnText: { color: colors.primaryText, fontSize: typography.bodySm.fontSize, fontWeight: '700' },

  // ─── Welcome Hero (onboarding) ───────────────────────────
  welcomeHero: {
    position: 'relative', overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(46,141,201,0.12)',
  },
  welcomeHeroContent: {
    paddingVertical: spacing.lg + 2, paddingHorizontal: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  welcomeIconWrap: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1, borderColor: 'rgba(46,141,201,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ─── Profile Hero (approved view) ────────────────────────
  profileHero: {
    position: 'relative', overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(46,141,201,0.12)',
  },
  profileHeroContent: {
    paddingVertical: spacing.xl, paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  heroAvatar: {
    width: 72, height: 72, borderRadius: 36,
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
  heroAvatarText: { fontSize: 28, fontWeight: '700', color: colors.primaryText },
  heroName: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  levelBadge: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(46,141,201,0.18)',
  },
  levelBadgeText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
    color: colors.primaryText,
  },
  reviewBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
  },
  reviewBadgeText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
  },

  // ─── Section 4.1.8: review status banners ───────────────
  rejectionCard: {
    backgroundColor: '#FFEDD5', // orange-100
    borderWidth: 1, borderColor: '#FED7AA', // orange-200
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  rejectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  rejectionTitle: {
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '700',
    color: '#9A3412', // orange-800
  },
  rejectionDate: {
    fontSize: typography.captionSm.fontSize,
    color: '#C2410C',
  },
  rejectionBody: {
    fontSize: typography.bodySm.fontSize,
    color: '#7C2D12',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  reapplyBtn: {
    backgroundColor: '#EA580C', // orange-600
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  reapplyBtnText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    letterSpacing: 1,
  },
  suspendedCard: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1, borderColor: 'rgba(217,83,79,0.3)',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  suspendedTitle: {
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  suspendedBody: {
    fontSize: typography.bodySm.fontSize,
    color: colors.danger,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  suspendedHint: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },

  // ─── Hero halos (shared) ─────────────────────────────────
  heroHaloTopRight: {
    position: 'absolute', top: -50, right: -50,
    width: 170, height: 170, borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  heroHaloBottomLeft: {
    position: 'absolute', bottom: -50, left: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  heroTagline: {
    fontSize: 10, fontWeight: '700',
    color: colors.primary, letterSpacing: 2,
  },
  heroSubtitle: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xxs,
  },
  heroDesc: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },

  // ─── Section header ──────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingLeft: spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },

  // ─── Card ────────────────────────────────────────────────
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
  },

  // ─── InfoRow ─────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  infoLabel: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
  },
  infoValue: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textPrimary,
    fontWeight: '600',
    maxWidth: '60%' as unknown as number,
    textAlign: 'right',
  },

  // ─── Field (form) ────────────────────────────────────────
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
  dateConfirmText: {
    color: colors.primaryText,
    fontSize: typography.captionSm.fontSize,
    fontWeight: '600',
  },

  // ─── Chips (service grid) ────────────────────────────────
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
  chipText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.primaryText,
    fontWeight: '700',
  },

  // ─── Availability ────────────────────────────────────────
  availabilityRow: { flexDirection: 'row', gap: spacing.sm },
  availCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault,
    paddingVertical: spacing.md,
  },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  availLabel: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '500',
    color: colors.textSecondary,
  },

  // ─── Tags (read-only) ────────────────────────────────────
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: typography.captionSm.fontSize,
    color: colors.primaryText,
    fontWeight: '600',
  },
  tagAlt: {
    backgroundColor: colors.accentLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  tagAltText: {
    fontSize: typography.captionSm.fontSize,
    color: colors.secondaryText,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textDisabled,
    fontStyle: 'italic',
  },

  // ─── Submit (gradient) ───────────────────────────────────
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
