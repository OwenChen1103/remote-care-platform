import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  Text,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Toast Types
// ---------------------------------------------------------------------------

type ToastVariant = 'success' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  text: string;
  variant: ToastVariant;
}

interface ToastProps {
  /** Message to display — null hides the toast */
  message: ToastMessage | null;
  /** Duration in ms before auto-dismiss (default 2500) */
  duration?: number;
  /** Called when the toast finishes dismissing */
  onDismiss?: () => void;
}

// ---------------------------------------------------------------------------
// Variant Styles
// ---------------------------------------------------------------------------

const VARIANT_STYLES: Record<ToastVariant, { bg: string; accent: string; text: string }> = {
  success: {
    bg: colors.bgSurface,
    accent: colors.success,
    text: colors.textPrimary,
  },
  info: {
    bg: colors.bgSurface,
    accent: colors.primary,
    text: colors.textPrimary,
  },
  warning: {
    bg: colors.bgSurface,
    accent: colors.warning,
    text: colors.textPrimary,
  },
};

// ---------------------------------------------------------------------------
// Toast Component
// ---------------------------------------------------------------------------

/**
 * Toast — Non-blocking success/info feedback
 *
 * Bottom-positioned, auto-dismissing notification.
 * Uses React Native Animated API (no external dependency).
 *
 * UX principle P11: "Feedback should be immediate, consistent, and non-blocking"
 *
 * Usage in a page:
 *   const [toast, setToast] = useState<ToastMessage | null>(null);
 *
 *   // On success:
 *   setToast({ id: Date.now().toString(), text: '量測紀錄已儲存', variant: 'success' });
 *
 *   // In render:
 *   <Toast message={toast} onDismiss={() => setToast(null)} />
 */
export function Toast({ message, duration = 2500, onDismiss }: ToastProps) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  }, [translateY, opacity, onDismiss]);

  useEffect(() => {
    if (!message) return;

    // Slide in
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(dismiss, duration);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [message?.id, duration, dismiss, translateY, opacity]);

  if (!message) return null;

  const variantStyle = VARIANT_STYLES[message.variant];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: variantStyle.bg,
          borderLeftColor: variantStyle.accent,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.text, { color: variantStyle.text }]}>
        {message.text}
      </Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Helper to create toast messages
// ---------------------------------------------------------------------------

export function createToast(text: string, variant: ToastVariant = 'success'): ToastMessage {
  return { id: Date.now().toString(), text, variant };
}

// Re-export types for consumers
export type { ToastMessage, ToastVariant };

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing['3xl'],
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: spacing.md,
    ...shadows.high,
  } as ViewStyle,
  text: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '500',
  },
});
