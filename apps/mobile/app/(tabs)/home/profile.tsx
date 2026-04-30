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
} from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  date_of_birth: string | null;
  address: string | null;
}

// ─── Field icons ──────────────────────────────────────────────

function IconUser() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={colors.primary} strokeWidth={1.8} />
      <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconPhone() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCalendar() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={colors.primary} strokeWidth={1.8} />
      <Path d="M3 9h18M8 3v4M16 3v4" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconLocation() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={colors.primary} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx="12" cy="10" r="3" stroke={colors.primary} strokeWidth={1.8} />
    </Svg>
  );
}
function IconMail() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="4" width="20" height="16" rx="2" stroke={colors.textTertiary} strokeWidth={1.8} />
      <Path d="M2 7l10 6 10-6" stroke={colors.textTertiary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconShield() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={colors.textTertiary} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<UserProfile>('/auth/me');
      setProfile(data);
      setName(data.name);
      setPhone(data.phone ?? '');
      setDateOfBirth(data.date_of_birth ?? '');
      setAddress(data.address ?? '');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchProfile(); }, [fetchProfile]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('姓名為必填');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        phone: phone.trim() || null,
        date_of_birth: dateOfBirth.trim() || null,
        address: address.trim() || null,
      };
      const updated = await api.put<UserProfile>('/auth/me', payload);
      setProfile(updated);
      Alert.alert('成功', '個人資料已更新', [{ text: '確定', onPress: () => router.back() }]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '更新失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!profile) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{error || '載入失敗'}</Text>
        <TouchableOpacity onPress={() => void fetchProfile()}><Text style={s.retryText}>重試</Text></TouchableOpacity>
      </View>
    );
  }

  const initial = profile.name?.charAt(0) ?? '';
  const formattedDob = dateOfBirth ? new Date(dateOfBirth).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const dobValue = dateOfBirth ? new Date(dateOfBirth) : new Date(2000, 0, 1);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* ── Profile Hero ─────────────────────────────────── */}
      <View style={s.hero}>
        <LinearGradient
          colors={['#E5F2FB', '#EDF7E8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.heroContent}>
          <View style={s.avatarBig}>
            <Text style={s.avatarBigText}>{initial}</Text>
          </View>
          <Text style={s.heroName}>{profile.name}</Text>
          <Text style={s.heroEmail}>{profile.email}</Text>
        </View>
      </View>

      {/* ── Error ────────────────────────────────────────── */}
      {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View> : null}

      {/* ── Editable section ─────────────────────────────── */}
      <Text style={s.sectionLabel}>可編輯資料</Text>
      <View style={s.card}>
        {/* Name */}
        <View style={s.field}>
          <View style={s.fieldHeader}>
            <IconUser />
            <Text style={s.fieldLabel}>姓名 <Text style={s.required}>*</Text></Text>
          </View>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="請輸入姓名"
            placeholderTextColor={colors.textDisabled}
          />
        </View>

        {/* Phone */}
        <View style={s.field}>
          <View style={s.fieldHeader}>
            <IconPhone />
            <Text style={s.fieldLabel}>聯絡電話</Text>
          </View>
          <TextInput
            style={s.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="選填"
            placeholderTextColor={colors.textDisabled}
            keyboardType="phone-pad"
          />
        </View>

        {/* Birthday */}
        <View style={s.field}>
          <View style={s.fieldHeader}>
            <IconCalendar />
            <Text style={s.fieldLabel}>生日</Text>
          </View>
          <TouchableOpacity style={s.input} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
            <Text style={[styles_textInput, !formattedDob && { color: colors.textDisabled }]}>
              {formattedDob || '選擇生日（選填）'}
            </Text>
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
            <TouchableOpacity style={s.dateConfirm} onPress={() => setShowDatePicker(false)}>
              <Text style={s.dateConfirmText}>完成</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Address */}
        <View style={[s.field, { marginBottom: 0 }]}>
          <View style={s.fieldHeader}>
            <IconLocation />
            <Text style={s.fieldLabel}>居住地址</Text>
          </View>
          <TextInput
            style={s.input}
            value={address}
            onChangeText={setAddress}
            placeholder="選填"
            placeholderTextColor={colors.textDisabled}
          />
        </View>
      </View>

      {/* ── Account info ─────────────────────────────────── */}
      <Text style={s.sectionLabel}>帳號資訊</Text>
      <View style={s.card}>
        <View style={s.readOnlyRow}>
          <IconMail />
          <View style={s.readOnlyTextWrap}>
            <Text style={s.readOnlyLabel}>Email</Text>
            <Text style={s.readOnlyValue}>{profile.email}</Text>
          </View>
        </View>
        <View style={s.divider} />
        <View style={[s.readOnlyRow, { borderBottomWidth: 0 }]}>
          <IconShield />
          <View style={s.readOnlyTextWrap}>
            <Text style={s.readOnlyLabel}>角色</Text>
            <Text style={s.readOnlyValue}>委託人（家屬）</Text>
          </View>
        </View>
      </View>

      {/* ── Save button ──────────────────────────────────── */}
      <TouchableOpacity
        style={[s.saveBtnWrap, saving && { opacity: 0.6 }]}
        onPress={() => void handleSave()}
        disabled={saving}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.saveBtn}
        >
          <Text style={s.saveBtnText}>{saving ? '儲存中...' : '儲存變更'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

// Inline text style (used inside the date picker TouchableOpacity)
const styles_textInput = { fontSize: typography.bodyMd.fontSize, color: colors.textPrimary };

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] + spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bgScreen },

  // Hero
  hero: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(46,141,201,0.12)',
    marginBottom: spacing.xs,
  },
  heroContent: {
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  avatarBig: {
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
  avatarBigText: { fontSize: 28, fontWeight: '700', color: colors.primaryText },
  heroName: { fontSize: typography.headingMd.fontSize, fontWeight: '700', color: colors.textPrimary },
  heroEmail: { fontSize: typography.captionSm.fontSize, color: colors.textTertiary, marginTop: 2 },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: '700',
    color: colors.textTertiary, letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: spacing.sm, marginBottom: 0,
    paddingLeft: 4,
  },

  // Card
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
  },

  // Field
  field: { marginBottom: spacing.md },
  fieldHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  required: { color: colors.danger },
  input: {
    backgroundColor: colors.bgScreen,
    borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md + 2,
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
    minHeight: 46,
    justifyContent: 'center',
  },

  // Date picker confirm (iOS)
  dateConfirm: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
  },
  dateConfirmText: { color: colors.primaryText, fontSize: typography.captionSm.fontSize, fontWeight: '600' },

  // Read-only row
  readOnlyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  readOnlyTextWrap: { flex: 1 },
  readOnlyLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  readOnlyValue: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  divider: { height: 1, backgroundColor: colors.borderDefault },

  // Error
  errorBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1, borderColor: 'rgba(217,83,79,0.2)',
  },
  errorText: { color: colors.danger, fontSize: typography.bodySm.fontSize, textAlign: 'center' },
  retryText: { color: colors.primary, fontSize: typography.bodyMd.fontSize, textDecorationLine: 'underline', marginTop: spacing.sm },

  // Save button
  saveBtnWrap: {
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  saveBtn: {
    paddingVertical: spacing.md + 2,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
