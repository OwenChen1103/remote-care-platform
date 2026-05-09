import { NextRequest } from 'next/server';
import { RecipientUpdateSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import { formatRecipient } from '@/lib/format-recipient';
import { resolvePatientBinding, isAlreadyBoundConflict } from '@/lib/resolve-patient-binding';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    const { id } = await params;

    const recipient = await prisma.recipient.findFirst({
      where: { id, deleted_at: null },
      include: { patient_user: { select: { email: true, name: true } } },
    });

    if (!recipient) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
    }

    if (auth.role === 'caregiver' && recipient.caregiver_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');
    }

    if (auth.role === 'patient' && recipient.patient_user_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');
    }

    if (!['caregiver', 'patient', 'admin'].includes(auth.role)) {
      return errorResponse('AUTH_FORBIDDEN', '此角色無權存取被照護者');
    }

    return successResponse(formatRecipient(recipient));
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}

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

    const { id } = await params;

    const existing = await prisma.recipient.findFirst({
      where: { id, deleted_at: null },
    });

    if (!existing) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
    }

    if (auth.role === 'caregiver' && existing.caregiver_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');
    }

    if (!['caregiver', 'admin'].includes(auth.role)) {
      return errorResponse('AUTH_FORBIDDEN', '僅委託人或管理員可更新被照護者');
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

    // Patient binding semantics (Section 1):
    //   - undefined: don't touch patient_user_id (default partial behavior)
    //   - null     : explicit unbind (set patient_user_id = null)
    //   - string   : resolve email to user, validate, set patient_user_id
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

    return successResponse(formatRecipient(updated));
  } catch (err) {
    if (isAlreadyBoundConflict(err)) {
      return errorResponse('PATIENT_USER_ALREADY_BOUND', '此 Email 已連結至其他被照護者');
    }
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}

/**
 * Soft-delete a recipient (Section 4.2.3).
 * Blocks deletion if there's any in-flight service request — caregiver must complete
 * or cancel those before this is allowed. Measurement / appointment data is preserved
 * but no longer accessible via filtered queries (all GETs filter `deleted_at: null`).
 */
const IN_FLIGHT_STATUSES = [
  'submitted',
  'screening',
  'candidate_proposed',
  'caregiver_confirmed',
  'provider_confirmed',
  'arranged',
  'in_service',
];

export async function DELETE(
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

    const { id } = await params;
    const existing = await prisma.recipient.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
    }

    // Caregiver must own; admin can delete any. Other roles are forbidden.
    if (auth.role === 'caregiver' && existing.caregiver_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權刪除此被照護者');
    }
    if (!['caregiver', 'admin'].includes(auth.role)) {
      return errorResponse('AUTH_FORBIDDEN', '僅委託人或管理員可刪除');
    }

    // Block delete when any in-flight service request exists.
    const pending = await prisma.serviceRequest.count({
      where: { recipient_id: id, status: { in: IN_FLIGHT_STATUSES } },
    });
    if (pending > 0) {
      return errorResponse(
        'VALIDATION_ERROR',
        '此被照護者尚有進行中的服務需求，請先完成或取消',
      );
    }

    await prisma.recipient.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    return successResponse({ id, deleted: true });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
