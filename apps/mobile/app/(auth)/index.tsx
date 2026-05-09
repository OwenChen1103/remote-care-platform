import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, radius } from '@/lib/theme';

// ─── Brand Colors (logo: sky blue + nature green) ─────────────
const BRAND = {
  dark: '#1B6DA0',
  mid: '#2E8DC9',
  accent: '#5DA945',
  light: '#7FBEE3',
  bg: 'rgba(46,141,201,0.06)',
  border: 'rgba(46,141,201,0.12)',
} as const;

// Section 4.2.5: SocialIcon stub removed — social login (FB/G/LINE) is Phase 2 scope per TODO.md.

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

        {/* Section 4.2.5: social login row removed — Phase 2 scope per TODO.md. */}

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
  // (Section 4.2.5: unused domain/subtitle styles removed — logo image contains all brand elements)

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

  // Section 4.2.5: removed unused styles for the social-login + ad-placeholder + footer placeholders.
});
