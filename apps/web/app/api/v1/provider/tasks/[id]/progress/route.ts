import { NextRequest } from 'next/server';
import { ServiceRequestProviderProgressSchema, VALID_STATUS_TRANSITIONS } from '@remote-care/shared';
import type { ServiceRequestStatus } from '@remote-care/shared';
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
    if (auth.role !== 'provider') return errorResponse('AUTH_FORBIDDEN', '僅服務人員可更新進度');

    const provider = await prisma.provider.findFirst({
      where: { user_id: auth.userId, deleted_at: null },
      select: { id: true },
    });
    if (!provider) return errorResponse('AUTH_FORBIDDEN', '找不到服務人員資料');

    const { id } = await params;
    const body: unknown = await request.json();

    const parsed = ServiceRequestProviderProgressSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
    }

    const task = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!task) return errorResponse('RESOURCE_NOT_FOUND', '找不到此服務需求');

    if (task.assigned_provider_id !== provider.id) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '您不是此需求的指派服務人員');
    }

    const currentStatus = task.status as ServiceRequestStatus;
    const targetStatus = parsed.data.status as ServiceRequestStatus;
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(targetStatus)) {
      return errorResponse('INVALID_STATE_TRANSITION', `無法從「${currentStatus}」轉換至「${targetStatus}」`);
    }

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: parsed.data.status,
        provider_note: parsed.data.provider_note ?? task.provider_note,
      },
      include: {
        category: { select: { id: true, code: true, name: true } },
        recipient: { select: { id: true, name: true } },
      },
    });

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
