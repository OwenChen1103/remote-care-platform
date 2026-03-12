import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    recipient: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    measurementReminder: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/csrf', () => ({
  checkOrigin: () => true,
}));

import { GET as listHandler, POST as createHandler } from '../app/api/v1/recipients/route';
import { GET as getByIdHandler, PUT as updateHandler } from '../app/api/v1/recipients/[id]/route';
import { signJwt } from '../lib/auth';

function createRequest(
  method: string,
  body?: unknown,
  headers?: Record<string, string>,
  url = 'http://localhost:3000/api/v1/recipients',
): NextRequest {
  const options: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  return new NextRequest(url, options);
}

const caregiverToken = () => signJwt({ userId: 'user-aaa', role: 'caregiver' });
const patientToken = () => signJwt({ userId: 'patient-111', role: 'patient' });
const adminToken = () => signJwt({ userId: 'admin-bbb', role: 'admin' });
const otherCaregiverToken = () => signJwt({ userId: 'user-ccc', role: 'caregiver' });

const mockRecipient = {
  id: 'rec-111',
  caregiver_id: 'user-aaa',
  patient_user_id: 'patient-111',
  name: '王奶奶',
  date_of_birth: new Date('1945-03-15'),
  gender: 'female',
  medical_tags: ['高血壓', '糖尿病'],
  emergency_contact_name: '王小明',
  emergency_contact_phone: '0912345678',
  notes: '行動不便',
  deleted_at: null,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
};

const validCreateData = {
  name: '王奶奶',
  gender: 'female',
  medical_tags: ['高血壓'],
  emergency_contact_name: '王小明',
  emergency_contact_phone: '0912345678',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST /api/v1/recipients ────────────────────────────────

describe('POST /api/v1/recipients', () => {
  it('should create a recipient and return 201', async () => {
    mockPrisma.recipient.count.mockResolvedValue(0);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma));
    mockPrisma.recipient.create.mockResolvedValue(mockRecipient);
    mockPrisma.measurementReminder.createMany.mockResolvedValue({ count: 2 });

    const request = createRequest('POST', validCreateData, {
      Authorization: `Bearer ${caregiverToken()}`,
    });
    const response = await createHandler(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('王奶奶');
    expect(body.data.caregiver_id).toBe('user-aaa');
  });

  it('should return VALIDATION_ERROR for invalid data', async () => {
    const request = createRequest('POST', { name: '' }, {
      Authorization: `Bearer ${caregiverToken()}`,
    });
    const response = await createHandler(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return RECIPIENT_LIMIT_EXCEEDED when at limit', async () => {
    mockPrisma.recipient.count.mockResolvedValue(10);

    const request = createRequest('POST', validCreateData, {
      Authorization: `Bearer ${caregiverToken()}`,
    });
    const response = await createHandler(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('RECIPIENT_LIMIT_EXCEEDED');
  });

  it('should return AUTH_REQUIRED without token', async () => {
    const request = createRequest('POST', validCreateData);
    const response = await createHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });
});

// ─── GET /api/v1/recipients ─────────────────────────────────

describe('GET /api/v1/recipients', () => {
  it('should return only own recipients for caregiver', async () => {
    mockPrisma.recipient.findMany.mockResolvedValue([mockRecipient]);
    mockPrisma.recipient.count.mockResolvedValue(1);

    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    });
    const response = await listHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].caregiver_id).toBe('user-aaa');

    // Verify Prisma was called with caregiver_id filter
    expect(mockPrisma.recipient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ caregiver_id: 'user-aaa' }),
      }),
    );
  });

  it('should return all recipients for admin', async () => {
    mockPrisma.recipient.findMany.mockResolvedValue([mockRecipient]);
    mockPrisma.recipient.count.mockResolvedValue(1);

    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${adminToken()}`,
    });
    const response = await listHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    // Admin query should NOT have caregiver_id filter
    expect(mockPrisma.recipient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ caregiver_id: expect.anything() }),
      }),
    );
  });

  it('should return only linked recipient for patient', async () => {
    mockPrisma.recipient.findMany.mockResolvedValue([mockRecipient]);
    mockPrisma.recipient.count.mockResolvedValue(1);

    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${patientToken()}`,
    });
    const response = await listHandler(request);

    expect(response.status).toBe(200);
    expect(mockPrisma.recipient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patient_user_id: 'patient-111' }),
      }),
    );
  });
});

// ─── GET /api/v1/recipients/:id ─────────────────────────────

describe('GET /api/v1/recipients/:id', () => {
  const params = Promise.resolve({ id: 'rec-111' });

  it('should return recipient for owner', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);

    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, 'http://localhost:3000/api/v1/recipients/rec-111');
    const response = await getByIdHandler(request, { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('rec-111');
  });

  it('should return recipient for linked patient', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);

    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${patientToken()}`,
    }, 'http://localhost:3000/api/v1/recipients/rec-111');
    const response = await getByIdHandler(request, { params });

    expect(response.status).toBe(200);
  });

  it('should return RESOURCE_OWNERSHIP_DENIED for non-owner', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);

    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${otherCaregiverToken()}`,
    }, 'http://localhost:3000/api/v1/recipients/rec-111');
    const response = await getByIdHandler(request, { params });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('RESOURCE_OWNERSHIP_DENIED');
  });

  it('should return RESOURCE_NOT_FOUND for non-existent recipient', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(null);

    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, 'http://localhost:3000/api/v1/recipients/rec-999');
    const response = await getByIdHandler(request, { params: Promise.resolve({ id: 'rec-999' }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
  });
});

// ─── PUT /api/v1/recipients/:id ─────────────────────────────

describe('PUT /api/v1/recipients/:id', () => {
  const params = Promise.resolve({ id: 'rec-111' });

  it('should update recipient for owner', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    const updatedRecipient = { ...mockRecipient, name: '王奶奶（已更新）' };
    mockPrisma.recipient.update.mockResolvedValue(updatedRecipient);

    const request = createRequest('PUT', { name: '王奶奶（已更新）' }, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, 'http://localhost:3000/api/v1/recipients/rec-111');
    const response = await updateHandler(request, { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('王奶奶（已更新）');
  });

  it('should return RESOURCE_OWNERSHIP_DENIED for non-owner', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);

    const request = createRequest('PUT', { name: 'hacked' }, {
      Authorization: `Bearer ${otherCaregiverToken()}`,
    }, 'http://localhost:3000/api/v1/recipients/rec-111');
    const response = await updateHandler(request, { params });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('RESOURCE_OWNERSHIP_DENIED');
  });
});
