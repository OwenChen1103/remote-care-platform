/**
 * Centralized fan-out for service-request lifecycle notifications (Section 2).
 *
 * Every transition route (status, propose-candidate, confirm-caregiver, confirm-provider,
 * cancel, progress, plus initial submitted via service-requests POST) calls
 * `notifyServiceRequestUpdate(...)` after its primary mutation succeeds.
 *
 * Design invariants:
 *   - Always non-blocking: a createMany failure logs but never throws to the route handler.
 *     The primary state-change must commit even if notifications fail.
 *   - Single notification type (`SERVICE_REQUEST_UPDATE`) for all SR transitions.
 *     Mobile discriminator is `data.target_status` (or `data.cancelled_by` etc).
 *   - All payloads carry `service_request_id` so mobile deep-link routes by role
 *     to the correct screen (see notification-deeplink util on mobile).
 *
 * `resolveProviderUserId` is the small lookup util that maps a provider table id
 * to its linked user_id (for sending notifications to the human provider, not the
 * abstract Provider profile).
 */
import { prisma } from '@/lib/prisma';
import { NOTIFICATION_TYPES } from '@remote-care/shared';
import type { Prisma } from '@prisma/client';

export interface ServiceRequestNotificationRecipients {
  caregiverUserId?: string | null;
  providerUserId?: string | null;
  notifyAllAdmins?: boolean;
}

export type ServiceRequestNotificationMessages = Partial<
  Record<'caregiver' | 'provider' | 'admin', { title: string; body: string }>
>;

export interface ServiceRequestNotificationInput {
  serviceRequestId: string;
  /** New status (or 'submitted' / 'cancelled' / 'screening' etc) — for mobile deep-link discriminator */
  targetStatus: string;
  recipients: ServiceRequestNotificationRecipients;
  /** Per-recipient title+body. Recipient with no entry doesn't receive a notification. */
  messages: ServiceRequestNotificationMessages;
  /** Extra data merged into the notification.data JSON (e.g. assigned_provider_id, reason). */
  extraData?: Record<string, unknown>;
}

export async function notifyServiceRequestUpdate(
  input: ServiceRequestNotificationInput,
): Promise<void> {
  const { serviceRequestId, targetStatus, recipients, messages, extraData } = input;

  // Outer try/catch wraps the ENTIRE helper. Both the admin findMany lookup AND the
  // createMany write must be best-effort — primary route mutations have already committed
  // before this helper is called, so any DB hiccup here must not propagate to the caller.
  try {
    const baseData = {
      service_request_id: serviceRequestId,
      target_status: targetStatus,
      ...(extraData ?? {}),
    };

    const rows: Prisma.NotificationCreateManyInput[] = [];

    if (recipients.caregiverUserId && messages.caregiver) {
      rows.push({
        user_id: recipients.caregiverUserId,
        type: NOTIFICATION_TYPES.SERVICE_REQUEST_UPDATE,
        title: messages.caregiver.title,
        body: messages.caregiver.body,
        data: { ...baseData, recipient_role: 'caregiver' } as Prisma.InputJsonValue,
      });
    }
    if (recipients.providerUserId && messages.provider) {
      rows.push({
        user_id: recipients.providerUserId,
        type: NOTIFICATION_TYPES.SERVICE_REQUEST_UPDATE,
        title: messages.provider.title,
        body: messages.provider.body,
        data: { ...baseData, recipient_role: 'provider' } as Prisma.InputJsonValue,
      });
    }
    if (recipients.notifyAllAdmins && messages.admin) {
      const admins = await prisma.user.findMany({
        where: { role: 'admin', suspended_at: null },
        select: { id: true },
      });
      for (const a of admins) {
        rows.push({
          user_id: a.id,
          type: NOTIFICATION_TYPES.SERVICE_REQUEST_UPDATE,
          title: messages.admin.title,
          body: messages.admin.body,
          data: { ...baseData, recipient_role: 'admin' } as Prisma.InputJsonValue,
        });
      }
    }

    if (rows.length === 0) return;
    await prisma.notification.createMany({ data: rows });
  } catch (err) {
    console.error('[service-notifications] notify failed', {
      serviceRequestId,
      targetStatus,
      err,
    });
  }
}

/**
 * Resolves a Provider.id (DB row id) to its linked User.id (the human's account).
 * Returns null if provider is unlinked (legacy data) or doesn't exist.
 */
export async function resolveProviderUserId(providerId: string | null | undefined): Promise<string | null> {
  if (!providerId) return null;
  const p = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { user_id: true },
  });
  return p?.user_id ?? null;
}
