/**
 * Centralized recipient access policy (Section 3 / Decision H).
 *
 * Use in NEW routes that need role-aware ownership checks against a Recipient.
 * Existing routes (recipients/[id], measurements, etc.) keep their inline checks
 * — Decision H deliberately scopes this helper to new code, not a refactor.
 *
 * Typical usage:
 *   const access = await ensureRecipientAccess(auth, recipientId, {
 *     caregiver: true, patient: true, provider: false, admin: true,
 *   });
 *   if (!access.ok) return errorResponse(...);
 *   // access.recipient is the typed recipient handle
 */
import { prisma } from '@/lib/prisma';
import type { AuthPayload } from '@/lib/auth';

export type RecipientAccessResult =
  | { ok: true; recipient: { id: string; caregiver_id: string; patient_user_id: string | null } }
  | { ok: false; code: 'RESOURCE_NOT_FOUND' | 'RESOURCE_OWNERSHIP_DENIED' | 'AUTH_FORBIDDEN' };

export interface RecipientAccessPolicy {
  caregiver?: boolean;
  patient?: boolean;
  provider?: boolean;
  admin?: boolean;
}

export async function ensureRecipientAccess(
  auth: AuthPayload,
  recipientId: string,
  policy: RecipientAccessPolicy,
): Promise<RecipientAccessResult> {
  const recipient = await prisma.recipient.findFirst({
    where: { id: recipientId, deleted_at: null },
    select: { id: true, caregiver_id: true, patient_user_id: true },
  });
  if (!recipient) return { ok: false, code: 'RESOURCE_NOT_FOUND' };

  switch (auth.role) {
    case 'caregiver':
      if (!policy.caregiver) return { ok: false, code: 'AUTH_FORBIDDEN' };
      if (recipient.caregiver_id !== auth.userId) return { ok: false, code: 'RESOURCE_OWNERSHIP_DENIED' };
      return { ok: true, recipient };
    case 'patient':
      if (!policy.patient) return { ok: false, code: 'AUTH_FORBIDDEN' };
      if (recipient.patient_user_id !== auth.userId) return { ok: false, code: 'RESOURCE_OWNERSHIP_DENIED' };
      return { ok: true, recipient };
    case 'provider':
      if (!policy.provider) return { ok: false, code: 'AUTH_FORBIDDEN' };
      // Provider access is gated upstream by service-request assignment, not by recipient field.
      // Caller is responsible for asserting an active task exists. This helper just gates by role policy.
      return { ok: true, recipient };
    case 'admin':
      if (!policy.admin) return { ok: false, code: 'AUTH_FORBIDDEN' };
      return { ok: true, recipient };
    default:
      return { ok: false, code: 'AUTH_FORBIDDEN' };
  }
}
