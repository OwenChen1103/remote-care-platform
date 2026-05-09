/**
 * Provider re-submits for review after rejection (Section 4.1.6).
 *
 * Only valid when current `review_status === 'rejected'`. Resets:
 *   - review_status → 'pending'
 *   - submitted_at  → now()  (fresh submission timestamp)
 *   - reviewed_at   → null   (clear previous review decision marker)
 *   - admin_note    → preserved (provider acknowledges the previous reason)
 *
 * Body: ProviderReapplySchema requires `acknowledged_note: true` — forces UI
 * confirmation that the provider has read the previous rejection reason before reapplying.
 *
 * On success the row enters the normal pending queue; admin can re-review via
 * /providers/[id]/review and either approve or reject again.
 */
import { NextRequest } from 'next/server';
import { ProviderReapplySchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  try {
    if (!checkOrigin(request)) return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    const auth = await verifyAuth(request);
    if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
    if (auth.role !== 'provider') return errorResponse('AUTH_FORBIDDEN', '僅服務人員可存取');

    const body: unknown = await request.json();
    const parsed = ProviderReapplySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const provider = await prisma.provider.findFirst({
      where: { user_id: auth.userId, deleted_at: null },
    });
    if (!provider) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到服務人員資料');
    }
    if (provider.review_status !== 'rejected') {
      return errorResponse(
        'VALIDATION_ERROR',
        '僅未通過審核的服務人員可重新送審',
      );
    }

    const updated = await prisma.provider.update({
      where: { id: provider.id },
      data: {
        review_status: 'pending',
        submitted_at: new Date(),
        reviewed_at: null,
      },
    });

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
