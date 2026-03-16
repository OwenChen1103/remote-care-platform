import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  provider: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  serviceRequest: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
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

function createRequest(method: string, body?: unknown, searchParams?: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/v1/providers');
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' } } : {}),
  });
}

describe('POST /api/v1/providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a provider (admin only)', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', role: 'admin' });

    const mockProvider = {
      id: 'prov-1',
      name: '王小明',
      phone: '0912345678',
      email: 'wang@test.com',
      level: 'L1',
      specialties: [],
      certifications: [],
      experience_years: null,
      service_areas: [],
      availability_status: 'available',
      review_status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockPrisma.provider.create.mockResolvedValue(mockProvider);

    const { POST } = await import('../app/api/v1/providers/route');
    const request = createRequest('POST', {
      name: '王小明',
      phone: '0912345678',
      email: 'wang@test.com',
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('王小明');
  });

  it('should reject non-admin', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'cg-1', role: 'caregiver' });

    const { POST } = await import('../app/api/v1/providers/route');
    const request = createRequest('POST', { name: '王小明' });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error.code).toBe('AUTH_FORBIDDEN');
  });

  it('should reject invalid data', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', role: 'admin' });

    const { POST } = await import('../app/api/v1/providers/route');
    const request = createRequest('POST', { name: '' });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list providers with filters (admin only)', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mockPrisma.provider.findMany.mockResolvedValue([]);
    mockPrisma.provider.count.mockResolvedValue(0);

    const { GET } = await import('../app/api/v1/providers/route');
    const request = createRequest('GET', undefined, { review_status: 'approved' });
    const response = await GET(request);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data).toEqual([]);
  });
});
