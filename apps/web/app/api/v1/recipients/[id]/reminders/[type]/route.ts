import { NextRequest } from 'next/server';
import { ReminderUpdateSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

const VALID_TYPES = ['morning', 'evening'] as const;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
  try {
    if (!checkOrigin(request)) {
      return errorResponse('AUTH_FORBIDDEN', 'CSRF 驗證失敗');
    }

    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    if (!['caregiver', 'admin'].includes(auth.role)) {
      return errorResponse('AUTH_FORBIDDEN', '僅委託人或管理員可更新提醒設定');
    }

    const { id, type } = await params;
    if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      return errorResponse('VALIDATION_ERROR', '提醒類型須為 morning 或 evening');
    }

    const recipient = await prisma.recipient.findFirst({
      where: { id, deleted_at: null },
    });

    if (!recipient) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
    }

    if (auth.role === 'caregiver' && recipient.caregiver_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權更新此被照護者提醒');
    }

    const body: unknown = await request.json();
    const parsed = ReminderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.reminder_time !== undefined) {
      updateData.reminder_time = new Date(`1970-01-01T${parsed.data.reminder_time}:00Z`);
    }
    if (parsed.data.is_enabled !== undefined) {
      updateData.is_enabled = parsed.data.is_enabled;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse('VALIDATION_ERROR', '至少須提供一個更新欄位');
    }

    const reminder = await prisma.measurementReminder.update({
      where: {
        recipient_id_reminder_type: {
          recipient_id: id,
          reminder_type: type,
        },
      },
      data: updateData,
    });

    return successResponse({
      id: reminder.id,
      recipient_id: reminder.recipient_id,
      reminder_type: reminder.reminder_type,
      reminder_time: reminder.reminder_time.toISOString().slice(11, 16),
      is_enabled: reminder.is_enabled,
      created_at: reminder.created_at.toISOString(),
      updated_at: reminder.updated_at.toISOString(),
    });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
