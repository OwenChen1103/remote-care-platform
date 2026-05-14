/**
 * Admin audit log read endpoint.
 *
 * Paginated list of `AdminActionLog` rows, joined with the admin user who
 * performed each action. Supports filtering by:
 *   - `action`        — exact match against the action key (e.g. 'user.suspend')
 *   - `admin_user_id` — UUID of a specific admin
 *   - `target_type`   — exact match ('user' / 'provider' / ...)
 *   - `target_id`     — UUID of a specific resource (used for deep-links from
 *                       e.g. a recipient detail page → "view this recipient's history")
 *   - `from` / `to`   — ISO timestamps bracketing created_at
 *
 * Sort order is always `created_at desc` — the audit log is inherently temporal,
 * there's no use case for any other ordering.
 *
 * NOT logging audit-log reads themselves (would be recursive and noisy; the
 * audit log exists for tracking mutations + sensitive reads like preview).
 */
import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { errorResponse, paginatedResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
    if (auth.role !== 'admin') return errorResponse('AUTH_FORBIDDEN', '僅限管理員');

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '30')));
    const skip = (page - 1) * limit;

    const action = url.searchParams.get('action') || undefined;
    const adminUserId = url.searchParams.get('admin_user_id') || undefined;
    const targetType = url.searchParams.get('target_type') || undefined;
    const targetId = url.searchParams.get('target_id') || undefined;
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');

    const where: Prisma.AdminActionLogWhereInput = {};
    if (action) where.action = action;
    if (adminUserId) where.admin_user_id = adminUserId;
    if (targetType) where.target_type = targetType;
    if (targetId) where.target_id = targetId;
    if (fromStr || toStr) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (fromStr) {
        const d = new Date(fromStr);
        if (!Number.isNaN(d.getTime())) dateFilter.gte = d;
      }
      if (toStr) {
        const d = new Date(toStr);
        if (!Number.isNaN(d.getTime())) dateFilter.lte = d;
      }
      if (Object.keys(dateFilter).length > 0) {
        where.created_at = dateFilter;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.adminActionLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          admin: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.adminActionLog.count({ where }),
    ]);

    const data = logs.map((l) => ({
      id: l.id,
      action: l.action,
      target_type: l.target_type,
      target_id: l.target_id,
      summary: l.summary,
      metadata: l.metadata,
      ip_address: l.ip_address,
      user_agent: l.user_agent,
      created_at: l.created_at.toISOString(),
      admin: {
        id: l.admin.id,
        name: l.admin.name,
        email: l.admin.email,
      },
    }));

    return paginatedResponse(data, { page, limit, total });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
