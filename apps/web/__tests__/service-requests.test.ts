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
    provider: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/csrf', () => ({ checkOrigin: () => true }));

import { POST, GET } from '../app/api/v1/service-requests/route';
import { GET as getDetail } from '../app/api/v1/service-requests/[id]/route';
import { PUT as updateStatus } from '../app/api/v1/service-requests/[id]/status/route';
import { PUT as cancelRequest } from '../app/api/v1/service-requests/[id]/cancel/route';
import { PUT as proposeCandidate } from '../app/api/v1/service-requests/[id]/propose-candidate/route';
import { PUT as confirmCaregiver } from '../app/api/v1/service-requests/[id]/confirm-caregiver/route';
import { PUT as confirmProvider } from '../app/api/v1/service-requests/[id]/confirm-provider/route';
import { GET as getProviders } from '../app/api/v1/providers/route';
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

  it('admin can transition candidate_proposed → screening (return)', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'candidate_proposed',
      candidate_provider_id: IDS.providerId,
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
    });

    const req = createRequest('PUT', { status: 'screening' }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/status`);
    const res = await updateStatus(req, { params });
    expect(res.status).toBe(200);
  });

  it('admin can transition caregiver_confirmed → screening (return)', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'caregiver_confirmed',
      candidate_provider_id: IDS.providerId,
      caregiver_confirmed_at: new Date(),
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
    });

    const req = createRequest('PUT', { status: 'screening' }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/status`);
    const res = await updateStatus(req, { params });
    expect(res.status).toBe(200);
  });

  it('rejects invalid transition candidate_proposed → arranged', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'candidate_proposed',
    });

    const req = createRequest('PUT', { status: 'arranged' }, {
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

// ─── PUT /service-requests/:id/propose-candidate ───

describe('PUT /api/v1/service-requests/:id/propose-candidate', () => {
  const params = Promise.resolve({ id: IDS.request });

  const mockProvider = {
    id: IDS.providerId,
    user_id: IDS.provider,
    name: '陳護理師',
    review_status: 'approved',
    availability_status: 'available',
    deleted_at: null,
  };

  it('admin proposes candidate successfully', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
    });
    mockPrisma.provider.findUnique.mockResolvedValue(mockProvider);
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'candidate_proposed',
      candidate_provider_id: IDS.providerId,
    });

    const req = createRequest('PUT', { provider_id: IDS.providerId }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/propose-candidate`);
    const res = await proposeCandidate(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('candidate_proposed');
  });

  it('rejects non-admin', async () => {
    const req = createRequest('PUT', { provider_id: IDS.providerId }, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/propose-candidate`);
    const res = await proposeCandidate(req, { params });
    expect(res.status).toBe(403);
  });

  it('rejects when not in screening status', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'submitted',
    });

    const req = createRequest('PUT', { provider_id: IDS.providerId }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/propose-candidate`);
    const res = await proposeCandidate(req, { params });
    expect(res.status).toBe(400);
  });

  it('rejects unapproved provider', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
    });
    mockPrisma.provider.findUnique.mockResolvedValue({
      ...mockProvider,
      review_status: 'pending',
    });

    const req = createRequest('PUT', { provider_id: IDS.providerId }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/propose-candidate`);
    const res = await proposeCandidate(req, { params });
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects non-existent provider', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
    });
    mockPrisma.provider.findUnique.mockResolvedValue(null);

    const req = createRequest('PUT', { provider_id: IDS.providerId }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/propose-candidate`);
    const res = await proposeCandidate(req, { params });
    expect(res.status).toBe(404);
  });
});

// ─── PUT /service-requests/:id/confirm-caregiver ───

describe('PUT /api/v1/service-requests/:id/confirm-caregiver', () => {
  const params = Promise.resolve({ id: IDS.request });

  it('caregiver confirms candidate successfully', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'candidate_proposed',
      candidate_provider_id: IDS.providerId,
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'caregiver_confirmed',
      caregiver_confirmed_at: new Date(),
    });

    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-caregiver`);
    const res = await confirmCaregiver(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('caregiver_confirmed');
  });

  it('caregiver rejects candidate → back to screening', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'candidate_proposed',
      candidate_provider_id: IDS.providerId,
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
      candidate_provider_id: null,
    });

    const req = createRequest('PUT', { confirm: false, note: '時間無法配合' }, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-caregiver`);
    const res = await confirmCaregiver(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('screening');
    expect(json.data.candidate_provider_id).toBeNull();
  });

  it('rejects non-caregiver', async () => {
    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-caregiver`);
    const res = await confirmCaregiver(req, { params });
    expect(res.status).toBe(403);
  });

  it('rejects other caregiver (ownership)', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'candidate_proposed',
      candidate_provider_id: IDS.providerId,
    });

    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.otherCaregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-caregiver`);
    const res = await confirmCaregiver(req, { params });
    expect(res.status).toBe(403);
  });

  it('rejects when not in candidate_proposed status', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
    });

    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-caregiver`);
    const res = await confirmCaregiver(req, { params });
    expect(res.status).toBe(400);
  });
});

// ─── PUT /service-requests/:id/confirm-provider ───

describe('PUT /api/v1/service-requests/:id/confirm-provider', () => {
  const params = Promise.resolve({ id: IDS.request });

  it('provider confirms → auto-arranged', async () => {
    mockPrisma.provider.findFirst.mockResolvedValue({ id: IDS.providerId });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'caregiver_confirmed',
      candidate_provider_id: IDS.providerId,
      caregiver_confirmed_at: new Date(),
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'arranged',
      candidate_provider_id: IDS.providerId,
      assigned_provider_id: IDS.providerId,
      caregiver_confirmed_at: new Date(),
      provider_confirmed_at: new Date(),
    });

    const req = createRequest('PUT', { confirm: true, provider_note: '可於當日上午到場' }, {
      Authorization: `Bearer ${token(IDS.provider, 'provider')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-provider`);
    const res = await confirmProvider(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('arranged');
    expect(json.data.assigned_provider_id).toBe(IDS.providerId);
  });

  it('provider rejects → back to screening', async () => {
    mockPrisma.provider.findFirst.mockResolvedValue({ id: IDS.providerId });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'caregiver_confirmed',
      candidate_provider_id: IDS.providerId,
      caregiver_confirmed_at: new Date(),
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
      candidate_provider_id: null,
      caregiver_confirmed_at: null,
      provider_confirmed_at: null,
    });

    const req = createRequest('PUT', { confirm: false }, {
      Authorization: `Bearer ${token(IDS.provider, 'provider')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-provider`);
    const res = await confirmProvider(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('screening');
  });

  it('rejects non-provider', async () => {
    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-provider`);
    const res = await confirmProvider(req, { params });
    expect(res.status).toBe(403);
  });

  it('rejects provider who is not the candidate', async () => {
    const otherProviderId = '00000000-0000-4000-a000-000000000042';
    mockPrisma.provider.findFirst.mockResolvedValue({ id: otherProviderId });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'caregiver_confirmed',
      candidate_provider_id: IDS.providerId,
    });

    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.provider, 'provider')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-provider`);
    const res = await confirmProvider(req, { params });
    expect(res.status).toBe(403);
  });

  it('rejects when status is not caregiver_confirmed', async () => {
    mockPrisma.provider.findFirst.mockResolvedValue({ id: IDS.providerId });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'candidate_proposed',
      candidate_provider_id: IDS.providerId,
    });

    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.provider, 'provider')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-provider`);
    const res = await confirmProvider(req, { params });
    expect(res.status).toBe(400);
  });

  it('rejects provider with no profile', async () => {
    mockPrisma.provider.findFirst.mockResolvedValue(null);

    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.provider, 'provider')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-provider`);
    const res = await confirmProvider(req, { params });
    expect(res.status).toBe(403);
  });
});

// ─── GET /providers ───

describe('GET /api/v1/providers', () => {
  it('admin can list providers', async () => {
    mockPrisma.provider.findMany.mockResolvedValue([]);
    mockPrisma.provider.count.mockResolvedValue(0);

    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, 'http://localhost:3000/api/v1/providers?review_status=approved&limit=50');
    const res = await getProviders(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
    expect(json.meta.total).toBe(0);
  });

  it('rejects non-admin', async () => {
    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, 'http://localhost:3000/api/v1/providers');
    const res = await getProviders(req);
    expect(res.status).toBe(403);
  });
});
