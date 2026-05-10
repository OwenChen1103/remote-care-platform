import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Hoisted mocks ────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  provider: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

const mockVerifyAuth = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({
  verifyAuth: mockVerifyAuth,
  signJwt: vi.fn(() => 'mock-token'),
}));

vi.mock('@/lib/csrf', () => ({
  checkOrigin: vi.fn(() => true),
}));

const mockStorage = vi.hoisted(() => ({
  uploadProviderPhoto: vi.fn(),
  deleteProviderPhoto: vi.fn(),
  isStorageConfigured: vi.fn(() => true),
}));
vi.mock('@/lib/storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage')>('@/lib/storage');
  return {
    ...mockStorage,
    StorageError: actual.StorageError,
  };
});

// ─── Imports under test ───────────────────────────────────────

import { POST, DELETE } from '../app/api/v1/provider/me/photo/route';

// ─── Helpers ──────────────────────────────────────────────────

const PROVIDER_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';

function createMultipartRequest(method: 'POST' | 'DELETE', file?: { name: string; type: string; size: number }) {
  const formData = new FormData();
  if (file) {
    // Use ArrayBuffer (Blob accepts BufferSource) instead of Uint8Array to avoid
    // strict TS complaint about ArrayBufferLike vs ArrayBuffer in lib.dom.d.ts.
    const buffer = new ArrayBuffer(file.size);
    const blob = new Blob([buffer], { type: file.type });
    // Construct a File explicitly so the route's `instanceof File` check passes.
    formData.append('photo', new File([blob], file.name, { type: file.type }));
  }
  return new NextRequest(`http://localhost:3000/api/v1/provider/me/photo`, {
    method,
    body: method === 'POST' ? formData : undefined,
    headers: { Origin: 'http://localhost:3000' },
  });
}

function defaultProvider(overrides?: Partial<{ review_status: string; photo_url: string | null }>) {
  return {
    id: PROVIDER_ID,
    user_id: USER_ID,
    name: 'Test Provider',
    review_status: 'approved',
    photo_url: null,
    deleted_at: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────

describe('POST /api/v1/provider/me/photo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.isStorageConfigured.mockReturnValue(true);
  });

  it('returns 401 AUTH_REQUIRED when not authenticated', async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await POST(createMultipartRequest('POST'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });

  it('returns 403 AUTH_FORBIDDEN when role !== provider', async () => {
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID, role: 'caregiver' });
    const res = await POST(createMultipartRequest('POST'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_FORBIDDEN');
  });

  it('returns SERVER_ERROR when storage env is not configured', async () => {
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID, role: 'provider' });
    mockStorage.isStorageConfigured.mockReturnValueOnce(false);
    const res = await POST(createMultipartRequest('POST'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('SERVER_ERROR');
    expect(body.error.message).toContain('尚未啟用');
  });

  it('returns 403 when provider record not found', async () => {
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID, role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValueOnce(null);
    const res = await POST(createMultipartRequest('POST'));
    expect(res.status).toBe(403);
  });

  it('blocks INVALID_STATE_TRANSITION when review_status is rejected', async () => {
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID, role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValueOnce(defaultProvider({ review_status: 'rejected' }));
    const res = await POST(createMultipartRequest('POST', { name: 'x.jpg', type: 'image/jpeg', size: 100 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('returns VALIDATION_ERROR when photo field is missing', async () => {
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID, role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValueOnce(defaultProvider());
    const res = await POST(createMultipartRequest('POST'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('photo');
  });

  it('uploads file, persists photo_url, returns updated provider', async () => {
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID, role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValueOnce(defaultProvider());
    const expectedUrl = 'https://x.supabase.co/storage/v1/object/public/provider-photos/abc.jpg?t=123';
    mockStorage.uploadProviderPhoto.mockResolvedValueOnce(expectedUrl);
    mockPrisma.provider.update.mockResolvedValueOnce(defaultProvider({ photo_url: expectedUrl }));

    const res = await POST(createMultipartRequest('POST', { name: 'x.jpg', type: 'image/jpeg', size: 100 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.photo_url).toBe(expectedUrl);
    expect(mockStorage.uploadProviderPhoto).toHaveBeenCalledWith(PROVIDER_ID, expect.any(File));
    expect(mockPrisma.provider.update).toHaveBeenCalledWith({
      where: { id: PROVIDER_ID },
      data: { photo_url: expectedUrl },
    });
  });

  // Granular storage error code mapping (Fix B): each StorageError code maps to a
  // specific shared ErrorCode so we don't rely on substring matching.
  it('maps FILE_INVALID_TYPE storage error to FILE_INVALID_TYPE response', async () => {
    const { StorageError } = await import('../lib/storage');
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID, role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValueOnce(defaultProvider());
    mockStorage.uploadProviderPhoto.mockRejectedValueOnce(
      new StorageError('FILE_INVALID_TYPE', '不支援的圖片格式：image/gif。請使用 JPG / PNG / WebP。'),
    );

    const res = await POST(createMultipartRequest('POST', { name: 'x.gif', type: 'image/gif', size: 100 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('FILE_INVALID_TYPE');
  });

  it('maps FILE_TOO_LARGE storage error to FILE_TOO_LARGE response', async () => {
    const { StorageError } = await import('../lib/storage');
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID, role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValueOnce(defaultProvider());
    mockStorage.uploadProviderPhoto.mockRejectedValueOnce(
      new StorageError('FILE_TOO_LARGE', '照片檔案過大（6.5 MB），最大 5 MB。'),
    );

    const res = await POST(createMultipartRequest('POST', { name: 'big.jpg', type: 'image/jpeg', size: 100 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('maps FILE_EMPTY storage error to VALIDATION_ERROR response', async () => {
    const { StorageError } = await import('../lib/storage');
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID, role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValueOnce(defaultProvider());
    mockStorage.uploadProviderPhoto.mockRejectedValueOnce(
      new StorageError('FILE_EMPTY', '照片檔案為空。'),
    );

    const res = await POST(createMultipartRequest('POST', { name: 'empty.jpg', type: 'image/jpeg', size: 100 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cleans up storage if DB write fails after upload', async () => {
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID, role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValueOnce(defaultProvider());
    mockStorage.uploadProviderPhoto.mockResolvedValueOnce('https://x/y.jpg?t=1');
    mockPrisma.provider.update.mockRejectedValueOnce(new Error('DB down'));
    mockStorage.deleteProviderPhoto.mockResolvedValueOnce(undefined);

    const res = await POST(createMultipartRequest('POST', { name: 'x.jpg', type: 'image/jpeg', size: 100 }));
    expect(res.status).toBe(500);
    // Best-effort cleanup — file deleted to avoid orphan
    expect(mockStorage.deleteProviderPhoto).toHaveBeenCalledWith(PROVIDER_ID);
  });
});

describe('DELETE /api/v1/provider/me/photo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.isStorageConfigured.mockReturnValue(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await DELETE(createMultipartRequest('DELETE'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when role !== provider', async () => {
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID, role: 'caregiver' });
    const res = await DELETE(createMultipartRequest('DELETE'));
    expect(res.status).toBe(403);
  });

  it('blocks INVALID_STATE_TRANSITION when rejected', async () => {
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID, role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValueOnce(defaultProvider({ review_status: 'rejected', photo_url: 'http://x/y.jpg' }));
    const res = await DELETE(createMultipartRequest('DELETE'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('clears photo_url + deletes from storage when photo exists', async () => {
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID, role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValueOnce(defaultProvider({ photo_url: 'http://x/y.jpg?t=1' }));
    mockStorage.deleteProviderPhoto.mockResolvedValueOnce(undefined);
    mockPrisma.provider.update.mockResolvedValueOnce(defaultProvider({ photo_url: null }));

    const res = await DELETE(createMultipartRequest('DELETE'));
    expect(res.status).toBe(200);
    expect(mockStorage.deleteProviderPhoto).toHaveBeenCalledWith(PROVIDER_ID);
    expect(mockPrisma.provider.update).toHaveBeenCalledWith({
      where: { id: PROVIDER_ID },
      data: { photo_url: null },
    });
  });

  it('skips storage delete when photo_url is already null (idempotent no-op)', async () => {
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID, role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValueOnce(defaultProvider({ photo_url: null }));
    mockPrisma.provider.update.mockResolvedValueOnce(defaultProvider({ photo_url: null }));

    const res = await DELETE(createMultipartRequest('DELETE'));
    expect(res.status).toBe(200);
    expect(mockStorage.deleteProviderPhoto).not.toHaveBeenCalled();
  });
});
