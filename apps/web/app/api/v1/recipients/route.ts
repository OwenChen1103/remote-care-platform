import { NextRequest } from 'next/server';
import { RecipientCreateSchema, RECIPIENT_LIMITS } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import { formatRecipient } from '@/lib/format-recipient';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
    const skip = (page - 1) * limit;

    const where: { deleted_at: null; caregiver_id?: string; patient_user_id?: string } = {
      deleted_at: null,
    };

    if (auth.role === 'caregiver') {
      where.caregiver_id = auth.userId;
    } else if (auth.role === 'patient') {
      where.patient_user_id = auth.userId;
    } else if (auth.role === 'admin') {
      const caregiverId = url.searchParams.get('caregiver_id');
      if (caregiverId) {
        where.caregiver_id = caregiverId;
      }
    } else {
      return errorResponse('AUTH_FORBIDDEN', '此角色無權讀取被照護者資料');
    }

    const [recipients, total] = await Promise.all([
      prisma.recipient.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.recipient.count({ where }),
    ]);

    return paginatedResponse(
      recipients.map(formatRecipient),
      { page, limit, total },
    );
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}

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
      return errorResponse('AUTH_FORBIDDEN', '僅照護者可新增被照護者');
    }

    const body: unknown = await request.json();

    const parsed = RecipientCreateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const currentCount = await prisma.recipient.count({
      where: { caregiver_id: auth.userId, deleted_at: null },
    });

    if (currentCount >= RECIPIENT_LIMITS.MAX_PER_CAREGIVER) {
      return errorResponse('RECIPIENT_LIMIT_EXCEEDED', `每位委託人最多 ${RECIPIENT_LIMITS.MAX_PER_CAREGIVER} 位被照護者`);
    }

    const { date_of_birth, ...rest } = parsed.data;

    const recipient = await prisma.$transaction(async (tx) => {
      const created = await tx.recipient.create({
        data: {
          ...rest,
          date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
          caregiver_id: auth.userId,
        },
      });

      await tx.measurementReminder.createMany({
        data: [
          {
            recipient_id: created.id,
            reminder_type: 'morning',
            reminder_time: new Date('1970-01-01T08:00:00Z'),
            is_enabled: true,
          },
          {
            recipient_id: created.id,
            reminder_type: 'evening',
            reminder_time: new Date('1970-01-01T20:00:00Z'),
            is_enabled: true,
          },
        ],
      });

      return created;
    });

    return successResponse(formatRecipient(recipient), 201);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
