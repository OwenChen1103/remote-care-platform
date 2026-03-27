import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
    if (auth.role !== 'admin') return errorResponse('AUTH_FORBIDDEN', '僅限管理員存取');

    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month'); // YYYY-MM
    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return errorResponse('VALIDATION_ERROR', '請提供有效月份參數（YYYY-MM）');
    }

    const [yearStr, monthStr] = monthParam.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (month < 1 || month > 12) {
      return errorResponse('VALIDATION_ERROR', '月份須介於 01-12');
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1)); // first day of next month

    // Prevent querying future months
    const now = new Date();
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    if (startDate > currentMonthStart) {
      return errorResponse('VALIDATION_ERROR', '不得查詢未來月份');
    }

    const where = { created_at: { gte: startDate, lt: endDate } };
    const measurementWhere = { measured_at: { gte: startDate, lt: endDate } };

    const [
      newCaregivers,
      newRecipients,
      totalMeasurements,
      abnormalMeasurements,
      createdRequests,
      completedRequests,
      cancelledRequests,
      aiReportsGenerated,
      activeProviders,
    ] = await Promise.all([
      prisma.user.count({ where: { ...where, role: 'caregiver' } }),
      prisma.recipient.count({ where }),
      prisma.measurement.count({ where: measurementWhere }),
      prisma.measurement.count({ where: { ...measurementWhere, is_abnormal: true } }),
      prisma.serviceRequest.count({ where }),
      prisma.serviceRequest.count({
        where: { status: 'completed', updated_at: { gte: startDate, lt: endDate } },
      }),
      prisma.serviceRequest.count({
        where: { status: 'cancelled', updated_at: { gte: startDate, lt: endDate } },
      }),
      prisma.aiReport.count({ where: { generated_at: { gte: startDate, lt: endDate } } }),
      prisma.provider.count({
        where: { review_status: 'approved', deleted_at: null },
      }),
    ]);

    // Service requests by category
    const requestsByCategory = await prisma.serviceRequest.groupBy({
      by: ['category_id'],
      where,
      _count: { id: true },
    });

    // Resolve category names
    const categoryIds = requestsByCategory.map((r) => r.category_id);
    const categories = categoryIds.length > 0
      ? await prisma.serviceCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const byCategory: Record<string, number> = {};
    for (const r of requestsByCategory) {
      const name = categoryMap.get(r.category_id) ?? r.category_id;
      byCategory[name] = r._count.id;
    }

    return successResponse({
      month: monthParam,
      new_caregivers: newCaregivers,
      new_recipients: newRecipients,
      total_measurements: totalMeasurements,
      abnormal_measurements: abnormalMeasurements,
      service_requests: {
        created: createdRequests,
        completed: completedRequests,
        cancelled: cancelledRequests,
        by_category: byCategory,
      },
      ai_reports_generated: aiReportsGenerated,
      active_providers: activeProviders,
    });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
