import { NextRequest } from 'next/server';
import { AiInteractionListQuerySchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    if (auth.role !== 'caregiver' && auth.role !== 'admin') {
      return errorResponse('AUTH_FORBIDDEN', '無權存取');
    }

    const { searchParams } = new URL(request.url);
    const parsed = AiInteractionListQuerySchema.safeParse({
      recipient_id: searchParams.get('recipient_id'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '參數驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const { recipient_id, page, limit } = parsed.data;

    // Ownership check for caregiver
    if (auth.role === 'caregiver') {
      const recipient = await prisma.recipient.findFirst({
        where: { id: recipient_id, caregiver_id: auth.userId, deleted_at: null },
      });
      if (!recipient) {
        return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
      }
    }

    const skip = (page - 1) * limit;

    const interactions = await prisma.aiInteraction.findMany({
      where: { recipient_id },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        user_message: true,
        routed_task: true,
        response: true,
        disclaimer: true,
        is_fallback: true,
        created_at: true,
      },
    });

    return successResponse(interactions);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
