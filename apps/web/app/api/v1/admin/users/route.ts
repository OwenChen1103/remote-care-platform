/**
 * Admin user management — list endpoint (Section 3.5.5).
 *
 * Used by:
 *   - admin/users/page.tsx              (full table view, filter/search/suspend)
 *   - admin/recipients/[id]/page.tsx    (typeahead dropdown for patient binding)
 *
 * Filters:
 *   - role:      caregiver | patient | provider | admin (optional)
 *   - suspended: 'true' | 'false' (optional; 'true' = suspended_at != null)
 *   - search:    case-insensitive substring match against email or name
 *
 * Returns paginated `{ id, email, name, role, suspended_at, created_at }` per user.
 */
import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
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
      return errorResponse('AUTH_FORBIDDEN', '僅管理員可存取');
    }

    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const suspended = url.searchParams.get('suspended');
    const search = url.searchParams.get('search')?.trim() ?? '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (role && ['caregiver', 'patient', 'provider', 'admin'].includes(role)) {
      where.role = role;
    }
    if (suspended === 'true') {
      where.suspended_at = { not: null };
    } else if (suspended === 'false') {
      where.suspended_at = null;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          suspended_at: true,
          created_at: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    const data = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      suspended_at: u.suspended_at?.toISOString() ?? null,
      created_at: u.created_at.toISOString(),
    }));

    return paginatedResponse(data, { page, limit, total });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
