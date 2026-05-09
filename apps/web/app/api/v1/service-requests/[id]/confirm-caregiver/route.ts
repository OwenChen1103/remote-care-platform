import { NextRequest } from 'next/server';
import { ServiceRequestCaregiverConfirmSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import {
  notifyServiceRequestUpdate,
  resolveProviderUserId,
} from '@/lib/service-notifications';

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

    // Provider relationship may have been cleared (rejection branch nulls candidate_provider_id);
    // resolve from the snapshot pre-update for the rejection notification.
    const candidateProviderId = parsed.data.confirm
      ? updated.candidate_provider_id
      : serviceRequest.candidate_provider_id;
    const providerUserId = await resolveProviderUserId(candidateProviderId);

    if (parsed.data.confirm) {
      // Section 2.3 row 4a: caregiver_confirmed. Tell the candidate provider it's their turn.
      await notifyServiceRequestUpdate({
        serviceRequestId: id,
        targetStatus: 'caregiver_confirmed',
        recipients: { providerUserId },
        messages: {
          provider: {
            title: '委託人已確認，請確認接案',
            body: `委託人已同意您接「${updated.recipient.name} 的${updated.category.name}」服務，請於任務頁確認接案`,
          },
        },
      });
    } else {
      // Section 2.3 row 4b: caregiver rejected; back to screening.
      await notifyServiceRequestUpdate({
        serviceRequestId: id,
        targetStatus: 'screening',
        recipients: {
          providerUserId,
          notifyAllAdmins: true,
        },
        messages: {
          provider: {
            title: '候選未獲委託人確認',
            body: `委託人婉拒了「${updated.category.name}」需求的候選邀請`,
          },
          admin: {
            title: '候選被婉拒，需重新媒合',
            body: `服務需求 ${id.slice(0, 8)} 委託人婉拒候選人，請重新審核或更換候選`,
          },
        },
        extraData: { reason: 'caregiver_rejected' },
      });
    }

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
