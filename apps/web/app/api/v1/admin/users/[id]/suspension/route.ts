/**
 * Admin user suspension toggle (Section 3.5.6).
 *
 * Body: `{ suspended: boolean }`
 *   - true  → set suspended_at = now() (block all subsequent verifyAuth)
 *   - false → set suspended_at = null  (re-enable login & API access)
 *
 * Self-suspension is forbidden (admin can't lock themselves out).
 *
 * Resource-style URL `/admin/users/[id]/suspension` (the suspension is the resource being modified).
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import { logAdminAction } from '@/lib/admin-audit';

const SuspensionSchema = z.object({
  suspended: z.boolean(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!checkOrigin(request)) {
      return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    }
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }
    if (auth.role !== 'admin') {
      return errorResponse('AUTH_FORBIDDEN', '僅管理員可存取');
    }

    const { id } = await params;
    if (id === auth.userId) {
      return errorResponse('VALIDATION_ERROR', '不可停權自己');
    }

    const body: unknown = await request.json();
    const parsed = SuspensionSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    // Snapshot the target's identifying fields BEFORE the update so the audit
    // log preserves the user's name/email even if subsequent admin actions
    // rename them. Also serves as the existence check (avoids prisma P2025).
    const before = await prisma.user.findUnique({
      where: { id },
      select: { name: true, email: true, role: true, suspended_at: true },
    });
    if (!before) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此使用者');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        suspended_at: parsed.data.suspended ? new Date() : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        suspended_at: true,
      },
    });

    await logAdminAction(request, {
      adminUserId: auth.userId,
      action: parsed.data.suspended ? 'user.suspend' : 'user.unsuspend',
      targetType: 'user',
      targetId: id,
      summary: parsed.data.suspended
        ? `停權使用者「${before.name}」（${before.email}）`
        : `恢復使用者「${before.name}」（${before.email}）`,
      metadata: {
        target_role: before.role,
        was_suspended_at: before.suspended_at?.toISOString() ?? null,
      },
    });

    return successResponse({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      suspended_at: updated.suspended_at?.toISOString() ?? null,
    });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
