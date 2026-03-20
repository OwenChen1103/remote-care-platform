import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius, typography } from '@/lib/theme';
import {
  SERVICE_REQUEST_STATUS_DISPLAY,
  AI_STATUS_DISPLAY,
  PROVIDER_REVIEW_STATUS_DISPLAY,
  PROVIDER_AVAILABILITY_DISPLAY,
  type StatusDisplayConfig,
} from '@remote-care/shared';

type StatusType =
  | 'serviceRequest'
  | 'aiHealth'
  | 'providerReview'
  | 'providerAvailability';

interface StatusPillProps {
  /** The raw status value (e.g. 'submitted', 'stable', 'pending', 'available') */
  status: string;
  /** Which status domain this belongs to */
  type: StatusType;
}

const DISPLAY_MAPS: Record<StatusType, Record<string, StatusDisplayConfig>> = {
  serviceRequest: SERVICE_REQUEST_STATUS_DISPLAY,
  aiHealth: AI_STATUS_DISPLAY,
  providerReview: PROVIDER_REVIEW_STATUS_DISPLAY,
  providerAvailability: PROVIDER_AVAILABILITY_DISPLAY,
};

/**
 * StatusPill — Unified status badge
 *
 * Renders a colored pill with text label.
 * Colors and labels come from packages/shared status-display constants.
 *
 * Usage:
 *   <StatusPill status="submitted" type="serviceRequest" />
 *   <StatusPill status="stable" type="aiHealth" />
 *   <StatusPill status="approved" type="providerReview" />
 */
export function StatusPill({ status, type }: StatusPillProps) {
  const displayMap = DISPLAY_MAPS[type];
  const config = displayMap?.[status];

  // Fallback for unknown status values
  const label = config?.label ?? status;
  const textColor = config?.color ?? '#6B7280';
  const bgColor = config?.bg ?? '#F3F4F6';

  return (
    <View
      style={[styles.pill, { backgroundColor: bgColor }]}
      accessibilityLabel={label}
      accessibilityRole="text"
    >
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: {
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
  },
});
