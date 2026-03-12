import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    if (!['caregiver', 'patient', 'admin'].includes(auth.role)) {
      return errorResponse('AUTH_FORBIDDEN', '此角色無權查看提醒設定');
    }

    const { id } = await params;

    const recipient = await prisma.recipient.findFirst({
      where: { id, deleted_at: null },
    });

    if (!recipient) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
    }

    if (auth.role === 'caregiver' && recipient.caregiver_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權查看此被照護者提醒');
    }

    if (auth.role === 'patient' && recipient.patient_user_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權查看此被照護者提醒');
    }

    const reminders = await prisma.measurementReminder.findMany({
      where: { recipient_id: id },
      orderBy: { reminder_type: 'asc' },
    });

    return successResponse(
      reminders.map((r) => ({
        id: r.id,
        recipient_id: r.recipient_id,
        reminder_type: r.reminder_type,
        reminder_time: r.reminder_time.toISOString().slice(11, 16),
        is_enabled: r.is_enabled,
        created_at: r.created_at.toISOString(),
        updated_at: r.updated_at.toISOString(),
      })),
    );
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
