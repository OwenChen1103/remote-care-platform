import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useAuth, ApiError } from '@/lib/auth-context';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';

function HeartIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        fill={colors.accent}
        opacity={0.6}
      />
      <Path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        stroke={colors.primary}
        strokeWidth={1.5}
        fill="none"
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError('請填寫 Email 和密碼');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await login(email, password);
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
    <LinearGradient
      colors={['#F0EEFF', '#FAF9FC']}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          {/* Logo area */}
          <View style={styles.logoWrapper}>
            <View style={styles.logoCircle}>
              <HeartIcon />
            </View>
          </View>

          {/* Welcome text */}
          <Text style={styles.title}>遠端照護平台</Text>
          <Text style={styles.subtitle}>歡迎回來</Text>

          {/* Form card */}
          <View style={styles.card}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

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
              style={[styles.input, styles.inputLast]}
              placeholder="密碼"
              placeholderTextColor={colors.textDisabled}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>登入</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Register link */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
            style={styles.registerWrapper}
          >
            <Text style={styles.registerLink}>還沒有帳號？註冊</Text>
          </TouchableOpacity>

          {/* Quick login for demo */}
          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>快速登入</Text>
            <View style={styles.demoRow}>
              {[
                { label: '委託人', email: 'demo@remotecare.dev', pw: 'Demo1234!' },
                { label: '服務人員', email: 'provider.demo@remotecare.dev', pw: 'Provider1234!' },
                { label: '被照護者', email: 'patient.demo@remotecare.dev', pw: 'Patient1234!' },
              ].map((d) => (
                <TouchableOpacity
                  key={d.label}
                  style={styles.demoBtn}
                  onPress={() => { setEmail(d.email); setPassword(d.pw); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.demoBtnText}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['3xl'],
  },

  // Logo
  logoWrapper: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.high,
  },

  // Welcome text
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: colors.textTertiary,
    marginBottom: spacing['3xl'],
  },

  // Form card
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: 28,
    padding: spacing['2xl'],
    marginBottom: spacing['3xl'],
    ...shadows.high,
  },

  // Error
  errorContainer: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  inputLast: {
    marginBottom: spacing['2xl'],
  },

  // Button
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadows.high,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // Register link
  registerWrapper: {
    alignItems: 'center',
  },
  registerLink: {
    color: colors.primaryText,
    fontSize: 15,
    textAlign: 'center',
  },
  demoSection: {
    marginTop: spacing['3xl'],
    alignItems: 'center',
  },
  demoTitle: {
    fontSize: typography.caption.fontSize,
    color: colors.textDisabled,
    marginBottom: spacing.sm,
  },
  demoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  demoBtn: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...shadows.low,
  },
  demoBtnText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.textTertiary,
  },
});
