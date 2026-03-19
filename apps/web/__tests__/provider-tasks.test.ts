import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  provider: { findFirst: vi.fn() },
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

vi.mock('@/lib/csrf', () => ({ checkOrigin: vi.fn(() => true) }));

function createTaskRequest(method: string, path = '/api/v1/provider/tasks', body?: unknown) {
  const url = new URL(`http://localhost:3000${path}`);
  return new NextRequest(url, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' } } : {}),
  });
}

describe('GET /api/v1/provider/tasks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should list assigned tasks for the provider', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue({ id: 'prov-1' });
    mockPrisma.serviceRequest.findMany.mockResolvedValue([
      { id: 'sr-1', status: 'arranged', category: { id: 'c1', code: 'escort_visit', name: '陪同就醫' }, recipient: { id: 'r1', name: '李奶奶' } },
    ]);
    mockPrisma.serviceRequest.count.mockResolvedValue(1);

    const { GET } = await import('../app/api/v1/provider/tasks/route');
    const response = await GET(createTaskRequest('GET'));
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
  });

  it('should filter by status', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue({ id: 'prov-1' });
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.serviceRequest.count.mockResolvedValue(0);

    const { GET } = await import('../app/api/v1/provider/tasks/route');
    await GET(createTaskRequest('GET', '/api/v1/provider/tasks?status=in_service'));
    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ assigned_provider_id: 'prov-1', status: 'in_service' }) }),
    );
  });

  it('should default to task statuses when no filter', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue({ id: 'prov-1' });
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.serviceRequest.count.mockResolvedValue(0);

    const { GET } = await import('../app/api/v1/provider/tasks/route');
    await GET(createTaskRequest('GET'));
    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { in: ['arranged', 'in_service', 'completed'] } }) }),
    );
  });

  it('should reject non-provider role', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'cg-1', role: 'caregiver' });
    const { GET } = await import('../app/api/v1/provider/tasks/route');
    const response = await GET(createTaskRequest('GET'));
    expect(response.status).toBe(403);
  });
});

describe('GET /api/v1/provider/tasks/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return task detail for assigned provider', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue({ id: 'prov-1' });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr-1', status: 'arranged', assigned_provider_id: 'prov-1',
      category: { id: 'c1', code: 'escort_visit', name: '陪同就醫' },
      recipient: { id: 'r1', name: '李奶奶' },
    });

    const { GET } = await import('../app/api/v1/provider/tasks/[id]/route');
    const response = await GET(
      createTaskRequest('GET', '/api/v1/provider/tasks/sr-1'),
      { params: Promise.resolve({ id: 'sr-1' }) },
    );
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.id).toBe('sr-1');
  });

  it('should reject if not the assigned provider', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue({ id: 'prov-1' });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr-1', assigned_provider_id: 'prov-other',
    });

    const { GET } = await import('../app/api/v1/provider/tasks/[id]/route');
    const response = await GET(
      createTaskRequest('GET', '/api/v1/provider/tasks/sr-1'),
      { params: Promise.resolve({ id: 'sr-1' }) },
    );
    const json = await response.json();
    expect(response.status).toBe(403);
    expect(json.error.code).toBe('RESOURCE_OWNERSHIP_DENIED');
  });

  it('should return 404 for non-existent task', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue({ id: 'prov-1' });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);

    const { GET } = await import('../app/api/v1/provider/tasks/[id]/route');
    const response = await GET(
      createTaskRequest('GET', '/api/v1/provider/tasks/sr-999'),
      { params: Promise.resolve({ id: 'sr-999' }) },
    );
    expect(response.status).toBe(404);
  });
});

describe('PUT /api/v1/provider/tasks/[id]/progress', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should transition arranged → in_service', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue({ id: 'prov-1' });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr-1', status: 'arranged', assigned_provider_id: 'prov-1', provider_note: null,
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({
      id: 'sr-1', status: 'in_service', provider_note: '已抵達',
      category: { id: 'c1', code: 'escort_visit', name: '陪同就醫' },
      recipient: { id: 'r1', name: '李奶奶' },
    });

    const { PUT } = await import('../app/api/v1/provider/tasks/[id]/progress/route');
    const request = createTaskRequest('PUT', '/api/v1/provider/tasks/sr-1/progress', {
      status: 'in_service', provider_note: '已抵達',
    });
    const response = await PUT(request, { params: Promise.resolve({ id: 'sr-1' }) });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.status).toBe('in_service');
  });

  it('should transition in_service → completed', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue({ id: 'prov-1' });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr-1', status: 'in_service', assigned_provider_id: 'prov-1', provider_note: '已抵達',
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({
      id: 'sr-1', status: 'completed', provider_note: '服務完成',
      category: { id: 'c1', code: 'escort_visit', name: '陪同就醫' },
      recipient: { id: 'r1', name: '李奶奶' },
    });

    const { PUT } = await import('../app/api/v1/provider/tasks/[id]/progress/route');
    const request = createTaskRequest('PUT', '/api/v1/provider/tasks/sr-1/progress', {
      status: 'completed', provider_note: '服務完成',
    });
    const response = await PUT(request, { params: Promise.resolve({ id: 'sr-1' }) });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.status).toBe('completed');
  });

  it('should reject invalid transition (arranged → completed)', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue({ id: 'prov-1' });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr-1', status: 'arranged', assigned_provider_id: 'prov-1',
    });

    const { PUT } = await import('../app/api/v1/provider/tasks/[id]/progress/route');
    const request = createTaskRequest('PUT', '/api/v1/provider/tasks/sr-1/progress', { status: 'completed' });
    const response = await PUT(request, { params: Promise.resolve({ id: 'sr-1' }) });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('should reject if not the assigned provider', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue({ id: 'prov-1' });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr-1', status: 'arranged', assigned_provider_id: 'prov-other',
    });

    const { PUT } = await import('../app/api/v1/provider/tasks/[id]/progress/route');
    const request = createTaskRequest('PUT', '/api/v1/provider/tasks/sr-1/progress', { status: 'in_service' });
    const response = await PUT(request, { params: Promise.resolve({ id: 'sr-1' }) });
    const json = await response.json();
    expect(response.status).toBe(403);
    expect(json.error.code).toBe('RESOURCE_OWNERSHIP_DENIED');
  });

  it('should reject completed → in_service (backwards)', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-prov-1', role: 'provider' });
    mockPrisma.provider.findFirst.mockResolvedValue({ id: 'prov-1' });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr-1', status: 'completed', assigned_provider_id: 'prov-1',
    });

    const { PUT } = await import('../app/api/v1/provider/tasks/[id]/progress/route');
    const request = createTaskRequest('PUT', '/api/v1/provider/tasks/sr-1/progress', { status: 'in_service' });
    const response = await PUT(request, { params: Promise.resolve({ id: 'sr-1' }) });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error.code).toBe('INVALID_STATE_TRANSITION');
  });
});
