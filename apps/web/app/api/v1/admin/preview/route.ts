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
    const userId = url.searchParams.get('user_id');

    // If no user_id, return user list for the picker
    if (!userId) {
      const users = await prisma.user.findMany({
        where: { role: { in: ['caregiver', 'patient', 'provider'] } },
        select: { id: true, name: true, email: true, role: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
        take: 100,
      });
      return successResponse({ users });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, phone: true },
    });
    if (!user) return errorResponse('RESOURCE_NOT_FOUND', '找不到此帳號');

    const preview: Record<string, unknown> = { user };

    if (user.role === 'caregiver') {
      const recipients = await prisma.recipient.findMany({
        where: { caregiver_id: userId, deleted_at: null },
        select: { id: true, name: true, date_of_birth: true, medical_tags: true },
        take: 10,
      });
      const recentRequests = await prisma.serviceRequest.findMany({
        where: { caregiver_id: userId },
        orderBy: { created_at: 'desc' },
        take: 5,
        include: {
          category: { select: { name: true } },
          recipient: { select: { name: true } },
        },
      });
      preview.recipients = recipients.map((r) => ({
        ...r,
        date_of_birth: r.date_of_birth?.toISOString().split('T')[0] ?? null,
      }));
      preview.recent_requests = recentRequests.map((r) => ({
        id: r.id,
        status: r.status,
        category_name: r.category.name,
        recipient_name: r.recipient.name,
        created_at: r.created_at.toISOString(),
      }));
    } else if (user.role === 'patient') {
      const recipient = await prisma.recipient.findFirst({
        where: { patient_user_id: userId, deleted_at: null },
        select: { id: true, name: true, date_of_birth: true, medical_tags: true },
      });
      const recentMeasurements = recipient
        ? await prisma.measurement.findMany({
            where: { recipient_id: recipient.id },
            orderBy: { measured_at: 'desc' },
            take: 5,
            select: {
              id: true, type: true, systolic: true, diastolic: true,
              glucose_value: true, is_abnormal: true, measured_at: true,
            },
          })
        : [];
      preview.recipient = recipient
        ? { ...recipient, date_of_birth: recipient.date_of_birth?.toISOString().split('T')[0] ?? null }
        : null;
      preview.recent_measurements = recentMeasurements.map((m) => ({
        ...m,
        glucose_value: m.glucose_value ? Number(m.glucose_value) : null,
        measured_at: m.measured_at.toISOString(),
      }));
    } else if (user.role === 'provider') {
      const provider = await prisma.provider.findFirst({
        where: { user_id: userId, deleted_at: null },
        select: {
          id: true, name: true, level: true, review_status: true,
          specialties: true, certifications: true, availability_status: true,
        },
      });
      const tasks = provider
        ? await prisma.serviceRequest.findMany({
            where: { assigned_provider_id: provider.id },
            orderBy: { created_at: 'desc' },
            take: 5,
            include: {
              category: { select: { name: true } },
              recipient: { select: { name: true } },
            },
          })
        : [];
      preview.provider = provider;
      preview.recent_tasks = tasks.map((t) => ({
        id: t.id,
        status: t.status,
        category_name: t.category.name,
        recipient_name: t.recipient.name,
        created_at: t.created_at.toISOString(),
      }));
    } else if (user.role === 'admin') {
      return errorResponse('VALIDATION_ERROR', '不支援預覽管理員帳號');
    }

    return successResponse(preview);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
