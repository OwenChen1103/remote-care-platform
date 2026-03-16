import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    serviceCategory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/csrf', () => ({
  checkOrigin: () => true,
}));

import { GET as publicGet } from '../app/api/v1/service-categories/route';
import { GET as adminGet } from '../app/api/v1/admin/service-categories/route';
import { PUT as adminUpdate } from '../app/api/v1/admin/service-categories/[id]/route';
import { signJwt } from '../lib/auth';

function createRequest(
  method: string,
  body?: unknown,
  headers?: Record<string, string>,
  url = 'http://localhost:3000/api/v1/service-categories',
): NextRequest {
  const options: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) options.body = JSON.stringify(body);
  return new NextRequest(url, options);
}

const caregiverToken = () =>
  signJwt({ userId: '00000000-0000-4000-a000-000000000011', role: 'caregiver' });
const adminToken = () =>
  signJwt({ userId: '00000000-0000-4000-a000-000000000012', role: 'admin' });
const providerToken = () =>
  signJwt({ userId: '00000000-0000-4000-a000-000000000013', role: 'provider' });

const mockCategories = [
  {
    id: 'cat-001',
    code: 'escort_visit',
    name: '陪同就醫',
    description: '陪伴長輩就醫',
    is_active: true,
    sort_order: 1,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'cat-002',
    code: 'home_cleaning',
    name: '居家清潔',
    description: null,
    is_active: false,
    sort_order: 5,
    created_at: new Date(),
    updated_at: new Date(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/service-categories (public)', () => {
  it('returns only active categories sorted by sort_order', async () => {
    const active = mockCategories.filter((c) => c.is_active);
    mockPrisma.serviceCategory.findMany.mockResolvedValue(active);

    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    });
    const res = await publicGet(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].code).toBe('escort_visit');

    expect(mockPrisma.serviceCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
      }),
    );
  });

  it('rejects unauthenticated request', async () => {
    const req = createRequest('GET');
    const res = await publicGet(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('allows provider role to read categories', async () => {
    mockPrisma.serviceCategory.findMany.mockResolvedValue([]);

    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${providerToken()}`,
    });
    const res = await publicGet(req);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/admin/service-categories', () => {
  it('returns all categories (including inactive) for admin', async () => {
    mockPrisma.serviceCategory.findMany.mockResolvedValue(mockCategories);
    mockPrisma.serviceCategory.count.mockResolvedValue(2);

    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${adminToken()}`,
    }, 'http://localhost:3000/api/v1/admin/service-categories');
    const res = await adminGet(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(json.meta.total).toBe(2);
  });

  it('rejects non-admin role', async () => {
    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, 'http://localhost:3000/api/v1/admin/service-categories');
    const res = await adminGet(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
  });
});

describe('PUT /api/v1/admin/service-categories/:id', () => {
  const catId = 'cat-002';
  const params = Promise.resolve({ id: catId });

  it('admin can toggle is_active', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategories[1]);
    mockPrisma.serviceCategory.update.mockResolvedValue({
      ...mockCategories[1],
      is_active: true,
    });

    const req = createRequest('PUT', { is_active: true }, {
      Authorization: `Bearer ${adminToken()}`,
    }, `http://localhost:3000/api/v1/admin/service-categories/${catId}`);
    const res = await adminUpdate(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.is_active).toBe(true);
  });

  it('rejects non-admin', async () => {
    const req = createRequest('PUT', { is_active: false }, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, `http://localhost:3000/api/v1/admin/service-categories/${catId}`);
    const res = await adminUpdate(req, { params });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
  });

  it('returns 404 for non-existent category', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(null);

    const req = createRequest('PUT', { name: 'test' }, {
      Authorization: `Bearer ${adminToken()}`,
    }, `http://localhost:3000/api/v1/admin/service-categories/${catId}`);
    const res = await adminUpdate(req, { params });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('rejects invalid update data', async () => {
    const req = createRequest('PUT', { sort_order: -1 }, {
      Authorization: `Bearer ${adminToken()}`,
    }, `http://localhost:3000/api/v1/admin/service-categories/${catId}`);
    const res = await adminUpdate(req, { params });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});
