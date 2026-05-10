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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, ApiError } from '@/lib/auth-context';
import { routeAfterAuth } from '@/lib/post-auth-route';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';

const ROLE_OPTIONS = [
  { key: 'caregiver' as const, label: '委託人（家屬）', desc: '為家人安排照護服務' },
  { key: 'patient' as const, label: '被照護者', desc: '需家屬以您註冊的 Email 邀請後使用' },
  { key: 'provider' as const, label: '服務人員', desc: '需提交專業資料審核（約 1–2 個工作天）' },
];

// Mirror server-side RegisterSchema (packages/shared/src/schemas/auth.ts):
// 8+ chars, must contain lowercase + uppercase + digit. Catching this client-side
// gives instant feedback instead of a server round-trip rejection.
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleRegister() {
    if (!name || !email || !password) {
      setError('請填寫姓名、Email 和密碼');
      return;
    }
    if (password !== confirmPassword) {
      setError('兩次密碼輸入不一致');
      return;
    }
    if (!PASSWORD_RE.test(password)) {
      setError('密碼需 8 字元以上，並包含大寫、小寫字母與數字');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const u = await register({ email, password, name, phone: phone || undefined, role });
      // Section 4.1.9 — newly-registered patient lands on summary (will see empty state until
      // caregiver invites them); newly-registered provider lands on profile (review_status=pending).
      await routeAfterAuth(u, router);
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
        colors={['#E5F2FB', '#F8FAFC']}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo icon + Title */}
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/whocares-icon.png')}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <Text style={styles.title}>建立帳號</Text>
          <Text style={styles.subtitle}>加入 WhoCares，一起守護家人健康</Text>
        </View>

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
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="密碼（至少 8 字元，含大小寫與數字）"
              placeholderTextColor={colors.textDisabled}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={styles.passwordToggleText}>
                {showPassword ? '隱藏' : '顯示'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="確認密碼"
              placeholderTextColor={colors.textDisabled}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowConfirmPassword((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={styles.passwordToggleText}>
                {showConfirmPassword ? '隱藏' : '顯示'}
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingTop: 100,
    paddingBottom: 80,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  logoIcon: {
    width: 64,
    height: 64,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.headingXl,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
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
    borderRadius: radius.xl,
    paddingVertical: spacing.md + spacing.xs,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
  },
  roleCardActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    ...shadows.low,
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

  // Password field with show/hide toggle
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 64,
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: spacing.md,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  passwordToggleText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '500',
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
