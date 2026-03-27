import { NextRequest } from 'next/server';
import { ProviderReviewSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

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
      return errorResponse('VALIDATION_ERROR', '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
    }

    const existing = await prisma.provider.findFirst({ where: { id, deleted_at: null } });
    if (!existing) return errorResponse('RESOURCE_NOT_FOUND', '找不到此服務人員');

    const updated = await prisma.provider.update({
      where: { id },
      data: {
        review_status: parsed.data.review_status,
        admin_note: parsed.data.admin_note ?? existing.admin_note,
      },
    });

    // Send notification to the provider about review result
    if (existing.user_id) {
      const isApproved = parsed.data.review_status === 'approved';
      await prisma.notification.create({
        data: {
          user_id: existing.user_id,
          type: 'provider_review_result',
          title: isApproved ? '審核通過' : '審核未通過',
          body: isApproved
            ? '恭喜！您的服務人員資格已通過審核，現在可以開始接案。'
            : `您的服務人員資格審核未通過。${parsed.data.admin_note ? `原因：${parsed.data.admin_note}` : '請聯繫客服了解詳情。'}`,
          data: { provider_id: id, review_status: parsed.data.review_status },
        },
      });
    }

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
