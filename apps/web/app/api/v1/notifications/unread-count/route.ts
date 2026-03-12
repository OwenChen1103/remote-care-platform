import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    if (!['caregiver', 'patient', 'provider', 'admin'].includes(auth.role)) {
      return errorResponse('AUTH_FORBIDDEN', '此角色無權存取通知');
    }

    const count = await prisma.notification.count({
      where: { user_id: auth.userId, is_read: false },
    });

    return successResponse({ count });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
