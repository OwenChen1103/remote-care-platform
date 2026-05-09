import { NextRequest } from 'next/server';
import { AiReportListQuerySchema, AI_DISCLAIMER } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { errorResponse, paginatedResponse } from '@/lib/api-response';
import { ensureRecipientAccess } from '@/lib/recipient-access';

/**
 * AI report list (Section 3.5.1).
 *
 * Authorization (Decision C):
 *   - caregiver : own recipients only
 *   - patient   : own (where patient_user_id matches)
 *   - admin     : any
 *   - provider  : DENY — AI reports are caregiver/patient facing longitudinal diagnostics,
 *                 not visit-relevant. Providers see recent measurements via /measurements instead.
 *
 * Previously this route only blocked caregivers who weren't owners — patient/provider tokens
 * could pass any recipient_id and read AI reports. Fixed by routing through the centralized
 * ensureRecipientAccess helper which enforces role policy + ownership atomically.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    const url = new URL(request.url);
    const queryObj: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryObj[key] = value;
    }

    const parsed = AiReportListQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '查詢參數驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const { recipient_id, report_type, page, limit } = parsed.data;

    const access = await ensureRecipientAccess(auth, recipient_id, {
      caregiver: true,
      patient: true,
      provider: false,
      admin: true,
    });
    if (!access.ok) {
      const message =
        access.code === 'RESOURCE_NOT_FOUND'
          ? '找不到此被照護者'
          : access.code === 'RESOURCE_OWNERSHIP_DENIED'
            ? '無權存取此被照護者'
            : '無權存取';
      return errorResponse(access.code, message);
    }

    const where: Record<string, unknown> = { recipient_id };
    if (report_type) where.report_type = report_type;

    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      prisma.aiReport.findMany({
        where,
        orderBy: { generated_at: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          recipient_id: true,
          report_type: true,
          status_label: true,
          summary: true,
          reasons: true,
          suggestions: true,
          model: true,
          input_tokens: true,
          output_tokens: true,
          generated_at: true,
          created_at: true,
        },
      }),
      prisma.aiReport.count({ where }),
    ]);

    const data = reports.map((r) => ({
      ...r,
      disclaimer: AI_DISCLAIMER,
    }));

    return paginatedResponse(data, { page, limit, total });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
