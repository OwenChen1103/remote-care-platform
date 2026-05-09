/**
 * Provider self-profile (Section 4.1.5).
 *
 * GET: provider reads own profile (incl. review_status, admin_note, submitted_at, reviewed_at).
 * PUT: provider updates own profile fields. On the FIRST submission with meaningful onboarding
 *      content (specialties / education / etc), `submitted_at` is auto-stamped — this drives
 *      the mobile `isOnboarding` gate (`review_status === 'pending' && !submitted_at`).
 *      Subsequent edits preserve `submitted_at`. Reviewers/admin set it via /reapply or never.
 */
import { NextRequest } from 'next/server';
import {
  ProviderSelfUpdateSchema,
  type ProviderSelfUpdateInput,
} from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

/**
 * Has the caller filled in any submission-worthy onboarding field in this PUT body?
 * Used to auto-stamp `submitted_at` on the first real submission.
 * Pure phone-number-only updates don't count (provider may just be correcting a typo).
 */
function hasSubmissionFields(d: ProviderSelfUpdateInput): boolean {
  return !!(
    d.education ||
    (d.specialties && d.specialties.length > 0) ||
    (d.certifications && d.certifications.length > 0) ||
    d.experience_years != null ||
    (d.service_areas && d.service_areas.length > 0) ||
    (d.available_services && d.available_services.length > 0)
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
    if (auth.role !== 'provider') return errorResponse('AUTH_FORBIDDEN', '僅服務人員可存取');
    const provider = await prisma.provider.findFirst({
      where: { user_id: auth.userId, deleted_at: null },
    });
    if (!provider) return errorResponse('AUTH_FORBIDDEN', '找不到服務人員資料');
    return successResponse(provider);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!checkOrigin(request)) return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    const auth = await verifyAuth(request);
    if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
    if (auth.role !== 'provider') return errorResponse('AUTH_FORBIDDEN', '僅服務人員可存取');
    const provider = await prisma.provider.findFirst({
      where: { user_id: auth.userId, deleted_at: null },
    });
    if (!provider) return errorResponse('AUTH_FORBIDDEN', '找不到服務人員資料');

    // Audit finding #2: block silent edits while rejected. A rejected provider thinks
    // editing fields means they're re-submitting, but without this guard PUT just persists
    // changes with no review trigger (review_status stays 'rejected', submitted_at preserved).
    // Force them through /provider/me/reapply, which resets state correctly and signals admin.
    if (provider.review_status === 'rejected') {
      return errorResponse(
        'INVALID_STATE_TRANSITION',
        '審核未通過時無法直接修改資料，請點選「重新送審」按鈕後再進行編輯',
      );
    }

    const body: unknown = await request.json();
    const parsed = ProviderSelfUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    // Auto-stamp submitted_at on the first real onboarding submission.
    // After this point, the mobile `isOnboarding` gate flips, signalling provider profile is "in review".
    const wasNeverSubmitted = !provider.submitted_at;
    const stampSubmitted = wasNeverSubmitted && hasSubmissionFields(parsed.data);

    const updated = await prisma.provider.update({
      where: { id: provider.id },
      data: {
        ...parsed.data,
        ...(stampSubmitted ? { submitted_at: new Date() } : {}),
      },
    });
    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
