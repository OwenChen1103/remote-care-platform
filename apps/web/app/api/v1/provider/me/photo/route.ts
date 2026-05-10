/**
 * Provider profile photo (G12).
 *
 * POST   — multipart upload of a single image; uploads to Supabase Storage,
 *          writes returned public URL to Provider.photo_url, returns the updated provider.
 * DELETE — removes the file from Storage AND clears Provider.photo_url.
 *
 * Auth: provider only. Status guard mirrors PUT /provider/me — rejected providers
 * must use /provider/me/reapply first (consistent with audit fix #2).
 *
 * Multipart: uses Next.js App Router native `request.formData()` (no formidable/multer).
 * Field name: `photo` — Mobile sends FormData with key 'photo' (see api-client.upload).
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import {
  uploadProviderPhoto,
  deleteProviderPhoto,
  isStorageConfigured,
  StorageError,
} from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    if (!checkOrigin(request)) return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    const auth = await verifyAuth(request);
    if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
    if (auth.role !== 'provider') return errorResponse('AUTH_FORBIDDEN', '僅服務人員可存取');

    if (!isStorageConfigured()) {
      // Surface a clear server-side config issue instead of a generic 500.
      return errorResponse('SERVER_ERROR', '照片上傳功能尚未啟用，請聯繫客服');
    }

    const provider = await prisma.provider.findFirst({
      where: { user_id: auth.userId, deleted_at: null },
    });
    if (!provider) return errorResponse('AUTH_FORBIDDEN', '找不到服務人員資料');

    // Mirror PUT /provider/me's rejection guard. A rejected provider editing their photo
    // would silently update without re-triggering review; force them through /reapply first.
    if (provider.review_status === 'rejected') {
      return errorResponse(
        'INVALID_STATE_TRANSITION',
        '審核未通過時無法直接修改資料，請點選「重新送審」按鈕後再進行編輯',
      );
    }

    // Parse multipart. App Router's request.formData() is built-in.
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return errorResponse('VALIDATION_ERROR', '請以 multipart/form-data 上傳照片');
    }

    const file = formData.get('photo');
    if (!(file instanceof File)) {
      return errorResponse('VALIDATION_ERROR', '缺少 photo 欄位');
    }

    // Upload + persist URL atomically as far as possible:
    //   1. Upload to Supabase first (cheap to delete if subsequent DB write fails)
    //   2. Update DB photo_url
    //   3. If DB write throws, attempt to delete the orphaned file (best-effort)
    let publicUrl: string;
    try {
      publicUrl = await uploadProviderPhoto(provider.id, file);
    } catch (e) {
      if (e instanceof StorageError) {
        // Direct code mapping — no string sniffing. Each StorageError code maps to one
        // shared ErrorCode (see packages/shared/src/constants/error-codes.ts).
        switch (e.code) {
          case 'FILE_INVALID_TYPE':
            return errorResponse('FILE_INVALID_TYPE', e.message);
          case 'FILE_TOO_LARGE':
            return errorResponse('FILE_TOO_LARGE', e.message);
          case 'FILE_EMPTY':
            return errorResponse('VALIDATION_ERROR', e.message);
          case 'NOT_CONFIGURED':
          case 'UPLOAD_FAILED':
          case 'DELETE_FAILED':
            return errorResponse('SERVER_ERROR', e.message);
        }
      }
      throw e;
    }

    let updated;
    try {
      updated = await prisma.provider.update({
        where: { id: provider.id },
        data: { photo_url: publicUrl },
      });
    } catch (e) {
      // DB write failed — orphaned file in storage. Best-effort cleanup so we don't
      // accumulate junk objects. Don't propagate cleanup errors (we already failed primary op).
      void deleteProviderPhoto(provider.id).catch(() => {});
      throw e;
    }

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!checkOrigin(request)) return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    const auth = await verifyAuth(request);
    if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
    if (auth.role !== 'provider') return errorResponse('AUTH_FORBIDDEN', '僅服務人員可存取');

    const provider = await prisma.provider.findFirst({
      where: { user_id: auth.userId, deleted_at: null },
    });
    if (!provider) return errorResponse('AUTH_FORBIDDEN', '找不到服務人員資料');

    // Same rejection guard as POST — keep transitions consistent.
    if (provider.review_status === 'rejected') {
      return errorResponse(
        'INVALID_STATE_TRANSITION',
        '審核未通過時無法直接修改資料，請點選「重新送審」按鈕後再進行編輯',
      );
    }

    // If never had a photo, nothing to delete in storage; just no-op the DB write too.
    // (We still want to return the provider for client-side state hydration.)
    if (provider.photo_url) {
      // Storage delete is idempotent (404 = success). If storage isn't configured at all,
      // we still want to clear the DB column so the UI stops trying to render a dead URL.
      if (isStorageConfigured()) {
        try {
          await deleteProviderPhoto(provider.id);
        } catch (e) {
          if (e instanceof StorageError) {
            return errorResponse('SERVER_ERROR', e.message);
          }
          throw e;
        }
      }
    }

    const updated = await prisma.provider.update({
      where: { id: provider.id },
      data: { photo_url: null },
    });

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
