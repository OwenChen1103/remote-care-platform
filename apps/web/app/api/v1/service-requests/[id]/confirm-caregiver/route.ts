import { NextRequest } from 'next/server';
import { ServiceRequestCaregiverConfirmSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

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
    if (auth.role !== 'caregiver') {
      return errorResponse('AUTH_FORBIDDEN', '僅委託人可確認候選服務人員');
    }

    const { id } = await params;
    const body: unknown = await request.json();

    const parsed = ServiceRequestCaregiverConfirmSchema.safeParse(body);
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

    // Ownership check
    if (serviceRequest.caregiver_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此服務需求');
    }

    if (serviceRequest.status !== 'candidate_proposed') {
      return errorResponse(
        'INVALID_STATE_TRANSITION',
        `目前狀態「${serviceRequest.status}」無法執行確認操作`,
      );
    }

    const updateData = parsed.data.confirm
      ? {
          status: 'caregiver_confirmed' as const,
          caregiver_confirmed_at: new Date(),
          admin_note: parsed.data.note
            ? `${serviceRequest.admin_note ? serviceRequest.admin_note + '\n' : ''}委託人備註：${parsed.data.note}`
            : serviceRequest.admin_note,
        }
      : {
          status: 'screening' as const,
          candidate_provider_id: null,
          caregiver_confirmed_at: null,
          admin_note: parsed.data.note
            ? `${serviceRequest.admin_note ? serviceRequest.admin_note + '\n' : ''}委託人拒絕候選：${parsed.data.note}`
            : serviceRequest.admin_note,
        };

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, code: true, name: true } },
        recipient: { select: { id: true, name: true } },
        candidate_provider: { select: { id: true, name: true } },
      },
    });

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
