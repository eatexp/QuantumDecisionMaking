/**
 * Card Component
 *
 * Reusable card container with shadow variants
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../theme';

type CardVariant = 'flat' | 'elevated' | 'outlined';

interface CardProps {
  variant?: CardVariant;
  padding?: keyof typeof Spacing;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({
  variant = 'elevated',
  padding = 'base',
  children,
  style,
}: CardProps): React.JSX.Element {
  const cardStyle = [
    styles.base,
    styles[variant],
    { padding: Spacing[padding] },
    style,
  ];

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  flat: {
    // No shadow
  },
  elevated: {
    ...Shadows.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
