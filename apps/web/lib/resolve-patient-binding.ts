/**
 * Shared logic for binding a patient User to a Recipient by email (Section 1).
 *
 * Used by:
 *   - POST /v1/recipients              (caregiver creating new recipient)
 *   - PUT  /v1/recipients/[id]         (caregiver editing existing recipient)
 *   - PUT  /v1/admin/recipients/[id]   (admin override)
 *
 * Three failure modes (typed error codes return to caller for friendly UI mapping):
 *   1. PATIENT_USER_NOT_FOUND     — no user with that email
 *   2. PATIENT_USER_ROLE_MISMATCH — user exists but role !== 'patient'
 *   3. PATIENT_USER_ALREADY_BOUND — patient already linked to another (non-deleted) recipient
 *
 * On success, returns the resolved patient user id (to be written to recipient.patient_user_id).
 *
 * `isAlreadyBoundConflict(err)` — helper for callers to detect Prisma's P2002 unique
 * constraint violation when two caregivers race to bind the same patient. The pre-check
 * via this helper is best-effort; the DB unique index on `recipients.patient_user_id`
 * is the authoritative guard. Catch the error in the route's outer try/catch and
 * translate to a friendly PATIENT_USER_ALREADY_BOUND.
 */
import { prisma } from '@/lib/prisma';
import type { ErrorCode } from '@remote-care/shared';

/** True iff `err` is a Prisma unique-constraint violation (code P2002) on patient_user_id. */
export function isAlreadyBoundConflict(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== 'P2002') return false;
  // P2002 meta.target may be string[] or string. Both shapes are valid; check both.
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.includes('patient_user_id');
  if (typeof target === 'string') return target.includes('patient_user_id');
  // Conservative: if we can't introspect the target, treat as the conflict we care about
  // (only possible during a recipient binding write). Caller's pre-check already
  // narrowed this to a binding-related write path.
  return true;
}

export type PatientBindingResult =
  | { ok: true; patientUserId: string }
  | { ok: false; code: Extract<ErrorCode, 'PATIENT_USER_NOT_FOUND' | 'PATIENT_USER_ROLE_MISMATCH' | 'PATIENT_USER_ALREADY_BOUND'>; message: string };

/**
 * Resolves a caregiver-supplied patient email into a user id, after validating:
 *   - the user exists
 *   - the user has role 'patient'
 *   - the user isn't already bound to a different non-deleted recipient
 *
 * @param email             Patient's registration email (case-insensitive lookup happens via Prisma's @unique on email; emails are stored as-is; caller should pre-lowercase if mobile/web wants normalization).
 * @param excludeRecipientId If updating an existing recipient, pass its id so the conflict check ignores its own row.
 */
export async function resolvePatientBinding(
  email: string,
  excludeRecipientId?: string,
): Promise<PatientBindingResult> {
  const target = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!target) {
    return {
      ok: false,
      code: 'PATIENT_USER_NOT_FOUND',
      message: '查無此 Email 的被照護者帳號，請先請對方註冊',
    };
  }
  if (target.role !== 'patient') {
    return {
      ok: false,
      code: 'PATIENT_USER_ROLE_MISMATCH',
      message: '此帳號不是「被照護者」角色，無法連結',
    };
  }
  const conflict = await prisma.recipient.findFirst({
    where: {
      patient_user_id: target.id,
      deleted_at: null,
      ...(excludeRecipientId ? { NOT: { id: excludeRecipientId } } : {}),
    },
    select: { id: true },
  });
  if (conflict) {
    return {
      ok: false,
      code: 'PATIENT_USER_ALREADY_BOUND',
      message: '此 Email 已連結至其他被照護者',
    };
  }
  return { ok: true, patientUserId: target.id };
}
