import { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, ApiError } from '@/lib/auth-context';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';

const ROLE_OPTIONS = [
  { key: 'caregiver' as const, label: '委託人（家屬）', desc: '為家人安排照護服務' },
  { key: 'patient' as const, label: '被照護者', desc: '查看自己的健康資料' },
  { key: 'provider' as const, label: '服務人員', desc: '提供照護服務（需審核）' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'caregiver' | 'patient' | 'provider'>('caregiver');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name || !email || !password) {
      setError('請填寫姓名、Email 和密碼');
      return;
    }
    if (password !== confirmPassword) {
      setError('兩次密碼輸入不一致');
      return;
    }
    if (password.length < 8) {
      setError('密碼至少 8 個字元');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await register({ email, password, name, phone: phone || undefined, role });
      router.replace('/(tabs)/home');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('網路錯誤，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#F0EEFF', '#FAF9FC']}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>建立帳號</Text>

        {/* Role selector */}
        <View style={styles.roleSection}>
          <Text style={styles.sectionLabel}>選擇身份</Text>
          <View style={styles.roleColumn}>
            {ROLE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.roleCard, role === opt.key && styles.roleCardActive]}
                onPress={() => setRole(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.roleLabel, role === opt.key && styles.roleLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={[styles.roleDesc, role === opt.key && styles.roleDescActive]}>
                  {opt.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Form card */}
        <View style={styles.formCard}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder="姓名"
            placeholderTextColor={colors.textDisabled}
            value={name}
            onChangeText={setName}
            autoComplete="name"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textDisabled}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="密碼（至少 8 字元，含大小寫與數字）"
            placeholderTextColor={colors.textDisabled}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          <TextInput
            style={styles.input}
            placeholder="確認密碼"
            placeholderTextColor={colors.textDisabled}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
          <TextInput
            style={[styles.input, styles.inputLast]}
            placeholder="電話（選填）"
            placeholderTextColor={colors.textDisabled}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
        </View>

        {/* Register button */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>註冊</Text>
          )}
        </TouchableOpacity>

        {/* Back link */}
        <TouchableOpacity onPress={() => router.back()} style={styles.linkWrapper}>
          <Text style={styles.link}>已有帳號？登入</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flexGrow: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: 56,
    paddingBottom: 40,
  },

  // Title
  title: {
    ...typography.headingXl,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },

  // Role selector
  roleSection: {
    marginBottom: spacing['2xl'],
  },
  sectionLabel: {
    ...typography.headingSm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  roleColumn: {
    gap: spacing.md,
  },
  roleCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.low,
  },
  roleCardActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  roleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  roleLabelActive: {
    color: colors.primary,
  },
  roleDesc: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  roleDescActive: {
    color: colors.primaryText,
  },

  // Form card
  formCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 28,
    padding: spacing['2xl'],
    marginBottom: spacing['2xl'],
    ...shadows.high,
  },

  // Error
  errorBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },

  // Inputs
  input: {
    backgroundColor: colors.bgSurfaceAlt,
    borderRadius: radius.full,
    borderWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 20,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  inputLast: {
    marginBottom: 0,
  },

  // Register button
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: spacing['2xl'],
    ...shadows.high,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // Back link
  linkWrapper: {
    alignItems: 'center',
  },
  link: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
  },
});
