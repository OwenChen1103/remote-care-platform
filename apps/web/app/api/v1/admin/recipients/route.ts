import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { errorResponse, paginatedResponse } from '@/lib/api-response';
import { formatRecipient } from '@/lib/format-recipient';
import { parseSortParam } from '@/lib/parse-sort';

const RECIPIENTS_SORTABLE = ['name', 'created_at', 'date_of_birth'] as const;
const RECIPIENTS_DEFAULT_ORDER = { created_at: 'desc' as const };

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }
    if (auth.role !== 'admin') {
      return errorResponse('AUTH_FORBIDDEN', '僅限管理員存取');
    }

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
    const search = url.searchParams.get('search')?.trim() ?? '';
    const skip = (page - 1) * limit;
    const orderBy = parseSortParam(
      url.searchParams.get('sort'),
      RECIPIENTS_SORTABLE,
      RECIPIENTS_DEFAULT_ORDER,
    );

    const where: { deleted_at: null; name?: { contains: string; mode: 'insensitive' } } = {
      deleted_at: null,
    };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [recipients, total] = await Promise.all([
      prisma.recipient.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          caregiver: {
            select: { id: true, name: true, email: true },
          },
          // Surface bound patient user for admin "linked account" column (Section 1.8.1)
          patient_user: { select: { email: true, name: true } },
          measurements: {
            select: { measured_at: true },
            orderBy: { measured_at: 'desc' },
            take: 1,
          },
          _count: {
            select: { measurements: true },
          },
        },
      }),
      prisma.recipient.count({ where }),
    ]);

    const data = recipients.map((r) => ({
      ...formatRecipient(r),
      caregiver: r.caregiver
        ? { id: r.caregiver.id, name: r.caregiver.name, email: r.caregiver.email }
        : null,
      latest_measurement_date:
        r.measurements[0]?.measured_at?.toISOString() ?? null,
      total_measurements: r._count.measurements,
    }));

    return paginatedResponse(data, { page, limit, total });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
