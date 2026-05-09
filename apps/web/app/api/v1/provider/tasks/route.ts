import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { errorResponse, paginatedResponse } from '@/lib/api-response';

/**
 * Provider task list (Section 2.7.2 + Section 3.5.3).
 *
 * Statuses included:
 *   - 'caregiver_confirmed'  : provider is the candidate; needs to accept (provider-confirm screen)
 *   - 'arranged'             : provider committed; main work pipeline
 *   - 'in_service'           : provider in progress
 *   - 'completed'            : finished
 *   - 'provider_confirmed'   : reachable only via admin manual rescue (Decision B); main flow auto-arranges past it
 *   - 'cancelled'            : opt-in via ?include_cancelled=true (history view)
 *
 * Ownership scoping:
 *   - For 'caregiver_confirmed', match `candidate_provider_id` (provider hasn't accepted yet)
 *   - For all others, match `assigned_provider_id` (provider already committed)
 *
 * Recipient select extended (Section 3.5.3): list shows age + gender + medical tags
 * to give providers enough context on the card. Detail endpoint exposes more.
 */
const ASSIGNED_STATUSES = ['provider_confirmed', 'arranged', 'in_service', 'completed'] as const;

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
    const includeCancelled = url.searchParams.get('include_cancelled') === 'true';
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
    const skip = (page - 1) * limit;

    // Compose ownership-aware OR'd predicate.
    const orClauses: Prisma.ServiceRequestWhereInput[] = [
      { status: 'caregiver_confirmed', candidate_provider_id: provider.id },
      { status: { in: [...ASSIGNED_STATUSES] }, assigned_provider_id: provider.id },
    ];
    if (includeCancelled) {
      orClauses.push({ status: 'cancelled', assigned_provider_id: provider.id });
    }

    const where: Prisma.ServiceRequestWhereInput = { OR: orClauses };
    // If a specific status filter is passed, intersect with the OR clauses above.
    // We do this by replacing with a more specific where: provider AND status match the requested.
    if (statusFilter) {
      const allowedStatuses = ['caregiver_confirmed', ...ASSIGNED_STATUSES, ...(includeCancelled ? ['cancelled'] : [])];
      if (!allowedStatuses.includes(statusFilter)) {
        // Unknown filter → empty result instead of erroring.
        return paginatedResponse([], { page, limit, total: 0 });
      }
      const ownership = statusFilter === 'caregiver_confirmed'
        ? { candidate_provider_id: provider.id }
        : { assigned_provider_id: provider.id };
      Object.assign(where, { status: statusFilter, ...ownership });
      delete where.OR;
    }

    const [tasks, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        orderBy: { preferred_date: 'asc' },
        skip,
        take: limit,
        include: {
          category: { select: { id: true, code: true, name: true } },
          recipient: {
            select: {
              id: true,
              name: true,
              date_of_birth: true,
              gender: true,
              medical_tags: true,
            },
          },
        },
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    return paginatedResponse(tasks, { page, limit, total });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
