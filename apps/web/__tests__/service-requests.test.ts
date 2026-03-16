import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    recipient: { findFirst: vi.fn() },
    serviceCategory: { findUnique: vi.fn() },
    serviceRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    provider: { findFirst: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/csrf', () => ({ checkOrigin: () => true }));

import { POST, GET } from '../app/api/v1/service-requests/route';
import { GET as getDetail } from '../app/api/v1/service-requests/[id]/route';
import { PUT as updateStatus } from '../app/api/v1/service-requests/[id]/status/route';
import { PUT as cancelRequest } from '../app/api/v1/service-requests/[id]/cancel/route';
import { signJwt } from '../lib/auth';

function createRequest(
  method: string,
  body?: unknown,
  headers?: Record<string, string>,
  url = 'http://localhost:3000/api/v1/service-requests',
): NextRequest {
  const options: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) options.body = JSON.stringify(body);
  return new NextRequest(url, options);
}

const IDS = {
  caregiver: '00000000-0000-4000-a000-000000000011',
  admin: '00000000-0000-4000-a000-000000000012',
  provider: '00000000-0000-4000-a000-000000000013',
  patient: '00000000-0000-4000-a000-000000000014',
  otherCaregiver: '00000000-0000-4000-a000-000000000015',
  recipient: '00000000-0000-4000-a000-000000000001',
  category: '00000000-0000-4000-a000-000000000021',
  request: '00000000-0000-4000-a000-000000000031',
  providerId: '00000000-0000-4000-a000-000000000041',
};

const token = (userId: string, role: string) => signJwt({ userId, role: role as 'caregiver' | 'admin' | 'provider' | 'patient' });

const mockRecipient = {
  id: IDS.recipient,
  caregiver_id: IDS.caregiver,
  patient_user_id: IDS.patient,
  name: '王奶奶',
  deleted_at: null,
};

const mockCategory = {
  id: IDS.category,
  code: 'escort_visit',
  name: '陪同就醫',
  is_active: true,
};

const mockServiceRequest = {
  id: IDS.request,
  caregiver_id: IDS.caregiver,
  recipient_id: IDS.recipient,
  category_id: IDS.category,
  status: 'submitted',
  preferred_date: new Date('2026-04-01'),
  preferred_time_slot: 'morning',
  location: '台北市信義區',
  description: '陪同就醫回診',
  candidate_provider_id: null,
  assigned_provider_id: null,
  admin_note: null,
  provider_note: null,
  created_at: new Date(),
  updated_at: new Date(),
  category: { id: IDS.category, code: 'escort_visit', name: '陪同就醫' },
  recipient: { id: IDS.recipient, name: '王奶奶' },
  assigned_provider: null,
  candidate_provider: null,
};

const validCreateBody = {
  recipient_id: IDS.recipient,
  category_id: IDS.category,
  preferred_date: '2026-04-01T00:00:00.000Z',
  preferred_time_slot: 'morning',
  location: '台北市信義區',
  description: '陪同就醫回診',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST /service-requests ───

describe('POST /api/v1/service-requests', () => {
  it('caregiver creates request successfully', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.serviceRequest.create.mockResolvedValue(mockServiceRequest);

    const req = createRequest('POST', validCreateBody, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('submitted');
  });

  it('rejects non-caregiver', async () => {
    const req = createRequest('POST', validCreateBody, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('rejects invalid body', async () => {
    const req = createRequest('POST', { recipient_id: 'not-uuid' }, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects ownership violation', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);

    const req = createRequest('POST', validCreateBody, {
      Authorization: `Bearer ${token(IDS.otherCaregiver, 'caregiver')}`,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('rejects inactive category', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.serviceCategory.findUnique.mockResolvedValue({ ...mockCategory, is_active: false });

    const req = createRequest('POST', validCreateBody, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── GET /service-requests ───

describe('GET /api/v1/service-requests', () => {
  it('caregiver sees own requests', async () => {
    mockPrisma.serviceRequest.findMany.mockResolvedValue([mockServiceRequest]);
    mockPrisma.serviceRequest.count.mockResolvedValue(1);

    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, 'http://localhost:3000/api/v1/service-requests?page=1&limit=20');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);

    // Verify caregiver_id filter was applied
    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ caregiver_id: IDS.caregiver }),
      }),
    );
  });

  it('provider sees assigned requests (or empty if no provider profile)', async () => {
    mockPrisma.provider.findFirst.mockResolvedValue(null);

    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${token(IDS.provider, 'provider')}`,
    }, 'http://localhost:3000/api/v1/service-requests?page=1&limit=20');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
    expect(json.meta.total).toBe(0);
  });

  it('provider with profile filters by assigned_provider_id', async () => {
    mockPrisma.provider.findFirst.mockResolvedValue({ id: IDS.providerId });
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.serviceRequest.count.mockResolvedValue(0);

    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${token(IDS.provider, 'provider')}`,
    }, 'http://localhost:3000/api/v1/service-requests?page=1&limit=20');
    const providerRes = await GET(req);
    expect(providerRes.status).toBe(200);

    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assigned_provider_id: IDS.providerId }),
      }),
    );
  });

  it('patient sees recipient-bound requests', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue({ id: IDS.recipient });
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.serviceRequest.count.mockResolvedValue(0);

    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${token(IDS.patient, 'patient')}`,
    }, 'http://localhost:3000/api/v1/service-requests?page=1&limit=20');
    const patientRes = await GET(req);
    expect(patientRes.status).toBe(200);

    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recipient_id: IDS.recipient }),
      }),
    );
  });

  it('admin sees all requests', async () => {
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.serviceRequest.count.mockResolvedValue(0);

    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, 'http://localhost:3000/api/v1/service-requests?page=1&limit=20');
    const adminRes = await GET(req);
    expect(adminRes.status).toBe(200);

    // Admin should not have caregiver_id/recipient_id/assigned_provider_id in where
    const callArgs = mockPrisma.serviceRequest.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(callArgs.where).not.toHaveProperty('caregiver_id');
    expect(callArgs.where).not.toHaveProperty('recipient_id');
    expect(callArgs.where).not.toHaveProperty('assigned_provider_id');
  });

  it('supports status filter', async () => {
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.serviceRequest.count.mockResolvedValue(0);

    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, 'http://localhost:3000/api/v1/service-requests?status=screening&page=1&limit=20');
    const filterRes = await GET(req);
    expect(filterRes.status).toBe(200);

    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'screening' }),
      }),
    );
  });
});

// ─── GET /service-requests/:id ───

describe('GET /api/v1/service-requests/:id', () => {
  const params = Promise.resolve({ id: IDS.request });

  it('caregiver can view own request', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(mockServiceRequest);

    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}`);
    const res = await getDetail(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe(IDS.request);
  });

  it('rejects other caregiver (ownership)', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(mockServiceRequest);

    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${token(IDS.otherCaregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}`);
    const res = await getDetail(req, { params });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent request', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);

    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}`);
    const res = await getDetail(req, { params });

    expect(res.status).toBe(404);
  });
});

// ─── PUT /service-requests/:id/status ───

describe('PUT /api/v1/service-requests/:id/status', () => {
  const params = Promise.resolve({ id: IDS.request });

  it('admin can transition submitted → screening', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(mockServiceRequest);
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
    });

    const req = createRequest('PUT', { status: 'screening' }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/status`);
    const res = await updateStatus(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('screening');
  });

  it('admin can transition screening → submitted (return)', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'submitted',
    });

    const req = createRequest('PUT', { status: 'submitted' }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/status`);
    const res = await updateStatus(req, { params });

    expect(res.status).toBe(200);
  });

  it('rejects non-admin', async () => {
    const req = createRequest('PUT', { status: 'screening' }, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/status`);
    const res = await updateStatus(req, { params });

    expect(res.status).toBe(403);
  });

  it('rejects invalid transition (submitted → completed)', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(mockServiceRequest);

    const req = createRequest('PUT', { status: 'completed' }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/status`);
    const res = await updateStatus(req, { params });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('rejects transition from cancelled', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'cancelled',
    });

    const req = createRequest('PUT', { status: 'screening' }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/status`);
    const res = await updateStatus(req, { params });

    expect(res.status).toBe(400);
  });
});

// ─── PUT /service-requests/:id/cancel ───

describe('PUT /api/v1/service-requests/:id/cancel', () => {
  const params = Promise.resolve({ id: IDS.request });

  it('caregiver can cancel own submitted request', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(mockServiceRequest);
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'cancelled',
    });

    const req = createRequest('PUT', {}, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/cancel`);
    const res = await cancelRequest(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('cancelled');
  });

  it('admin can cancel any request', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'cancelled',
    });

    const req = createRequest('PUT', { reason: '行政取消' }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/cancel`);
    const res = await cancelRequest(req, { params });

    expect(res.status).toBe(200);
  });

  it('rejects cancel on completed request', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'completed',
    });

    const req = createRequest('PUT', {}, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/cancel`);
    const res = await cancelRequest(req, { params });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('rejects cancel on already cancelled request', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'cancelled',
    });

    const req = createRequest('PUT', {}, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/cancel`);
    const res = await cancelRequest(req, { params });

    expect(res.status).toBe(400);
  });

  it('rejects other caregiver cancelling (ownership)', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(mockServiceRequest);

    const req = createRequest('PUT', {}, {
      Authorization: `Bearer ${token(IDS.otherCaregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/cancel`);
    const res = await cancelRequest(req, { params });

    expect(res.status).toBe(403);
  });

  it('rejects provider from cancelling', async () => {
    const req = createRequest('PUT', {}, {
      Authorization: `Bearer ${token(IDS.provider, 'provider')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/cancel`);
    const res = await cancelRequest(req, { params });

    expect(res.status).toBe(403);
  });
});
