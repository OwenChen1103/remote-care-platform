import { NextRequest } from 'next/server';
import { ServiceRequestCancelSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import {
  notifyServiceRequestUpdate,
  resolveProviderUserId,
} from '@/lib/service-notifications';

// Non-completed, non-cancelled statuses can be cancelled
const CANCELLABLE_STATUSES = [
  'submitted',
  'screening',
  'candidate_proposed',
  'caregiver_confirmed',
  'provider_confirmed',
  'arranged',
  'in_service',
];

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

    // Only caregiver (owner) and admin can cancel
    if (auth.role !== 'caregiver' && auth.role !== 'admin') {
      return errorResponse('AUTH_FORBIDDEN', '無權取消此服務需求');
    }

    const { id } = await params;
    const body: unknown = await request.json();

    const parsed = ServiceRequestCancelSchema.safeParse(body);
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

    // Caregiver ownership check
    if (auth.role === 'caregiver' && serviceRequest.caregiver_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此服務需求');
    }

    // State guard: completed and cancelled cannot be cancelled
    if (!CANCELLABLE_STATUSES.includes(serviceRequest.status)) {
      return errorResponse(
        'INVALID_STATE_TRANSITION',
        `狀態「${serviceRequest.status}」無法取消`,
      );
    }

    const fromStatus = serviceRequest.status;
    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'cancelled',
        admin_note: parsed.data.reason
          ? `${serviceRequest.admin_note ? serviceRequest.admin_note + '\n' : ''}取消原因：${parsed.data.reason}`
          : serviceRequest.admin_note,
      },
      include: {
        category: { select: { id: true, code: true, name: true } },
        recipient: { select: { id: true, name: true } },
      },
    });

    // Section 2.3 rows 8-9: cancellation notifications fan out by who cancelled.
    // Resolve from pre-update snapshot so candidate/assigned provider relationship is captured
    // even though the cancel doesn't null those fields (they're left for audit trail).
    const providerUserId = await resolveProviderUserId(
      serviceRequest.assigned_provider_id ?? serviceRequest.candidate_provider_id,
    );
    if (auth.role === 'caregiver') {
      await notifyServiceRequestUpdate({
        serviceRequestId: id,
        targetStatus: 'cancelled',
        recipients: { providerUserId, notifyAllAdmins: true },
        messages: {
          provider: {
            title: '服務需求已被取消',
            body: `委託人取消了「${updated.category.name}」需求${parsed.data.reason ? `（原因：${parsed.data.reason}）` : ''}`,
          },
          admin: {
            title: '委託人已取消需求',
            body: `服務需求 ${id.slice(0, 8)} 已被委託人取消`,
          },
        },
        extraData: { cancelled_by: 'caregiver', from_status: fromStatus, reason: parsed.data.reason ?? null },
      });
    } else {
      // admin
      await notifyServiceRequestUpdate({
        serviceRequestId: id,
        targetStatus: 'cancelled',
        recipients: {
          caregiverUserId: updated.caregiver_id,
          providerUserId,
        },
        messages: {
          caregiver: {
            title: '服務需求已被管理員取消',
            body: `${updated.recipient.name} 的「${updated.category.name}」已被管理員取消${parsed.data.reason ? `（原因：${parsed.data.reason}）` : ''}`,
          },
          provider: {
            title: '服務需求已被取消',
            body: `「${updated.category.name}」需求已被管理員取消`,
          },
        },
        extraData: { cancelled_by: 'admin', from_status: fromStatus, reason: parsed.data.reason ?? null },
      });
    }

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
