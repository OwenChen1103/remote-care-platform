/**
 * Role-aware deep-link resolver for notifications (Section 2.9.3).
 *
 * Both `home/notifications.tsx` (provider/caregiver shared screen) and
 * `patient/schedule.tsx` (patient's notification card) call into this helper
 * when a notification is tapped — it computes the correct destination per role
 * and notification type. Returning `null` means "this notification has no
 * actionable target for this role"; callers should still mark-as-read but skip nav.
 */
import type { Router } from 'expo-router';

export type Role = 'caregiver' | 'patient' | 'provider' | 'admin';

export interface DeepLinkTarget {
  pathname: string;
  params?: Record<string, string>;
}

export function notificationDeepLink(
  type: string,
  data: Record<string, unknown> | null,
  role: Role,
): DeepLinkTarget | null {
  if (!data) return null;
  const sid = data.service_request_id as string | undefined;
  const targetStatus = data.target_status as string | undefined;
  const recipientId = data.recipient_id as string | undefined;

  switch (type) {
    case 'service_request_update':
      if (!sid) return null;
      if (role === 'caregiver') {
        return { pathname: '/(tabs)/services/[requestId]', params: { requestId: sid } };
      }
      if (role === 'patient') {
        return { pathname: '/(tabs)/patient/schedule' };
      }
      if (role === 'provider') {
        // Decision B (auto-arrange) means provider sees `caregiver_confirmed` notification
        // and goes to `provider-confirm` (the accept/reject screen). All later statuses
        // route to provider-task-detail (their normal task view).
        if (targetStatus === 'caregiver_confirmed') {
          return { pathname: '/(tabs)/services/provider-confirm', params: { requestId: sid } };
        }
        return { pathname: '/(tabs)/services/provider-task-detail', params: { taskId: sid } };
      }
      // admin uses web — no mobile target
      return null;

    case 'abnormal_alert':
      // Caregiver-only — patients/providers don't get these.
      if (role !== 'caregiver') return null;
      if (recipientId) {
        return { pathname: '/(tabs)/health', params: { recipient_id: recipientId } };
      }
      return { pathname: '/(tabs)/health' };

    case 'measurement_reminder':
      if (role !== 'caregiver') return null;
      return { pathname: '/(tabs)/health' };

    case 'appointment_reminder':
      // Caregiver → home appointments list; patient → their schedule (read-only mirror).
      if (role === 'caregiver') return { pathname: '/(tabs)/home/appointments' };
      if (role === 'patient') return { pathname: '/(tabs)/patient/schedule' };
      return null;

    case 'ai_report_ready':
      if (role !== 'caregiver') return null;
      return recipientId
        ? { pathname: '/(tabs)/health/ai-report', params: { recipient_id: recipientId } }
        : { pathname: '/(tabs)/home' };

    case 'provider_review_result':
      // Notification sent by /providers/[id]/review — provider only.
      if (role !== 'provider') return null;
      return { pathname: '/(tabs)/services/provider-profile' };

    default:
      return null;
  }
}

/**
 * Convenience: resolve + navigate in one call. Returns `false` if no target.
 * Caller still handles mark-as-read independently (always do that, regardless
 * of whether navigation happens).
 */
export function navigateNotification(
  router: Router,
  type: string,
  data: Record<string, unknown> | null,
  role: Role,
): boolean {
  const target = notificationDeepLink(type, data, role);
  if (!target) return false;
  // expo-router accepts both `string` pathname and `{ pathname, params }` object.
  if (target.params) {
    router.push({ pathname: target.pathname, params: target.params } as Parameters<Router['push']>[0]);
  } else {
    router.push(target.pathname as Parameters<Router['push']>[0]);
  }
  return true;
}
