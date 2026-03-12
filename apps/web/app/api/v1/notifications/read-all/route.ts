import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

export async function PUT(request: NextRequest) {
  try {
    if (!checkOrigin(request)) {
      return errorResponse('AUTH_FORBIDDEN', 'CSRF 驗證失敗');
    }

    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    if (!['caregiver', 'patient', 'provider', 'admin'].includes(auth.role)) {
      return errorResponse('AUTH_FORBIDDEN', '此角色無權操作通知');
    }

    await prisma.notification.updateMany({
      where: { user_id: auth.userId, is_read: false },
      data: { is_read: true },
    });

    return successResponse({ message: '所有通知已標記為已讀' });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
