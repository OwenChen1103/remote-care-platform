import { NextRequest } from 'next/server';
import { ServiceCategoryUpdateSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import { logAdminAction } from '@/lib/admin-audit';

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
      return errorResponse('AUTH_FORBIDDEN', '僅管理員可修改');
    }

    const { id } = await params;
    const body: unknown = await request.json();

    const parsed = ServiceCategoryUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const existing = await prisma.serviceCategory.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此服務類別');
    }

    const updated = await prisma.serviceCategory.update({
      where: { id },
      data: parsed.data,
    });

    // Most edits to a service category are the is_active toggle (from the
    // services page button) — emit a meaningful summary so the audit log
    // reads cleanly without dumping the full diff every time.
    const toggled =
      typeof parsed.data.is_active === 'boolean' &&
      parsed.data.is_active !== existing.is_active;
    const summary = toggled
      ? `${parsed.data.is_active ? '啟用' : '停用'}服務類別「${existing.name}」`
      : `更新服務類別「${existing.name}」`;

    await logAdminAction(request, {
      adminUserId: auth.userId,
      action: 'service_category.toggle',
      targetType: 'service_category',
      targetId: id,
      summary,
      metadata: {
        changed_fields: Object.keys(parsed.data),
        before: { is_active: existing.is_active },
        after: { is_active: updated.is_active },
      },
    });

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
