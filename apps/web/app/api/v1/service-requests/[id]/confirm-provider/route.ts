import { NextRequest } from 'next/server';
import { ServiceRequestProviderConfirmSchema } from '@remote-care/shared';
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
    if (auth.role !== 'provider') {
      return errorResponse('AUTH_FORBIDDEN', '僅服務人員可確認接案');
    }

    // Resolve provider profile
    const provider = await prisma.provider.findFirst({
      where: { user_id: auth.userId, deleted_at: null },
      select: { id: true },
    });
    if (!provider) {
      return errorResponse('AUTH_FORBIDDEN', '找不到服務人員資料');
    }

    const { id } = await params;
    const body: unknown = await request.json();

    const parsed = ServiceRequestProviderConfirmSchema.safeParse(body);
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

    // Must be the candidate provider
    if (serviceRequest.candidate_provider_id !== provider.id) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '您不是此需求的候選服務人員');
    }

    if (serviceRequest.status !== 'caregiver_confirmed') {
      return errorResponse(
        'INVALID_STATE_TRANSITION',
        `目前狀態「${serviceRequest.status}」無法執行確認操作`,
      );
    }

    const updateData = parsed.data.confirm
      ? {
          // Auto-arrange: caregiver already confirmed, provider now confirms
          status: 'arranged' as const,
          provider_confirmed_at: new Date(),
          assigned_provider_id: serviceRequest.candidate_provider_id,
          provider_note: parsed.data.provider_note ?? serviceRequest.provider_note,
        }
      : {
          status: 'screening' as const,
          candidate_provider_id: null,
          caregiver_confirmed_at: null,
          provider_confirmed_at: null,
          provider_note: parsed.data.provider_note
            ? `服務人員拒絕接案：${parsed.data.provider_note}`
            : serviceRequest.provider_note,
        };

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, code: true, name: true } },
        recipient: { select: { id: true, name: true } },
        candidate_provider: { select: { id: true, name: true } },
        assigned_provider: { select: { id: true, name: true, phone: true } },
      },
    });

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
