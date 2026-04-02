/**
 * Mobile Design Tokens — Single Source of Truth
 *
 * All UI styling in the mobile app should reference these tokens.
 * Do not use raw hex values or magic numbers in page/component files.
 *
 * Design direction: "Warm & Caring" — soft purple + rose accents
 * Target emotion: like a trusted family member, not a clinical tool
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const colors = {
  // Backgrounds
  bgScreen: '#FAF9FC',        // very faint warm lavender (not cold gray)
  bgSurface: '#FFFFFF',
  bgSurfaceAlt: '#F4F2F7',    // warm purple-tinted gray

  // Borders
  borderDefault: '#E8E5EE',   // warm lavender border
  borderStrong: '#D4D0DC',

  // Primary (warm purple family)
  primary: '#6C63FF',          // warm purple — friendly, not corporate
  primaryLight: '#EEEDFF',     // soft lavender tint
  primaryText: '#5B52E0',      // readable purple for text-on-light

  // Accent (rose family — warmth + care)
  accent: '#FF8FA4',           // rose pink — used sparingly for warmth
  accentLight: '#FFF0F3',      // whisper rose background

  // Text
  textPrimary: '#1E1B2E',     // deep purple-black (warmer than pure black)
  textSecondary: '#44405A',   // warm gray-purple
  textTertiary: '#7A7594',    // muted lavender gray
  textDisabled: '#ADA8C2',    // soft purple-gray

  // Semantic — Success (warm green family)
  success: '#2D9F5D',         // slightly warmer green
  successLight: '#E8F8EE',

  // Semantic — Warning (warm amber family)
  warning: '#D4930A',         // golden amber
  warningLight: '#FFF7E0',

  // Semantic — Danger (warm red, not alarming)
  danger: '#E54D4D',          // soft warm red
  dangerLight: '#FEE8E8',

  // Semantic — Info
  info: '#6C63FF',
  infoLight: '#EEEDFF',

  // Status Tints — ultra-subtle background tints for status-aware card zones
  statusTintStable: '#F2FAF5',
  statusTintAttention: '#FFFBF0',
  statusTintConsultDoctor: '#FEF5F5',

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
    shadowColor: '#6C63FF',    // tinted shadow — warmer than black
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  high: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;
