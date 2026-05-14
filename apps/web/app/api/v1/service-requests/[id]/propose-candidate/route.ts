import { NextRequest } from 'next/server';
import { ServiceRequestProposeCandidateSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import {
  notifyServiceRequestUpdate,
  resolveProviderUserId,
} from '@/lib/service-notifications';
import { logAdminAction } from '@/lib/admin-audit';

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
      return errorResponse('AUTH_FORBIDDEN', '僅管理員可提出候選服務人員');
    }

    const { id } = await params;
    const body: unknown = await request.json();

    const parsed = ServiceRequestProposeCandidateSchema.safeParse(body);
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

    if (serviceRequest.status !== 'screening') {
      return errorResponse(
        'INVALID_STATE_TRANSITION',
        `僅審核中的需求可提出候選，目前狀態為「${serviceRequest.status}」`,
      );
    }

    const provider = await prisma.provider.findUnique({
      where: { id: parsed.data.provider_id },
    });
    if (!provider) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此服務人員');
    }
    if (provider.review_status !== 'approved') {
      return errorResponse('VALIDATION_ERROR', '此服務人員尚未通過審核');
    }

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'candidate_proposed',
        candidate_provider_id: parsed.data.provider_id,
        admin_note: parsed.data.admin_note ?? serviceRequest.admin_note,
      },
      include: {
        category: { select: { id: true, code: true, name: true } },
        recipient: { select: { id: true, name: true } },
        candidate_provider: { select: { id: true, name: true } },
      },
    });

    await logAdminAction(request, {
      adminUserId: auth.userId,
      action: 'service_request.propose_candidate',
      targetType: 'service_request',
      targetId: id,
      summary: `為「${updated.category.name}」需求（${updated.recipient.name}）推薦候選人「${updated.candidate_provider?.name ?? provider.name}」`,
      metadata: {
        candidate_provider_id: parsed.data.provider_id,
        admin_note: parsed.data.admin_note ?? null,
        recipient_id: updated.recipient.id,
        category_id: updated.category.id,
      },
    });

    // Section 2.3 row 3: notify caregiver + candidate provider.
    const providerUserId = await resolveProviderUserId(updated.candidate_provider_id);
    await notifyServiceRequestUpdate({
      serviceRequestId: id,
      targetStatus: 'candidate_proposed',
      recipients: {
        caregiverUserId: updated.caregiver_id,
        providerUserId,
      },
      messages: {
        caregiver: {
          title: '已為您推薦候選服務人員',
          body: `${updated.recipient.name} 的「${updated.category.name}」已推薦${updated.candidate_provider?.name ?? '候選服務人員'}，請確認是否同意`,
        },
        provider: {
          title: '您有新的候選邀請',
          body: `平台已將您列為「${updated.category.name}」需求的候選服務人員，等待委託人確認`,
        },
      },
      extraData: {
        candidate_provider_id: updated.candidate_provider_id,
      },
    });

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
