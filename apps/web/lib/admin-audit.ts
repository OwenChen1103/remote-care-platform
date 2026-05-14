/**
 * Admin audit log helper.
 *
 * Every privileged action driven from the admin shell (suspend, provider review,
 * SR status change, etc.) should call `logAdminAction` AFTER the underlying
 * mutation has succeeded. We log success, not intent — that way the audit log
 * matches the actual DB state.
 *
 * Safety contract:
 *   - This helper NEVER throws. A failing audit insert must not surface as a
 *     5xx to the admin — the user's action already succeeded. We surface the
 *     failure to stderr where alerting can pick it up.
 *   - Originating request metadata (IP, user-agent) is captured opportunistically.
 *     IP is taken from x-forwarded-for (first hop) or x-real-ip; both may be
 *     spoofable but are still useful in normal operation.
 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
// Type aliases live in admin-audit-labels (it's the client-importable file
// that owns the canonical list of action keys + target types).
import type { AdminActionKey, AdminTargetType } from '@/lib/admin-audit-labels';

export type { AdminActionKey, AdminTargetType };

export interface AdminAuditEntry {
  /** UUID of the admin who performed the action (auth.userId). */
  adminUserId: string;
  /** Stable machine-readable action key e.g. 'user.suspend'. */
  action: AdminActionKey;
  /** Resource type the action targets (omit for global actions). */
  targetType?: AdminTargetType | null;
  /** Resource UUID (omit for global actions). */
  targetId?: string | null;
  /** Short Traditional Chinese sentence for the audit-log reader. */
  summary: string;
  /** Action-specific structured payload (before/after, admin_note, ...). */
  metadata?: Record<string, unknown>;
}

export async function logAdminAction(
  request: NextRequest,
  entry: AdminAuditEntry,
): Promise<void> {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null;
    const ua = request.headers.get('user-agent') ?? null;

    await prisma.adminActionLog.create({
      data: {
        admin_user_id: entry.adminUserId,
        action: entry.action,
        target_type: entry.targetType ?? null,
        target_id: entry.targetId ?? null,
        summary: entry.summary,
        // Prisma JSON columns accept arbitrary serialisable values.
        metadata: (entry.metadata ?? {}) as object,
        ip_address: ip ? ip.slice(0, 64) : null,
        user_agent: ua ? ua.slice(0, 500) : null,
      },
    });
  } catch (err) {
    // Never let an audit insert kill the user-facing action.
    console.error('[admin-audit] failed to write log entry', { entry, err });
  }
}
