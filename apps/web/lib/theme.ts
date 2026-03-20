/**
 * Web Admin Design Tokens — Tailwind Class Mappings
 *
 * All admin pages should reference these constants for consistent styling.
 * These map semantic names to Tailwind utility classes.
 *
 * Aligned with: ux-refinement-framework-v1.md Section 3
 */

// ---------------------------------------------------------------------------
// Colors (as Tailwind class fragments)
// ---------------------------------------------------------------------------

export const tw = {
  // Backgrounds
  bgScreen: 'bg-gray-50',
  bgSurface: 'bg-white',
  bgSurfaceAlt: 'bg-gray-100',

  // Borders
  borderDefault: 'border-gray-200',
  borderStrong: 'border-gray-300',

  // Primary
  primaryBg: 'bg-blue-600',
  primaryBgHover: 'hover:bg-blue-700',
  primaryText: 'text-blue-600',
  primaryLightBg: 'bg-blue-100',
  primaryLightText: 'text-blue-700',

  // Text
  textPrimary: 'text-gray-900',
  textSecondary: 'text-gray-700',
  textTertiary: 'text-gray-500',
  textDisabled: 'text-gray-400',

  // Semantic — Success
  successBg: 'bg-green-600',
  successBgHover: 'hover:bg-green-700',
  successText: 'text-green-700',
  successLightBg: 'bg-green-100',
  successLightText: 'text-green-800',

  // Semantic — Warning
  warningText: 'text-yellow-700',
  warningLightBg: 'bg-yellow-100',
  warningLightText: 'text-yellow-800',

  // Semantic — Danger
  dangerBg: 'bg-red-600',
  dangerBgHover: 'hover:bg-red-700',
  dangerText: 'text-red-600',
  dangerLightBg: 'bg-red-100',
  dangerLightText: 'text-red-700',

  // Semantic — Info
  infoLightBg: 'bg-blue-100',
  infoLightText: 'text-blue-800',
} as const;

// ---------------------------------------------------------------------------
// Typography (as Tailwind class combinations)
// ---------------------------------------------------------------------------

export const twTypography = {
  headingPage: 'text-2xl font-bold',
  headingSection: 'text-lg font-semibold',
  headingSub: 'text-base font-medium',
  body: 'text-sm',
  caption: 'text-xs',
} as const;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const twLayout = {
  pagePadding: 'p-6',
  cardPadding: 'p-6',
  cardBorder: 'rounded-lg border border-gray-200',
  cardFull: 'rounded-lg border border-gray-200 bg-white p-6',
  tableHeader: 'bg-gray-50 text-sm font-medium text-gray-700',
  tableCell: 'px-4 py-3 text-sm',
  tableDivide: 'divide-y divide-gray-200',
  badgePill: 'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
} as const;
