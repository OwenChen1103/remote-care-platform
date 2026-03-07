import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { RegisterSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { signJwt } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  try {
    if (!checkOrigin(request)) {
      return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    }

    const body: unknown = await request.json();

    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const { email, password, name, phone, timezone } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return errorResponse('DUPLICATE_ENTRY', '此 Email 已被註冊');
    }

    const password_hash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, password_hash, name, phone, timezone },
    });

    const token = signJwt({ userId: user.id, role: 'caregiver' });

    return successResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone,
          timezone: user.timezone,
          created_at: user.created_at.toISOString(),
        },
        token,
      },
      201,
    );
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
