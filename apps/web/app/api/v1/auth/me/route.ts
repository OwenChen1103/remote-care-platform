import { NextRequest } from 'next/server';
import { UpdateProfileSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

function formatUser(user: {
  id: string; email: string; name: string; role: string;
  phone: string | null; timezone: string;
  date_of_birth: Date | null; address: string | null;
  created_at: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
    timezone: user.timezone,
    date_of_birth: user.date_of_birth ? user.date_of_birth.toISOString().split('T')[0] : null,
    address: user.address,
    created_at: user.created_at.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true, email: true, name: true, role: true, phone: true,
        timezone: true, date_of_birth: true, address: true, created_at: true,
      },
    });

    if (!user) {
      return errorResponse('AUTH_REQUIRED', '使用者不存在');
    }

    return successResponse(formatUser(user));
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!checkOrigin(request)) {
      return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    }

    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    const body: unknown = await request.json();

    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const { date_of_birth, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (date_of_birth !== undefined) {
      updateData.date_of_birth = date_of_birth ? new Date(date_of_birth) : null;
    }

    const user = await prisma.user.update({
      where: { id: auth.userId },
      data: updateData,
      select: {
        id: true, email: true, name: true, role: true, phone: true,
        timezone: true, date_of_birth: true, address: true, created_at: true,
      },
    });

    return successResponse(formatUser(user));
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
