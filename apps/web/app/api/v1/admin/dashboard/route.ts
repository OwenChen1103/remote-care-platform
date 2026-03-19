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
    if (auth.role !== 'admin') {
      return errorResponse('AUTH_FORBIDDEN', '僅限管理員存取');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalCaregivers,
      totalRecipients,
      totalMeasurementsToday,
      pendingServiceRequests,
      pendingProviderReviews,
      abnormalAlertsToday,
      recentPendingRequests,
      recentAbnormalAlerts,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'caregiver' } }),
      prisma.recipient.count({ where: { deleted_at: null } }),
      prisma.measurement.count({ where: { measured_at: { gte: today } } }),
      prisma.serviceRequest.count({ where: { status: 'submitted' } }),
      prisma.provider.count({ where: { review_status: 'pending', deleted_at: null } }),
      prisma.notification.count({ where: { type: 'abnormal_alert', created_at: { gte: today } } }),
      prisma.serviceRequest.findMany({
        where: { status: 'submitted' },
        orderBy: { created_at: 'desc' },
        take: 5,
        include: {
          category: { select: { name: true } },
          recipient: { select: { name: true } },
        },
      }),
      prisma.notification.findMany({
        where: { type: 'abnormal_alert' },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: { id: true, title: true, body: true, created_at: true },
      }),
    ]);

    return successResponse({
      stats: {
        total_caregivers: totalCaregivers,
        total_recipients: totalRecipients,
        total_measurements_today: totalMeasurementsToday,
        pending_service_requests: pendingServiceRequests,
        pending_provider_reviews: pendingProviderReviews,
        abnormal_alerts_today: abnormalAlertsToday,
      },
      recent_pending_requests: recentPendingRequests.map((r) => ({
        id: r.id,
        category_name: r.category.name,
        recipient_name: r.recipient.name,
        preferred_date: r.preferred_date.toISOString(),
        created_at: r.created_at.toISOString(),
      })),
      recent_abnormal_alerts: recentAbnormalAlerts.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        created_at: n.created_at.toISOString(),
      })),
    });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
