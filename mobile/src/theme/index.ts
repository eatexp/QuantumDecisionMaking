/**
 * Theme Constants
 *
 * Centralized design system for consistent UI across the app.
 * Based on iOS/Android design guidelines and accessibility standards.
 */

export const Colors = {
  // Primary
  primary: '#007AFF',
  primaryDark: '#0051D5',
  primaryLight: '#3395FF',

  // Success (outcomes, achievements, streaks)
  success: '#34C759',
  successDark: '#248A3D',
  successLight: '#5DD97C',

  // Warning (biases, attention needed)
  warning: '#FF9500',
  warningDark: '#C97500',
  warningLight: '#FFB340',

  // Error (validation, destructive actions)
  error: '#FF3B30',
  errorDark: '#C4261D',
  errorLight: '#FF6259',

  // Accent (insights, premium)
  accent: '#AF52DE',
  accentDark: '#8944AB',
  accentLight: '#C67EE8',

  // Neutrals
  black: '#000000',
  darkGray: '#1C1C1E',
  gray: '#8E8E93',
  lightGray: '#C7C7CC',
  veryLightGray: '#E5E5EA',
  offWhite: '#F2F2F7',
  white: '#FFFFFF',

  // Semantic
  background: '#FFFFFF',
  backgroundSecondary: '#F2F2F7',
  surface: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  textTertiary: '#8E8E93',
  textLight: '#8E8E93', // Alias for textTertiary
  border: '#C7C7CC',
  borderLight: '#E5E5EA', // Alias for divider
  divider: '#E5E5EA',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
} as const;

export const Typography = {
  // Font families
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },

  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
    huge: 34,
  },

  // Font weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
} as const;

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

export const Layout = {
  screenPadding: Spacing.base,
  cardPadding: Spacing.base,
  sectionSpacing: Spacing.xl,
  itemSpacing: Spacing.md,
} as const;

// Insight type colors
export const InsightColors = {
  correlation: Colors.accent,
  bias_detection: Colors.warning,
  accuracy_tracking: Colors.primary,
  pattern: Colors.success,
  achievement: Colors.success,
  suggestion: Colors.primary,
} as const;

// Insight type icons
export const InsightIcons = {
  correlation: '📊',
  bias_detection: '⚠️',
  accuracy_tracking: '🎯',
  pattern: '🔍',
  achievement: '🏆',
  suggestion: '💡',
} as const;
