import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import {
  ServiceRequestCreateSchema,
  ServiceRequestListQuerySchema,
} from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import { notifyServiceRequestUpdate } from '@/lib/service-notifications';
import { parseSortParam } from '@/lib/parse-sort';

const SERVICE_REQUESTS_SORTABLE = ['created_at', 'preferred_date', 'status'] as const;
const SERVICE_REQUESTS_DEFAULT_ORDER = { created_at: 'desc' as const };

export async function POST(request: NextRequest) {
  try {
    if (!checkOrigin(request)) {
      return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    }

    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }
    if (auth.role !== 'caregiver') {
      return errorResponse('AUTH_FORBIDDEN', '僅照護者可建立服務需求');
    }

    const body: unknown = await request.json();
    const parsed = ServiceRequestCreateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const data = parsed.data;

    // Ownership: caregiver must own the recipient
    const recipient = await prisma.recipient.findFirst({
      where: { id: data.recipient_id, deleted_at: null },
    });
    if (!recipient) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
    }
    if (recipient.caregiver_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');
    }

    // Category must be active
    const category = await prisma.serviceCategory.findUnique({
      where: { id: data.category_id },
    });
    if (!category || !category.is_active) {
      return errorResponse('VALIDATION_ERROR', '此服務類別不存在或已停用');
    }

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        caregiver_id: auth.userId,
        recipient_id: data.recipient_id,
        category_id: data.category_id,
        status: 'submitted',
        preferred_date: new Date(data.preferred_date),
        preferred_time_slot: data.preferred_time_slot ?? null,
        location: data.location,
        departure_location: data.departure_location ?? null,
        destination: data.destination ?? null,
        service_duration: data.service_duration ?? null,
        description: data.description,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
      include: {
        category: { select: { id: true, code: true, name: true } },
        recipient: { select: { id: true, name: true } },
      },
    });

    // Section 2.3 row 1: notify all admins of a new service request.
    // Caregiver isn't notified — they just submitted it.
    await notifyServiceRequestUpdate({
      serviceRequestId: serviceRequest.id,
      targetStatus: 'submitted',
      recipients: { notifyAllAdmins: true },
      messages: {
        admin: {
          title: '新服務需求待審核',
          body: `${serviceRequest.recipient.name} 的「${serviceRequest.category.name}」需求已送出，請開始審核`,
        },
      },
      extraData: {
        recipient_name: serviceRequest.recipient.name,
        category_name: serviceRequest.category.name,
      },
    });

    return successResponse(serviceRequest, 201);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    const url = new URL(request.url);
    const queryObj: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryObj[key] = value;
    }

    const parsed = ServiceRequestListQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '查詢參數驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const { status, category_id, page, limit } = parsed.data;
    const skip = (page - 1) * limit;
    // Sort is read outside the shared Zod schema so we don't have to touch
    // the @remote-care/shared package (which is also consumed by mobile).
    const orderBy = parseSortParam(
      url.searchParams.get('sort'),
      SERVICE_REQUESTS_SORTABLE,
      SERVICE_REQUESTS_DEFAULT_ORDER,
    );

    // Build where clause based on role
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category_id) where.category_id = category_id;

    switch (auth.role) {
      case 'caregiver':
        where.caregiver_id = auth.userId;
        break;

      case 'patient': {
        // Patient sees requests for recipients where patient_user_id = auth.userId
        const recipient = await prisma.recipient.findFirst({
          where: { patient_user_id: auth.userId, deleted_at: null },
          select: { id: true },
        });
        if (!recipient) {
          return paginatedResponse([], { page, limit, total: 0 });
        }
        where.recipient_id = recipient.id;
        break;
      }

      case 'provider': {
        // Provider sees requests where they are EITHER the candidate (during
        // `candidate_proposed`/`caregiver_confirmed`) OR the assigned provider
        // (every later state). Mirrors /provider/tasks ownership semantics —
        // without the candidate arm, requests disappear from a provider's view
        // the moment caregiver confirms, which is the exact window they should
        // be acting on.
        const provider = await prisma.provider.findFirst({
          where: { user_id: auth.userId, deleted_at: null },
          select: { id: true },
        });
        if (!provider) {
          // No provider profile → empty result, no error
          return paginatedResponse([], { page, limit, total: 0 });
        }
        where.OR = [
          {
            status: { in: ['candidate_proposed', 'caregiver_confirmed'] },
            candidate_provider_id: provider.id,
          },
          { assigned_provider_id: provider.id },
        ];
        break;
      }

      case 'admin':
        // Admin sees all — no additional filter
        break;

      default:
        return errorResponse('AUTH_FORBIDDEN', '無權存取');
    }

    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: { select: { id: true, code: true, name: true } },
          recipient: { select: { id: true, name: true } },
        },
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    return paginatedResponse(requests, { page, limit, total });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
