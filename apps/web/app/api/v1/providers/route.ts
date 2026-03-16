import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { errorResponse, paginatedResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }
    if (auth.role !== 'admin') {
      return errorResponse('AUTH_FORBIDDEN', '僅管理員可查看服務人員列表');
    }

    const url = new URL(request.url);
    const review_status = url.searchParams.get('review_status') ?? undefined;
    const availability_status = url.searchParams.get('availability_status') ?? undefined;
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { deleted_at: null };
    if (review_status) where.review_status = review_status;
    if (availability_status) where.availability_status = availability_status;

    const [providers, total] = await Promise.all([
      prisma.provider.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          level: true,
          specialties: true,
          availability_status: true,
          review_status: true,
        },
      }),
      prisma.provider.count({ where }),
    ]);

    return paginatedResponse(providers, { page, limit, total });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
