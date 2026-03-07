import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

interface JwtPayloadData {
  userId: string;
  role: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!checkOrigin(request)) {
      return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    }

    const body = (await request.json()) as { token?: string };
    const { token } = body;

    if (!token) {
      return errorResponse('VALIDATION_ERROR', 'Token 為必填');
    }

    const secret = process.env.JWT_SECRET ?? '';
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayloadData;

    if (decoded.role !== 'admin') {
      return errorResponse('AUTH_FORBIDDEN', '此帳號無管理員權限');
    }

    const response = NextResponse.json({ success: true, data: { message: '已設定 Cookie' } });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return errorResponse('AUTH_INVALID_CREDENTIALS', 'Token 無效或已過期');
  }
}
