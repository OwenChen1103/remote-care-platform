import { NextRequest } from 'next/server';
import {
  MeasurementCreateSchema,
  MeasurementQuerySchema,
  checkBloodPressureLevel,
  checkBloodGlucoseLevel,
} from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import { formatMeasurement } from '@/lib/format-measurement';
import { checkAndNotifyAbnormal } from '@/lib/abnormal-notification';

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
      return errorResponse('AUTH_FORBIDDEN', '僅照護者可新增量測資料');
    }

    const body: unknown = await request.json();

    const parsed = MeasurementCreateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const data = parsed.data;

    // Ownership check
    const recipient = await prisma.recipient.findFirst({
      where: { id: data.recipient_id, deleted_at: null },
    });

    if (!recipient) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
    }

    if (recipient.caregiver_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');
    }

    // Determine abnormal level
    let isAbnormal = false;
    if (data.type === 'blood_pressure') {
      const level = checkBloodPressureLevel(data.systolic, data.diastolic);
      isAbnormal = level === 'abnormal';
    } else {
      const level = checkBloodGlucoseLevel(data.glucose_value, data.glucose_timing);
      isAbnormal = level === 'abnormal';
    }

    // Create measurement
    const measurement = await prisma.measurement.create({
      data: {
        recipient_id: data.recipient_id,
        type: data.type,
        systolic: data.type === 'blood_pressure' ? data.systolic : null,
        diastolic: data.type === 'blood_pressure' ? data.diastolic : null,
        heart_rate: data.type === 'blood_pressure' ? (data.heart_rate ?? null) : null,
        glucose_value: data.type === 'blood_glucose' ? data.glucose_value : null,
        glucose_timing: data.type === 'blood_glucose' ? data.glucose_timing : null,
        unit: data.unit,
        source: data.source,
        device_id: data.device_id ?? null,
        is_abnormal: isAbnormal,
        note: data.note ?? null,
        measured_at: new Date(data.measured_at),
      },
    });

    // Check consecutive abnormal and notify if needed
    if (isAbnormal) {
      await checkAndNotifyAbnormal({
        recipientId: data.recipient_id,
        recipientName: recipient.name,
        caregiverUserId: auth.userId,
        measurementId: measurement.id,
        measurementType: data.type,
      });
    }

    return successResponse(formatMeasurement(measurement), 201);
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

    const parsed = MeasurementQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '查詢參數驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const { recipient_id, type, from, to, page, limit } = parsed.data;

    // Ownership check
    const recipient = await prisma.recipient.findFirst({
      where: { id: recipient_id, deleted_at: null },
    });

    if (!recipient) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
    }

    if (auth.role === 'caregiver' && recipient.caregiver_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');
    }

    const where: Record<string, unknown> = { recipient_id };
    if (type) where.type = type;
    if (from || to) {
      where.measured_at = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const skip = (page - 1) * limit;

    const [measurements, total] = await Promise.all([
      prisma.measurement.findMany({
        where,
        orderBy: { measured_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.measurement.count({ where }),
    ]);

    return paginatedResponse(
      measurements.map(formatMeasurement),
      { page, limit, total },
    );
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
