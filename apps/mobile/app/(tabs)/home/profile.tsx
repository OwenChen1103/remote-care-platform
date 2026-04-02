import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  date_of_birth: string | null;
  address: string | null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

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
      if (e instanceof ApiError) setError(e.message);
      else setError('更新失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || '載入失敗'}</Text>
        <TouchableOpacity onPress={() => void fetchProfile()}>
          <Text style={styles.retryText}>重試</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>個人資料管理</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>可編輯資料</Text>
      <View style={styles.section}>
        <Text style={styles.label}>姓名 *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="姓名"
          placeholderTextColor={colors.textDisabled}
          accessibilityLabel="姓名"
        />

        <Text style={styles.label}>聯絡電話</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="選填"
          placeholderTextColor={colors.textDisabled}
          keyboardType="phone-pad"
          accessibilityLabel="聯絡電話"
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

        <Text style={styles.label}>居住地址</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="選填"
          placeholderTextColor={colors.textDisabled}
          accessibilityLabel="居住地址"
        />
      </View>

      <Text style={styles.sectionLabel}>帳號資訊</Text>
      <View style={styles.section}>
        <Text style={styles.label}>Email</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>{profile.email}</Text>
        </View>

        <Text style={styles.label}>角色</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>照護者</Text>
        </View>

        <Text style={styles.label}>註冊日期</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>{profile.id ? new Date().toLocaleDateString('zh-TW') : '—'}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={() => void handleSave()}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={saving ? '儲存中' : '儲存'}
      >
        <Text style={styles.saveButtonText}>{saving ? '儲存中...' : '儲存'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bgScreen },
  title: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: typography.headingLg.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  errorText: { color: colors.danger, fontSize: typography.bodyMd.fontSize, marginBottom: spacing.sm },
  retryText: { color: colors.primary, fontSize: typography.bodyMd.fontSize, textDecorationLine: 'underline' },
  errorBox: {
    backgroundColor: colors.dangerLight, borderRadius: radius.sm,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  errorBoxText: { color: colors.danger, fontSize: typography.bodyMd.fontSize, textAlign: 'center' },
  sectionLabel: {
    fontSize: 10, fontWeight: '500', color: colors.textDisabled,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: spacing.xs, marginTop: spacing.sm,
  },
  section: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.low,
  },
  label: {
    fontSize: typography.bodyMd.fontSize, fontWeight: '600', color: colors.textSecondary,
    marginBottom: spacing.sm, marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.bgScreen, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.sm, padding: spacing.md, fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
  },
  readOnlyField: {
    backgroundColor: colors.bgSurfaceAlt, borderRadius: radius.sm,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderDefault,
  },
  readOnlyText: {
    fontSize: typography.bodyMd.fontSize, color: colors.textDisabled,
  },
  saveButton: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: spacing.lg - spacing.xxs, alignItems: 'center',
    ...shadows.high,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: colors.white, fontSize: typography.bodyLg.fontSize, fontWeight: '600' },
});
