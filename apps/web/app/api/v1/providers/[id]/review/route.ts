/**
 * Provider review decision (Section 4.1.4).
 *
 * Admin transitions a provider through review states:
 *   pending  → approved   (no admin_note required)
 *   pending  → rejected   (admin_note REQUIRED, recoverable via /provider/me/reapply)
 *   approved → suspended  (admin_note REQUIRED, ops-only recovery)
 *
 * State machine guards (Section 4.1.4):
 *   - Cannot suspend a non-approved provider (must approve first)
 *   - Cannot reject a suspended provider (must reset to pending via reapply path? — nope,
 *     suspended is a terminal-ish state; admin should restore to approved instead)
 *
 * Notifications: provider receives `provider_review_result` notification with action-specific
 * title/body, including the admin_note when applicable.
 */
import { NextRequest } from 'next/server';
import { ProviderReviewSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import { logAdminAction } from '@/lib/admin-audit';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!checkOrigin(request)) return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    const auth = await verifyAuth(request);
    if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
    if (auth.role !== 'admin') return errorResponse('AUTH_FORBIDDEN', '僅管理員可審核服務人員');

    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = ProviderReviewSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const existing = await prisma.provider.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) return errorResponse('RESOURCE_NOT_FOUND', '找不到此服務人員');

    const next = parsed.data.review_status;

    // State machine guards
    if (next === 'suspended' && existing.review_status !== 'approved') {
      return errorResponse('VALIDATION_ERROR', '只有已核准的服務人員可被停權');
    }
    if (next === 'rejected' && existing.review_status === 'suspended') {
      return errorResponse('VALIDATION_ERROR', '已停權的帳號無法直接拒絕，請先恢復為待審核');
    }

    const updated = await prisma.provider.update({
      where: { id },
      data: {
        review_status: next,
        // Update admin_note when caller provides one; preserve existing otherwise.
        admin_note: parsed.data.admin_note ?? existing.admin_note,
        reviewed_at: new Date(),
      },
    });

    // Audit log — captured before notification side-effects so the trail
    // still exists even if the notification fan-out fails downstream.
    const reviewActionLabel: Record<string, string> = {
      approved: '核准',
      rejected: '拒絕並退回',
      suspended: '停權',
      pending: '改回待審核',
    };
    await logAdminAction(request, {
      adminUserId: auth.userId,
      action: 'provider.review',
      targetType: 'provider',
      targetId: id,
      summary: `${reviewActionLabel[next] ?? next}服務人員「${existing.name}」`,
      metadata: {
        from_status: existing.review_status,
        to_status: next,
        admin_note: parsed.data.admin_note ?? null,
      },
    });

    // Send notification to provider — only if they have a linked user account.
    // Legacy providers seeded without user_id are silently skipped.
    // Wrapped in try/catch: review decision (provider.update above) has already committed,
    // so a notification failure must not surface as a 500 to the admin.
    if (existing.user_id) {
      const adminNote = parsed.data.admin_note ?? existing.admin_note ?? '';
      const notif =
        next === 'approved'
          ? {
              title: '審核通過',
              body: '恭喜！您的服務人員資格已通過審核，現在可以開始接案。',
            }
          : next === 'rejected'
            ? {
                title: '審核未通過',
                body: `您的服務人員資格審核未通過。${adminNote ? `原因：${adminNote}` : ''} 您可以修正資料後再次送出。`,
              }
            : {
                // suspended
                title: '帳號已停權',
                body: `您的服務人員帳號已被停權。${adminNote ? `原因：${adminNote}` : ''} 如有疑問請聯繫客服。`,
              };

      try {
        await prisma.notification.create({
          data: {
            user_id: existing.user_id,
            type: 'provider_review_result',
            title: notif.title,
            body: notif.body,
            data: { provider_id: id, review_status: next },
          },
        });
      } catch (err) {
        console.error('[providers/review] notification.create failed', {
          providerId: id,
          reviewStatus: next,
          err,
        });
      }
    }

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
