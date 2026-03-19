import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { errorResponse, paginatedResponse } from '@/lib/api-response';

const TASK_STATUSES = ['arranged', 'in_service', 'completed'];

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
    if (auth.role !== 'provider') return errorResponse('AUTH_FORBIDDEN', '僅服務人員可存取');

    const provider = await prisma.provider.findFirst({
      where: { user_id: auth.userId, deleted_at: null },
      select: { id: true },
    });
    if (!provider) return errorResponse('AUTH_FORBIDDEN', '找不到服務人員資料');

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { assigned_provider_id: provider.id };
    if (statusFilter && TASK_STATUSES.includes(statusFilter)) {
      where.status = statusFilter;
    } else {
      where.status = { in: TASK_STATUSES };
    }

    const [tasks, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        orderBy: { preferred_date: 'asc' },
        skip,
        take: limit,
        include: {
          category: { select: { id: true, code: true, name: true } },
          recipient: { select: { id: true, name: true } },
        },
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    return paginatedResponse(tasks, { page, limit, total });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
