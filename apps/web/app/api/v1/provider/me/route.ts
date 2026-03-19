import { NextRequest } from 'next/server';
import { ProviderSelfUpdateSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
    if (auth.role !== 'provider') return errorResponse('AUTH_FORBIDDEN', '僅服務人員可存取');
    const provider = await prisma.provider.findFirst({
      where: { user_id: auth.userId, deleted_at: null },
    });
    if (!provider) return errorResponse('AUTH_FORBIDDEN', '找不到服務人員資料');
    return successResponse(provider);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!checkOrigin(request)) return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    const auth = await verifyAuth(request);
    if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
    if (auth.role !== 'provider') return errorResponse('AUTH_FORBIDDEN', '僅服務人員可存取');
    const provider = await prisma.provider.findFirst({
      where: { user_id: auth.userId, deleted_at: null },
    });
    if (!provider) return errorResponse('AUTH_FORBIDDEN', '找不到服務人員資料');
    const body: unknown = await request.json();
    const parsed = ProviderSelfUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
    }
    const updated = await prisma.provider.update({
      where: { id: provider.id },
      data: parsed.data,
    });
    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
