import { NextRequest } from 'next/server';
import {
  ADMIN_STATUS_TRANSITIONS,
  SERVICE_REQUEST_STATUS_DISPLAY,
  ServiceRequestStatusUpdateSchema,
} from '@remote-care/shared';
import type { ServiceRequestStatus } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import {
  notifyServiceRequestUpdate,
  resolveProviderUserId,
} from '@/lib/service-notifications';
import { logAdminAction } from '@/lib/admin-audit';

/**
 * Admin manually changes a service request status (Section 2.7.3).
 *
 * Now uses the shared ADMIN_STATUS_TRANSITIONS map (Decision G) — admin can:
 *   - Push 'submitted' forward to 'screening' (start review)
 *   - Bring 'screening' back to 'submitted' (un-review)
 *   - Cancel anything non-terminal
 *   - Rescue stuck flows: e.g. 'arranged' → 'screening' (provider unavailable)
 *   - Manually advance 'provider_confirmed' → 'arranged' (rescue path; main flow auto-arranges)
 *
 * Does NOT replace caregiver/provider routes for normal forward progress.
 */
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

    const currentStatus = serviceRequest.status as ServiceRequestStatus;
    const targetStatus = parsed.data.status as ServiceRequestStatus;

    // For 'cancelled', callers should use /cancel route (preserves cancelled_by semantics).
    // status route only handles non-cancellation transitions.
    if (targetStatus === 'cancelled') {
      return errorResponse(
        'INVALID_STATE_TRANSITION',
        '請使用取消路由 /cancel 處理取消',
      );
    }

    const allowedNext = ADMIN_STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!allowedNext.includes(targetStatus)) {
      return errorResponse(
        'INVALID_STATE_TRANSITION',
        `無法從「${currentStatus}」轉換至「${targetStatus}」`,
      );
    }

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: targetStatus,
        admin_note: parsed.data.admin_note ?? serviceRequest.admin_note,
      },
      include: {
        category: { select: { id: true, code: true, name: true } },
        recipient: { select: { id: true, name: true } },
      },
    });

    await logAdminAction(request, {
      adminUserId: auth.userId,
      action: 'service_request.status_change',
      targetType: 'service_request',
      targetId: id,
      summary: `將「${updated.category.name}」需求（${updated.recipient.name}）從「${SERVICE_REQUEST_STATUS_DISPLAY[currentStatus]?.label ?? currentStatus}」改為「${SERVICE_REQUEST_STATUS_DISPLAY[targetStatus]?.label ?? targetStatus}」`,
      metadata: {
        from_status: currentStatus,
        to_status: targetStatus,
        admin_note: parsed.data.admin_note ?? null,
        recipient_id: updated.recipient.id,
        category_id: updated.category.id,
      },
    });

    // Notify caregiver + currently-assigned/candidate provider on admin-driven transitions.
    // Section 2.3 transition matrix row 10 (admin manual rescue) — fan-out includes
    // caregiver always; provider if there's still a relationship to the request.
    const providerUserId = await resolveProviderUserId(
      updated.assigned_provider_id ?? updated.candidate_provider_id,
    );
    await notifyServiceRequestUpdate({
      serviceRequestId: id,
      targetStatus,
      recipients: {
        caregiverUserId: updated.caregiver_id,
        providerUserId,
      },
      messages: {
        caregiver: {
          title: '服務需求狀態更新',
          body: `${updated.recipient.name} 的「${updated.category.name}」狀態已更新為「${targetStatus}」`,
        },
        provider: {
          title: '服務需求狀態變更',
          body: `${updated.recipient.name} 的「${updated.category.name}」已被管理員調整狀態`,
        },
      },
      extraData: {
        from_status: currentStatus,
        reason: 'admin_rescue',
      },
    });

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
