import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '@/lib/theme';

interface EmptyStateProps {
  /** Title explaining what is empty */
  title: string;
  /** Description guiding the user toward the action that populates this area */
  description?: string;
  /** Action button label */
  actionLabel?: string;
  /** Action callback — if provided with actionLabel, shows a button */
  onAction?: () => void;
}

/**
 * EmptyState — Guidance-oriented empty list/page display
 *
 * Every FlatList and table should show this when data is empty.
 * The description should explain what data would appear and how to create it.
 *
 * Spec alignment: P.3 requires "所有列表頁皆有 empty state"
 * UX principle P10: "Empty states should teach, not just inform"
 *
 * Usage:
 *   <EmptyState
 *     title="尚無量測紀錄"
 *     description="定期記錄血壓與血糖，有助於掌握健康狀況。"
 *     actionLabel="開始記錄"
 *     onAction={handleAdd}
 *   />
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onAction}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['3xl'],
  },
  title: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: typography.headingSm.fontWeight,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  actionText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
  },
});
