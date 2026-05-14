/**
 * Admin override route for editing a Recipient (Section 1.6.4).
 *
 * Distinct from `PUT /v1/recipients/[id]` (which gates by caregiver ownership).
 * This admin endpoint:
 *   - bypasses caregiver ownership (admin can edit any recipient)
 *   - shares the same RecipientUpdateSchema + patient_user_email semantics
 *   - shares the resolve-patient-binding helper (DRY with caregiver PUT)
 *
 * Used by admin/recipients/[id]/page.tsx to fix bad/missing patient bindings.
 */
import { NextRequest } from 'next/server';
import { RecipientUpdateSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import { formatRecipient } from '@/lib/format-recipient';
import { resolvePatientBinding, isAlreadyBoundConflict } from '@/lib/resolve-patient-binding';
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
      return errorResponse('AUTH_FORBIDDEN', '僅限管理員');
    }

    const { id } = await params;
    const existing = await prisma.recipient.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
    }

    const body: unknown = await request.json();
    const parsed = RecipientUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const { date_of_birth, patient_user_email, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (date_of_birth !== undefined) {
      updateData.date_of_birth = date_of_birth ? new Date(date_of_birth) : null;
    }

    if (patient_user_email !== undefined) {
      if (patient_user_email === null) {
        updateData.patient_user_id = null;
      } else {
        const binding = await resolvePatientBinding(patient_user_email, id);
        if (!binding.ok) return errorResponse(binding.code, binding.message);
        updateData.patient_user_id = binding.patientUserId;
      }
    }

    const updated = await prisma.recipient.update({
      where: { id },
      data: updateData,
      include: { patient_user: { select: { email: true, name: true } } },
    });

    // Capture concise changed-field list for the audit log. Diffing all 13
    // recipient fields is overkill; a list of touched keys is enough for a
    // "who changed what" timeline.
    const changedFields = Object.keys(updateData);
    const isBindingChange = 'patient_user_id' in updateData;
    const bindingSummary = isBindingChange
      ? (updateData.patient_user_id === null
          ? `解除被照護者「${updated.name}」帳號連結`
          : `更新被照護者「${updated.name}」帳號連結（${patient_user_email}）`)
      : `更新被照護者「${updated.name}」資料（${changedFields.join('、') || '無變更'}）`;

    await logAdminAction(request, {
      adminUserId: auth.userId,
      action: 'recipient.update',
      targetType: 'recipient',
      targetId: id,
      summary: bindingSummary,
      metadata: {
        changed_fields: changedFields,
        new_patient_user_email: isBindingChange ? (patient_user_email ?? null) : undefined,
      },
    });

    return successResponse(formatRecipient(updated));
  } catch (err) {
    if (isAlreadyBoundConflict(err)) {
      return errorResponse('PATIENT_USER_ALREADY_BOUND', '此 Email 已連結至其他被照護者');
    }
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
