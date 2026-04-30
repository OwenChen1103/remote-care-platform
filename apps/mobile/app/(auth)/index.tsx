import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';

// ─── Brand Colors (logo: sky blue + nature green) ─────────────
const BRAND = {
  dark: '#1B6DA0',
  mid: '#2E8DC9',
  accent: '#5DA945',
  light: '#7FBEE3',
  bg: 'rgba(46,141,201,0.06)',
  border: 'rgba(46,141,201,0.12)',
} as const;

// ─── Social Login Placeholder ────────────────────────────────
function SocialIcon({ label }: { label: string }) {
  return (
    <View style={s.socialIcon}>
      <Text style={s.socialIconText}>{label}</Text>
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────
export default function LandingScreen() {
  const router = useRouter();

  return (
    <LinearGradient colors={['#F8FAFC', '#E5F2FB', '#F8FAFC']} locations={[0, 0.4, 1]} style={s.container}>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Brand Logo ──────────────────────── */}
        <View style={s.logoArea}>
          <Image
            source={require('@/assets/images/whocares-logo.png')}
            style={s.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* ── CTA Buttons ──────────────────────── */}
        <View style={s.ctaArea}>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={s.primaryBtnText}>開始安排</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.7}
          >
            <Text style={s.secondaryBtnText}>會員註冊</Text>
          </TouchableOpacity>
        </View>

        {/* ── Social Login (MVP placeholder) ──── */}
        <View style={s.socialArea}>
          <View style={s.socialRow}>
            <SocialIcon label="FB" />
            <SocialIcon label="G" />
            <SocialIcon label="LINE" />
          </View>
          <Text style={s.socialHint}>更多登入方式即將開放</Text>
        </View>

      </ScrollView>
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['3xl'],
  },

  // Logo
  logoArea: { alignItems: 'center', marginBottom: spacing['3xl'] },
  logoImage: { width: 300, height: 300, marginBottom: 0 },
  domainBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: '#FFFFFF', borderRadius: radius.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    marginTop: spacing.md,
    borderWidth: 1, borderColor: BRAND.border,
  },
  domainHeart: { fontSize: 11, color: BRAND.accent },
  domainText: { fontSize: typography.bodySm.fontSize, color: BRAND.dark, fontWeight: '600', letterSpacing: 0.5 },
  subtitle: {
    fontSize: 14, color: BRAND.mid, fontWeight: '500',
    letterSpacing: 8, marginTop: 0,
  },
  // (unused styles removed — logo image contains all brand elements)

  // CTA
  ctaArea: { width: '100%', gap: spacing.md, marginBottom: spacing['3xl'] },
  primaryBtn: {
    backgroundColor: BRAND.dark, borderRadius: radius.full,
    paddingVertical: spacing.lg + 4, alignItems: 'center',
    shadowColor: BRAND.dark, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 6,
  },
  primaryBtnText: { color: colors.white, fontSize: typography.bodyLg.fontSize, fontWeight: '700', letterSpacing: 2 },
  secondaryBtn: {
    backgroundColor: 'transparent', borderRadius: radius.full,
    borderWidth: 1.5, borderColor: BRAND.dark,
    paddingVertical: spacing.md + 2, alignItems: 'center',
  },
  secondaryBtnText: { color: BRAND.dark, fontSize: typography.bodyMd.fontSize, fontWeight: '600' },

  // Social
  socialArea: { alignItems: 'center', marginBottom: spacing['3xl'] },
  socialLabel: { fontSize: typography.caption.fontSize, color: colors.textDisabled, marginBottom: spacing.md },
  socialRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.sm },
  socialIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: BRAND.bg, borderWidth: 1, borderColor: BRAND.border,
    alignItems: 'center', justifyContent: 'center',
  },
  socialIconText: { fontSize: typography.bodySm.fontSize, color: BRAND.light, fontWeight: '600' },
  socialHint: { fontSize: typography.captionSm.fontSize, color: colors.textDisabled },

  // Ad placeholder
  adPlaceholder: {
    width: '100%', borderRadius: radius.xl,
    backgroundColor: BRAND.bg, borderWidth: 1, borderColor: BRAND.border,
    borderStyle: 'dashed',
    paddingVertical: spacing['3xl'], alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  adText: { fontSize: typography.bodySm.fontSize, color: colors.textDisabled },

  // Footer
  copyright: { fontSize: typography.captionSm.fontSize, color: colors.textDisabled },
});
