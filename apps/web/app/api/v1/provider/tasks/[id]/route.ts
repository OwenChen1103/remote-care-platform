import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * Provider task detail (Section 2.7.2 + Section 3.5.4).
 *
 * Ownership: provider must be EITHER candidate_provider (for candidate_proposed +
 * caregiver_confirmed statuses) OR assigned_provider (any other status). Mirrors the
 * list endpoint's filter.
 *
 * candidate_proposed is read-only for provider — admin proposed them, caregiver hasn't
 * confirmed yet. Provider gets a notification at this state ("您有新的候選邀請") and
 * the mobile deep-link routes here so they can preview the task while waiting.
 * (provider-task-detail.tsx has no action buttons for this status — confirm buttons
 *  only render at arranged/in_service/completed; provider-confirm.tsx is the accept
 *  screen, reached at caregiver_confirmed.)
 *
 * Recipient select extended (Section 3.5.4): exposes more clinical info than the list
 * — emergency contact, address, medical notes — needed for actual on-site service.
 * Caregiver/patient PII is intentionally omitted (`caregiver_id`, `patient_user_id`).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
    if (auth.role !== 'provider') return errorResponse('AUTH_FORBIDDEN', '僅服務人員可存取');

    const provider = await prisma.provider.findFirst({
      where: { user_id: auth.userId, deleted_at: null },
      select: { id: true },
    });
    if (!provider) return errorResponse('AUTH_FORBIDDEN', '找不到服務人員資料');

    const { id } = await params;
    const task = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, code: true, name: true } },
        recipient: {
          select: {
            id: true,
            name: true,
            date_of_birth: true,
            gender: true,
            medical_tags: true,
            notes: true,
            emergency_contact_name: true,
            emergency_contact_phone: true,
            address: true,
          },
        },
      },
    });
    if (!task) return errorResponse('RESOURCE_NOT_FOUND', '找不到此服務需求');

    // Two ownership paths:
    //   - candidate: candidate_proposed (read-only — admin proposed, caregiver hasn't
    //     confirmed yet) or caregiver_confirmed (provider's turn to confirm).
    //     Both states match `candidate_provider_id` since the provider hasn't yet been
    //     promoted to assigned.
    //   - assigned (already accepted): all other in-flight + completed/cancelled.
    const isCandidate =
      (task.status === 'candidate_proposed' || task.status === 'caregiver_confirmed') &&
      task.candidate_provider_id === provider.id;
    const isAssigned = task.assigned_provider_id === provider.id;
    if (!isCandidate && !isAssigned) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '您不是此需求的指派或候選服務人員');
    }

    return successResponse(task);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
