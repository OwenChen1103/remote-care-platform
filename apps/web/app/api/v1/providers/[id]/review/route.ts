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
    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
