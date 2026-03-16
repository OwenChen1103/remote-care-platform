import { NextRequest } from 'next/server';
import { ServiceRequestStatusUpdateSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

// Slice 7 write whitelist: submitted↔screening only
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  submitted: ['screening'],
  screening: ['submitted'],
};

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
      return errorResponse('AUTH_FORBIDDEN', '僅管理員可更新需求狀態');
    }

    const { id } = await params;
    const body: unknown = await request.json();

    const parsed = ServiceRequestStatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!serviceRequest) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此服務需求');
    }

    const allowedNext = ALLOWED_TRANSITIONS[serviceRequest.status];
    if (!allowedNext || !allowedNext.includes(parsed.data.status)) {
      return errorResponse(
        'INVALID_STATE_TRANSITION',
        `無法從「${serviceRequest.status}」轉換至「${parsed.data.status}」`,
      );
    }

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: parsed.data.status,
        admin_note: parsed.data.admin_note ?? serviceRequest.admin_note,
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
