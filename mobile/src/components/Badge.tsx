/**
 * Badge Component
 *
 * Reusable badge for counts, streaks, and status indicators
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'neutral';
type BadgeSize = 'small' | 'medium' | 'large';

interface BadgeProps {
  value: string | number;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
}

export function Badge({
  value,
  variant = 'primary',
  size = 'medium',
  style,
}: BadgeProps): React.JSX.Element {
  const badgeStyle = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    style,
  ];

  const textStyle = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
  ];

  return (
    <View style={badgeStyle}>
      <Text style={textStyle}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Variants
  primary: {
    backgroundColor: Colors.primary,
  },
  success: {
    backgroundColor: Colors.success,
  },
  warning: {
    backgroundColor: Colors.warning,
  },
  error: {
    backgroundColor: Colors.error,
  },
  neutral: {
    backgroundColor: Colors.textLight,
  },

  // Sizes
  size_small: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: Spacing.xs,
  },
  size_medium: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: Spacing.xs,
  },
  size_large: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: Spacing.sm,
  },

  // Text styles
  text: {
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
    textAlign: 'center',
  },
  text_primary: {
    color: Colors.white,
  },
  text_success: {
    color: Colors.white,
  },
  text_warning: {
    color: Colors.white,
  },
  text_error: {
    color: Colors.white,
  },
  text_neutral: {
    color: Colors.white,
  },
  text_small: {
    fontSize: Typography.fontSize.xs,
    lineHeight: 12,
  },
  text_medium: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 14,
  },
  text_large: {
    fontSize: Typography.fontSize.base,
    lineHeight: 16,
  },
});
