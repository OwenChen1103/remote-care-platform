/**
 * Mobile Design Tokens — Single Source of Truth
 *
 * All UI styling in the mobile app should reference these tokens.
 * Do not use raw hex values or magic numbers in page/component files.
 *
 * Aligned with: ux-refinement-framework-v1.md Section 3
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const colors = {
  // Backgrounds
  bgScreen: '#F9FAFB',
  bgSurface: '#FFFFFF',
  bgSurfaceAlt: '#F3F4F6',

  // Borders
  borderDefault: '#E5E7EB',
  borderStrong: '#D1D5DB',

  // Primary (blue family)
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  primaryText: '#1D4ED8',

  // Text
  textPrimary: '#111827',
  textSecondary: '#374151',
  textTertiary: '#6B7280',
  textDisabled: '#9CA3AF',

  // Semantic — Success (green family)
  success: '#15803D',
  successLight: '#DCFCE7',

  // Semantic — Warning (yellow family)
  warning: '#A16207',
  warningLight: '#FEF9C3',

  // Semantic — Danger (red family)
  danger: '#DC2626',
  dangerLight: '#FEE2E2',

  // Semantic — Info (blue family, same as primary)
  info: '#2563EB',
  infoLight: '#DBEAFE',

  // Constant
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const typography = {
  headingXl: { fontSize: 24, fontWeight: '700' as const },
  headingLg: { fontSize: 20, fontWeight: '700' as const },
  headingMd: { fontSize: 17, fontWeight: '600' as const },
  headingSm: { fontSize: 15, fontWeight: '600' as const },
  bodyLg: { fontSize: 16, fontWeight: '400' as const },
  bodyMd: { fontSize: 14, fontWeight: '400' as const },
  bodySm: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  captionSm: { fontSize: 11, fontWeight: '400' as const },
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
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Shadows / Elevation
// ---------------------------------------------------------------------------

export const shadows = {
  low: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  high: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
} as const;
