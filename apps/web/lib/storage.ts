/**
 * Supabase Storage helper for Provider profile photos (G12).
 *
 * Uses Supabase Storage REST API directly (no SDK dep). Uploads/deletes are
 * server-side only — service-role key must NEVER reach the client.
 *
 * Bucket: `provider-photos` (public read, see docs/SUPABASE_STORAGE_SETUP.md).
 * Object key: `{providerId}.jpg` — stable so re-uploads overwrite (cache busted via `?t=` query).
 *
 * Why no SDK:
 *   - Single bucket, two operations (upload + delete) — REST is ~50 lines vs +50KB dep
 *   - Keeps `apps/web/package.json` minimal; less attack surface
 */

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const BUCKET = 'provider-photos';

/**
 * Granular error codes so callers can map directly to ErrorCode without substring matching.
 * - NOT_CONFIGURED: env vars missing
 * - FILE_INVALID_TYPE: mime not in ALLOWED_MIME
 * - FILE_TOO_LARGE: size > MAX_BYTES
 * - FILE_EMPTY: zero-byte file
 * - UPLOAD_FAILED: Supabase Storage POST returned non-2xx
 * - DELETE_FAILED: Supabase Storage DELETE returned non-2xx (and not 404)
 */
export type StorageErrorCode =
  | 'NOT_CONFIGURED'
  | 'FILE_INVALID_TYPE'
  | 'FILE_TOO_LARGE'
  | 'FILE_EMPTY'
  | 'UPLOAD_FAILED'
  | 'DELETE_FAILED';

export class StorageError extends Error {
  constructor(public code: StorageErrorCode, message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

interface StorageEnv {
  url: string;
  serviceKey: string;
}

/**
 * Read storage env once + validate they're set. Throws NOT_CONFIGURED if missing —
 * caller should translate to user-facing 「照片上傳尚未啟用」.
 */
function getEnv(): StorageEnv {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new StorageError(
      'NOT_CONFIGURED',
      'Photo upload is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars missing).',
    );
  }
  return { url, serviceKey };
}

/**
 * Validate uploaded file. Returns the canonical extension (always 'jpg' after we standardise).
 * Caller responsible for converting non-jpg images via expo-image-manipulator on mobile,
 * but we accept png/webp as upload bytes too — Supabase storage just stores bytes verbatim.
 */
function validateFile(file: File): void {
  if (!ALLOWED_MIME.includes(file.type as typeof ALLOWED_MIME[number])) {
    throw new StorageError(
      'FILE_INVALID_TYPE',
      `不支援的圖片格式：${file.type}。請使用 JPG / PNG / WebP。`,
    );
  }
  if (file.size > MAX_BYTES) {
    throw new StorageError(
      'FILE_TOO_LARGE',
      `照片檔案過大（${(file.size / 1024 / 1024).toFixed(1)} MB），最大 5 MB。`,
    );
  }
  if (file.size === 0) {
    throw new StorageError('FILE_EMPTY', '照片檔案為空。');
  }
}

/**
 * Construct the public URL for a provider's photo.
 * Includes a `?t={timestamp}` cache-buster so freshly-uploaded photos bypass CDN cache.
 */
function publicUrl(env: StorageEnv, providerId: string, timestamp: number): string {
  return `${env.url}/storage/v1/object/public/${BUCKET}/${providerId}.jpg?t=${timestamp}`;
}

/**
 * Upload a Provider profile photo. Returns the cache-busted public URL to write into
 * `Provider.photo_url`. Overwrites any existing photo with the same providerId.
 *
 * @throws StorageError on validation / upload failure.
 */
export async function uploadProviderPhoto(providerId: string, file: File): Promise<string> {
  const env = getEnv();
  validateFile(file);

  const objectPath = `${providerId}.jpg`;
  const arrayBuffer = await file.arrayBuffer();

  const res = await fetch(`${env.url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.serviceKey}`,
      'Content-Type': file.type, // Supabase honours this for the stored object's content-type
      'x-upsert': 'true',         // Overwrite if exists (re-upload flow)
      'Cache-Control': 'public, max-age=3600',
    },
    body: arrayBuffer,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new StorageError(
      'UPLOAD_FAILED',
      `Supabase Storage upload failed (${res.status}): ${body.slice(0, 200)}`,
    );
  }

  return publicUrl(env, providerId, Date.now());
}

/**
 * Delete a Provider profile photo. Idempotent — returns true even if file didn't exist
 * (404 from Supabase is treated as success, since the goal state — "no file" — is achieved).
 *
 * @throws StorageError on non-404 failure.
 */
export async function deleteProviderPhoto(providerId: string): Promise<void> {
  const env = getEnv();
  const objectPath = `${providerId}.jpg`;

  const res = await fetch(`${env.url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${env.serviceKey}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '');
    throw new StorageError(
      'DELETE_FAILED',
      `Supabase Storage delete failed (${res.status}): ${body.slice(0, 200)}`,
    );
  }
}

/**
 * Check whether photo upload is configured at startup. Used by health checks
 * and by the route handler to give a clearer 503 when env is missing.
 */
export function isStorageConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
