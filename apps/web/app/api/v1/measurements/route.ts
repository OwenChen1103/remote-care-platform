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

    // Both caregivers and patients can record measurements. Patients self-report
    // for the recipient they are bound to (Section 1.7 patient-bound flow), in
    // which case the data still belongs to the same recipient row — caregivers
    // and patients share one source of truth.
    if (auth.role !== 'caregiver' && auth.role !== 'patient') {
      return errorResponse('AUTH_FORBIDDEN', '無權新增量測資料');
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

    // Ownership check — caregiver must own the recipient; patient must be the
    // bound patient_user_id. Anything else is forbidden.
    const recipient = await prisma.recipient.findFirst({
      where: { id: data.recipient_id, deleted_at: null },
    });

    if (!recipient) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
    }

    const isCaregiverOwner =
      auth.role === 'caregiver' && recipient.caregiver_id === auth.userId;
    const isBoundPatient =
      auth.role === 'patient' && recipient.patient_user_id === auth.userId;
    if (!isCaregiverOwner && !isBoundPatient) {
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

    // Check consecutive abnormal and notify if needed.
    // `caregiverUserId` is the notification recipient — must be the actual
    // caregiver (from recipient.caregiver_id), NOT the submitter. When a
    // patient self-reports an abnormal reading, the caregiver is the one
    // who needs to know; notifying the patient about their own reading
    // would be useless noise.
    if (isAbnormal) {
      await checkAndNotifyAbnormal({
        recipientId: data.recipient_id,
        recipientName: recipient.name,
        caregiverUserId: recipient.caregiver_id,
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

    // Ownership check (Section 3.5.2):
    //   - caregiver : must own the recipient
    //   - patient   : must be linked (recipient.patient_user_id = me)
    //   - provider  : must have an active assignment (arranged | in_service) on this recipient
    //   - admin     : unrestricted
    const recipient = await prisma.recipient.findFirst({
      where: { id: recipient_id, deleted_at: null },
    });

    if (!recipient) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
    }

    if (auth.role === 'caregiver') {
      if (recipient.caregiver_id !== auth.userId) {
        return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');
      }
    } else if (auth.role === 'patient') {
      if (recipient.patient_user_id !== auth.userId) {
        return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');
      }
    } else if (auth.role === 'provider') {
      // Provider gets read access ONLY while there's an active service request.
      // Once status moves out of arranged/in_service, access is revoked — provider
      // shouldn't retain visibility into a recipient they're no longer serving.
      const provider = await prisma.provider.findFirst({
        where: { user_id: auth.userId, deleted_at: null },
        select: { id: true },
      });
      if (!provider) {
        return errorResponse('AUTH_FORBIDDEN', '找不到服務人員資料');
      }
      const assignment = await prisma.serviceRequest.findFirst({
        where: {
          assigned_provider_id: provider.id,
          recipient_id,
          status: { in: ['arranged', 'in_service'] },
        },
        select: { id: true },
      });
      if (!assignment) {
        return errorResponse('RESOURCE_OWNERSHIP_DENIED', '您未被指派此被照護者的進行中任務');
      }
    } else if (auth.role !== 'admin') {
      return errorResponse('AUTH_FORBIDDEN', '無權存取');
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
