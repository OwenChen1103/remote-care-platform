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

// --- Provider Detail [id] routes ---

function createParamsRequest(method: string, id: string, body?: unknown) {
  const url = new URL(`http://localhost:3000/api/v1/providers/${id}`);
  return new NextRequest(url, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' } } : {}),
  });
}

const mockProviderDetail = {
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
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('GET /api/v1/providers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return provider detail (admin only)', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mockPrisma.provider.findFirst.mockResolvedValue(mockProviderDetail);

    const { GET } = await import('../app/api/v1/providers/[id]/route');
    const request = createParamsRequest('GET', 'prov-1');
    const response = await GET(request, { params: Promise.resolve({ id: 'prov-1' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('prov-1');
    expect(json.data.name).toBe('王小明');
  });

  it('should return 404 for non-existent provider', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mockPrisma.provider.findFirst.mockResolvedValue(null);

    const { GET } = await import('../app/api/v1/providers/[id]/route');
    const request = createParamsRequest('GET', 'non-existent');
    const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error.code).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('PUT /api/v1/providers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update provider (admin only)', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mockPrisma.provider.findFirst.mockResolvedValue(mockProviderDetail);
    const updatedProvider = { ...mockProviderDetail, name: '李大華', level: 'L2' };
    mockPrisma.provider.update.mockResolvedValue(updatedProvider);

    const { PUT } = await import('../app/api/v1/providers/[id]/route');
    const request = createParamsRequest('PUT', 'prov-1', { name: '李大華', level: 'L2' });
    const response = await PUT(request, { params: Promise.resolve({ id: 'prov-1' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('李大華');
    expect(json.data.level).toBe('L2');
  });
});

describe('DELETE /api/v1/providers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should soft-delete provider (admin only)', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mockPrisma.provider.findFirst.mockResolvedValue(mockProviderDetail);
    mockPrisma.provider.update.mockResolvedValue({ ...mockProviderDetail, deleted_at: new Date() });

    const { DELETE } = await import('../app/api/v1/providers/[id]/route');
    const request = createParamsRequest('DELETE', 'prov-1');
    const response = await DELETE(request, { params: Promise.resolve({ id: 'prov-1' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockPrisma.provider.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prov-1' },
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      }),
    );
  });

  it('should reject non-admin', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'cg-1', role: 'caregiver' });

    const { DELETE } = await import('../app/api/v1/providers/[id]/route');
    const request = createParamsRequest('DELETE', 'prov-1');
    const response = await DELETE(request, { params: Promise.resolve({ id: 'prov-1' }) });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error.code).toBe('AUTH_FORBIDDEN');
  });
});

describe('PUT /api/v1/providers/[id]/review', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should approve a pending provider', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mockPrisma.provider.findFirst.mockResolvedValue({
      id: 'prov-1', review_status: 'pending', deleted_at: null, admin_note: null,
    });
    mockPrisma.provider.update.mockResolvedValue({
      id: 'prov-1', review_status: 'approved', admin_note: '資料完整',
    });

    const { PUT } = await import('../app/api/v1/providers/[id]/review/route');
    const request = createParamsRequest('PUT', 'prov-1', {
      review_status: 'approved', admin_note: '資料完整',
    });
    const response = await PUT(request, { params: Promise.resolve({ id: 'prov-1' }) });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.review_status).toBe('approved');
  });

  it('should suspend a provider', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mockPrisma.provider.findFirst.mockResolvedValue({
      id: 'prov-1', review_status: 'approved', deleted_at: null, admin_note: null,
    });
    mockPrisma.provider.update.mockResolvedValue({
      id: 'prov-1', review_status: 'suspended', admin_note: '違規',
    });

    const { PUT } = await import('../app/api/v1/providers/[id]/review/route');
    const request = createParamsRequest('PUT', 'prov-1', {
      review_status: 'suspended', admin_note: '違規',
    });
    const response = await PUT(request, { params: Promise.resolve({ id: 'prov-1' }) });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.review_status).toBe('suspended');
  });

  it('should reject setting review_status to pending', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', role: 'admin' });

    const { PUT } = await import('../app/api/v1/providers/[id]/review/route');
    const request = createParamsRequest('PUT', 'prov-1', { review_status: 'pending' });
    const response = await PUT(request, { params: Promise.resolve({ id: 'prov-1' }) });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject non-admin', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'prov-user', role: 'provider' });

    const { PUT } = await import('../app/api/v1/providers/[id]/review/route');
    const request = createParamsRequest('PUT', 'prov-1', { review_status: 'approved' });
    const response = await PUT(request, { params: Promise.resolve({ id: 'prov-1' }) });
    expect(response.status).toBe(403);
  });
});

// --- Provider Self-Service /api/v1/provider/me ---

function createMeRequest(method: string, body?: unknown) {
  const url = new URL('http://localhost:3000/api/v1/provider/me');
  return new NextRequest(url, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' } } : {}),
  });
}

describe('GET /api/v1/provider/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return the authenticated provider profile', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue({
      id: 'prov-1', user_id: 'user-prov-1', name: '王小明', phone: '0912345678',
      email: 'wang@test.com', level: 'L1', specialties: ['居家照護'],
      certifications: ['照服員證照'], experience_years: 3, service_areas: ['台北市'],
      availability_status: 'available', review_status: 'approved',
      created_at: new Date(), updated_at: new Date(),
    });
    const { GET } = await import('../app/api/v1/provider/me/route');
    const response = await GET(createMeRequest('GET'));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.name).toBe('王小明');
  });

  it('should return 403 if user has no provider profile', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue(null);
    const { GET } = await import('../app/api/v1/provider/me/route');
    const response = await GET(createMeRequest('GET'));
    const json = await response.json();
    expect(response.status).toBe(403);
    expect(json.error.code).toBe('AUTH_FORBIDDEN');
  });

  it('should reject non-provider role', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'cg-1', role: 'caregiver' });
    const { GET } = await import('../app/api/v1/provider/me/route');
    const response = await GET(createMeRequest('GET'));
    expect(response.status).toBe(403);
  });
});

describe('PUT /api/v1/provider/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should update own availability_status', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue({ id: 'prov-1', deleted_at: null });
    mockPrisma.provider.update.mockResolvedValue({ id: 'prov-1', availability_status: 'busy' });
    const { PUT } = await import('../app/api/v1/provider/me/route');
    const response = await PUT(createMeRequest('PUT', { availability_status: 'busy' }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.availability_status).toBe('busy');
  });

  it('should strip fields not in ProviderSelfUpdateSchema', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue({ id: 'prov-1', deleted_at: null });
    mockPrisma.provider.update.mockResolvedValue({ id: 'prov-1' });
    const { PUT } = await import('../app/api/v1/provider/me/route');
    const response = await PUT(createMeRequest('PUT', { level: 'L3', availability_status: 'busy' }));
    expect(response.status).toBe(200);
    // level should NOT be passed to prisma update
    expect(mockPrisma.provider.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ level: 'L3' }),
      }),
    );
  });
});
