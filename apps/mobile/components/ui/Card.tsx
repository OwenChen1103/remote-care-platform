import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { colors, radius, spacing, shadows } from '@/lib/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** If provided, the card becomes pressable */
  onPress?: () => void;
  /** Visual variant */
  variant?: 'default' | 'selected';
}

/**
 * Card — Primary content container
 *
 * Provides consistent bg, border, radius, shadow, and padding
 * across all card-based layouts in the mobile app.
 *
 * Usage:
 *   <Card>...content...</Card>
 *   <Card onPress={handleTap} variant="selected">...content...</Card>
 */
export function Card({ children, style, onPress, variant = 'default' }: CardProps) {
  const cardStyle = [
    styles.base,
    variant === 'selected' && styles.selected,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadows.low,
  },
  selected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
});
