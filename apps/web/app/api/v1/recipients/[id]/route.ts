import { NextRequest } from 'next/server';
import { RecipientUpdateSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import { formatRecipient } from '@/lib/format-recipient';

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

    const { date_of_birth, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (date_of_birth !== undefined) {
      updateData.date_of_birth = date_of_birth ? new Date(date_of_birth) : null;
    }

    const updated = await prisma.recipient.update({
      where: { id },
      data: updateData,
    });

    return successResponse(formatRecipient(updated));
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
