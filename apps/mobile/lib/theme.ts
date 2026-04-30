/**
 * Mobile Design Tokens — Single Source of Truth
 *
 * All UI styling in the mobile app should reference these tokens.
 * Do not use raw hex values or magic numbers in page/component files.
 *
 * Design direction: "Healthy & Trustworthy" — sky blue + nature green
 * Derived from WhoCares brand logo (hand cradling a leaf)
 * Target emotion: trusted health professional, fresh and reassuring
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const colors = {
  // Backgrounds
  bgScreen: '#F8FAFC',        // very faint blue-gray
  bgSurface: '#FFFFFF',
  bgSurfaceAlt: '#EFF4F8',    // soft blue-tinted surface

  // Borders
  borderDefault: '#E1E8EF',   // light blue-gray border
  borderStrong: '#C7D2DD',

  // Primary (sky blue — from logo's hand)
  primary: '#2E8DC9',          // confident sky blue
  primaryLight: '#E5F2FB',     // whisper blue background
  primaryText: '#1B6DA0',      // deep blue for text-on-light

  // Accent / Secondary (nature green — from logo's leaf)
  accent: '#5DA945',           // fresh nature green
  accentLight: '#EDF7E8',      // whisper green background

  // Secondary alias for clarity (same as accent)
  secondary: '#5DA945',
  secondaryLight: '#EDF7E8',
  secondaryText: '#3F7F2E',    // deep green for text

  // Text
  textPrimary: '#1A2B3A',     // deep blue-gray (almost black)
  textSecondary: '#4A6580',   // medium blue-gray
  textTertiary: '#8FA3B8',    // muted blue-gray
  textDisabled: '#B5C2CF',    // soft blue-gray

  // Semantic — Success (uses brand green)
  success: '#5DA945',
  successLight: '#EDF7E8',

  // Semantic — Warning (warm amber that pairs with blue/green)
  warning: '#E8A23B',
  warningLight: '#FEF3D9',

  // Semantic — Danger
  danger: '#D9534F',
  dangerLight: '#FDECEA',

  // Semantic — Info (same as primary)
  info: '#2E8DC9',
  infoLight: '#E5F2FB',

  // Status Tints — ultra-subtle background tints for status-aware card zones
  statusTintStable: '#F4FAF1',     // very faint green
  statusTintAttention: '#FFF9EC',  // very faint amber
  statusTintConsultDoctor: '#FDF3F2', // very faint red

  // Constant
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

// ---------------------------------------------------------------------------
// Font Family — Noto Sans TC (loaded in app/_layout.tsx)
// ---------------------------------------------------------------------------

export const fontFamily = {
  light: 'NotoSansTC_300Light',
  regular: 'NotoSansTC_400Regular',
  medium: 'NotoSansTC_500Medium',
  bold: 'NotoSansTC_700Bold',
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const typography = {
  headingXl: { fontSize: 28, fontWeight: '700' as const, fontFamily: fontFamily.bold },
  headingLg: { fontSize: 22, fontWeight: '700' as const, fontFamily: fontFamily.bold },
  headingMd: { fontSize: 17, fontWeight: '600' as const, fontFamily: fontFamily.medium },
  headingSm: { fontSize: 15, fontWeight: '600' as const, fontFamily: fontFamily.medium },
  bodyLg: { fontSize: 16, fontWeight: '400' as const, fontFamily: fontFamily.regular },
  bodyMd: { fontSize: 14, fontWeight: '400' as const, fontFamily: fontFamily.regular },
  bodySm: { fontSize: 13, fontWeight: '400' as const, fontFamily: fontFamily.regular },
  caption: { fontSize: 12, fontWeight: '400' as const, fontFamily: fontFamily.regular },
  captionSm: { fontSize: 11, fontWeight: '400' as const, fontFamily: fontFamily.regular },
  // Display — for hero numbers and scores
  display: { fontSize: 40, fontWeight: '700' as const, fontFamily: fontFamily.bold },
  displaySm: { fontSize: 28, fontWeight: '700' as const, fontFamily: fontFamily.bold },
} as const;

// ---------------------------------------------------------------------------
// Spacing (4px base grid)
// ---------------------------------------------------------------------------

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

// ---------------------------------------------------------------------------
// Border Radius
// ---------------------------------------------------------------------------

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,    // large cards, hero sections
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Shadows / Elevation
// ---------------------------------------------------------------------------

export const shadows = {
  low: {
    shadowColor: '#2E8DC9',    // tinted shadow — warmer than black
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  high: {
    shadowColor: '#2E8DC9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;
