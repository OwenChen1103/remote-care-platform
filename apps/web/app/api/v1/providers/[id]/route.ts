import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { ProviderUpdateSchema } from '@remote-care/shared';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }
    if (auth.role !== 'admin') {
      return errorResponse('AUTH_FORBIDDEN', '僅管理員可查看服務人員詳情');
    }

    const { id } = await params;
    const provider = await prisma.provider.findFirst({
      where: { id, deleted_at: null },
    });

    if (!provider) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到該服務人員');
    }

    return successResponse(provider);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!checkOrigin(request)) {
      return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    }
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }
    if (auth.role !== 'admin') {
      return errorResponse('AUTH_FORBIDDEN', '僅管理員可更新服務人員');
    }

    const { id } = await params;
    const existing = await prisma.provider.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到該服務人員');
    }

    const body: unknown = await request.json();
    const parsed = ProviderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const provider = await prisma.provider.update({
      where: { id },
      data: parsed.data,
    });

    return successResponse(provider);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!checkOrigin(request)) {
      return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    }
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }
    if (auth.role !== 'admin') {
      return errorResponse('AUTH_FORBIDDEN', '僅管理員可刪除服務人員');
    }

    const { id } = await params;
    const existing = await prisma.provider.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到該服務人員');
    }

    await prisma.provider.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    return successResponse({ id, deleted: true });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
