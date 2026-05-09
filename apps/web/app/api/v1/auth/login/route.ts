import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { LoginSchema } from '@remote-care/shared';
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

    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return errorResponse('AUTH_INVALID_CREDENTIALS', '帳號或密碼錯誤');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return errorResponse('AUTH_INVALID_CREDENTIALS', '帳號或密碼錯誤');
    }

    // Decision G enforcement at the LOGIN entry point (audit finding #1).
    // verifyAuth blocks suspended users on subsequent requests via DB lookup, but without
    // this guard, a suspended user could still POST /auth/login and walk away with a fresh
    // 7-day JWT. Block here so suspension takes effect immediately and uniformly.
    if (user.suspended_at) {
      return errorResponse('AUTH_FORBIDDEN', '此帳號已被停權，請聯繫客服');
    }

    const token = signJwt({ userId: user.id, role: user.role as 'caregiver' | 'patient' | 'provider' | 'admin' });

    return successResponse({
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
    });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
