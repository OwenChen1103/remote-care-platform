import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '@/lib/theme';

interface ErrorStateProps {
  /** Error message to display */
  message?: string;
  /** Retry callback — if provided, shows a retry button */
  onRetry?: () => void;
  /** Custom retry button label */
  retryLabel?: string;
}

/**
 * ErrorState — Inline error display with optional retry
 *
 * Used when a data fetch fails or an operation encounters an error.
 * Renders inline within the content area, not as a full-screen takeover.
 *
 * Spec alignment: P.3 requires "前端顯示人類可讀錯誤"
 *
 * Usage:
 *   <ErrorState message="載入失敗" onRetry={refetch} />
 */
export function ErrorState({
  message = '載入失敗，請稍後再試',
  onRetry,
  retryLabel = '重試',
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
        >
          <Text style={styles.retryText}>{retryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  message: {
    color: colors.danger,
    fontSize: typography.bodyMd.fontSize,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  retryText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
  },
});
