import { NextRequest, NextResponse } from 'next/server';
import { checkOrigin } from '@/lib/csrf';
import { errorResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  if (!checkOrigin(request)) {
    return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
  }

  const response = NextResponse.json({ success: true, data: { message: '已登出' } });
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
