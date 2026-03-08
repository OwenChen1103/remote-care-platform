import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    recipient: {
      findFirst: vi.fn(),
    },
    measurement: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      create: vi.fn(),
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

import { POST as createHandler, GET as listHandler } from '../app/api/v1/measurements/route';
import { GET as statsHandler } from '../app/api/v1/measurements/stats/route';
import { GET as exportHandler } from '../app/api/v1/measurements/export/route';
import { signJwt } from '../lib/auth';

function createRequest(
  method: string,
  body?: unknown,
  headers?: Record<string, string>,
  url = 'http://localhost:3000/api/v1/measurements',
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

const caregiverToken = () => signJwt({ userId: '00000000-0000-4000-a000-000000000011', role: 'caregiver' });
const adminToken = () => signJwt({ userId: '00000000-0000-4000-a000-000000000012', role: 'admin' });
const otherCaregiverToken = () => signJwt({ userId: '00000000-0000-4000-a000-000000000013', role: 'caregiver' });

const mockRecipient = {
  id: '00000000-0000-4000-a000-000000000001',
  caregiver_id: '00000000-0000-4000-a000-000000000011',
  name: '王奶奶',
  deleted_at: null,
};

const mockBpMeasurement = {
  id: '00000000-0000-4000-a000-000000000101',
  recipient_id: '00000000-0000-4000-a000-000000000001',
  type: 'blood_pressure',
  systolic: 120,
  diastolic: 80,
  heart_rate: 72,
  glucose_value: null,
  glucose_timing: null,
  unit: 'mmHg',
  source: 'manual',
  device_id: null,
  is_abnormal: false,
  note: null,
  measured_at: new Date('2026-03-08T08:00:00Z'),
  created_at: new Date('2026-03-08T08:00:00Z'),
};

const mockAbnormalBpMeasurement = {
  ...mockBpMeasurement,
  id: '00000000-0000-4000-a000-000000000102',
  systolic: 145,
  diastolic: 92,
  is_abnormal: true,
};

const validBpData = {
  recipient_id: '00000000-0000-4000-a000-000000000001',
  type: 'blood_pressure',
  systolic: 120,
  diastolic: 80,
  heart_rate: 72,
  unit: 'mmHg',
  measured_at: '2026-03-08T08:00:00Z',
};

const validBgData = {
  recipient_id: '00000000-0000-4000-a000-000000000001',
  type: 'blood_glucose',
  glucose_value: 95,
  glucose_timing: 'fasting',
  unit: 'mg/dL',
  measured_at: '2026-03-08T08:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST /api/v1/measurements ────────────────────────────────

describe('POST /api/v1/measurements', () => {
  it('should create a BP measurement and return 201', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurement.create.mockResolvedValue(mockBpMeasurement);
    mockPrisma.measurement.findMany.mockResolvedValue([]);

    const request = createRequest('POST', validBpData, {
      Authorization: `Bearer ${caregiverToken()}`,
    });
    const response = await createHandler(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.type).toBe('blood_pressure');
    expect(body.data.systolic).toBe(120);
    expect(body.data.is_abnormal).toBe(false);
  });

  it('should create a BG measurement and return 201', async () => {
    const mockBgMeasurement = {
      ...mockBpMeasurement,
      id: '00000000-0000-4000-a000-000000000103',
      type: 'blood_glucose',
      systolic: null,
      diastolic: null,
      heart_rate: null,
      glucose_value: { valueOf: () => 95, toNumber: () => 95 },
      glucose_timing: 'fasting',
      unit: 'mg/dL',
      is_abnormal: false,
    };
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurement.create.mockResolvedValue(mockBgMeasurement);
    mockPrisma.measurement.findMany.mockResolvedValue([]);

    const request = createRequest('POST', validBgData, {
      Authorization: `Bearer ${caregiverToken()}`,
    });
    const response = await createHandler(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.type).toBe('blood_glucose');
    expect(body.data.glucose_value).toBe(95);
  });

  it('should mark abnormal BP (145/92) as is_abnormal=true', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurement.create.mockResolvedValue(mockAbnormalBpMeasurement);
    mockPrisma.measurement.findMany.mockResolvedValue([{ is_abnormal: true }]);
    mockPrisma.notification.findFirst.mockResolvedValue(null);
    mockPrisma.notification.create.mockResolvedValue({});

    const request = createRequest('POST', { ...validBpData, systolic: 145, diastolic: 92 }, {
      Authorization: `Bearer ${caregiverToken()}`,
    });
    const response = await createHandler(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.is_abnormal).toBe(true);
  });

  it('should return AUTH_REQUIRED without token', async () => {
    const request = createRequest('POST', validBpData);
    const response = await createHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });

  it('should return RESOURCE_OWNERSHIP_DENIED for non-owned recipient', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);

    const request = createRequest('POST', validBpData, {
      Authorization: `Bearer ${otherCaregiverToken()}`,
    });
    const response = await createHandler(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('RESOURCE_OWNERSHIP_DENIED');
  });

  it('should return VALIDATION_ERROR for systolic=500', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);

    const request = createRequest('POST', { ...validBpData, systolic: 500 }, {
      Authorization: `Bearer ${caregiverToken()}`,
    });
    const response = await createHandler(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should trigger abnormal notification on consecutive abnormal', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurement.create.mockResolvedValue(mockAbnormalBpMeasurement);
    // 3 recent measurements: 2 abnormal (including newly created one counted)
    mockPrisma.measurement.findMany.mockResolvedValue([
      { is_abnormal: true },
      { is_abnormal: true },
      { is_abnormal: false },
    ]);
    mockPrisma.notification.findFirst.mockResolvedValue(null);
    mockPrisma.notification.create.mockResolvedValue({});

    const request = createRequest('POST', { ...validBpData, systolic: 145, diastolic: 92 }, {
      Authorization: `Bearer ${caregiverToken()}`,
    });
    await createHandler(request);

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: '00000000-0000-4000-a000-000000000011',
          type: 'abnormal_alert',
        }),
      }),
    );
  });

  it('should NOT create duplicate notification within 24h', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurement.create.mockResolvedValue(mockAbnormalBpMeasurement);
    mockPrisma.measurement.findMany.mockResolvedValue([
      { is_abnormal: true },
      { is_abnormal: true },
      { is_abnormal: false },
    ]);
    // Recent notification exists
    mockPrisma.notification.findFirst.mockResolvedValue({ id: 'notif-existing' });

    const request = createRequest('POST', { ...validBpData, systolic: 145, diastolic: 92 }, {
      Authorization: `Bearer ${caregiverToken()}`,
    });
    await createHandler(request);

    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });
});

// ─── GET /api/v1/measurements ─────────────────────────────────

describe('GET /api/v1/measurements', () => {
  it('should return paginated measurements', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurement.findMany.mockResolvedValue([mockBpMeasurement]);
    mockPrisma.measurement.count.mockResolvedValue(1);

    const url = 'http://localhost:3000/api/v1/measurements?recipient_id=00000000-0000-4000-a000-000000000001&page=1&limit=10';
    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, url);
    const response = await listHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(1);
  });

  it('should filter by type', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurement.findMany.mockResolvedValue([mockBpMeasurement]);
    mockPrisma.measurement.count.mockResolvedValue(1);

    const url = 'http://localhost:3000/api/v1/measurements?recipient_id=00000000-0000-4000-a000-000000000001&type=blood_pressure';
    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, url);
    const response = await listHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].type).toBe('blood_pressure');
  });

  it('should return RESOURCE_OWNERSHIP_DENIED for non-owned recipient', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);

    const url = 'http://localhost:3000/api/v1/measurements?recipient_id=00000000-0000-4000-a000-000000000001';
    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${otherCaregiverToken()}`,
    }, url);
    const response = await listHandler(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('RESOURCE_OWNERSHIP_DENIED');
  });

  it('should allow admin to list any recipient measurements', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurement.findMany.mockResolvedValue([mockBpMeasurement]);
    mockPrisma.measurement.count.mockResolvedValue(1);

    const url = 'http://localhost:3000/api/v1/measurements?recipient_id=00000000-0000-4000-a000-000000000001';
    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${adminToken()}`,
    }, url);
    const response = await listHandler(request);

    expect(response.status).toBe(200);
  });
});

// ─── GET /api/v1/measurements/stats ───────────────────────────

describe('GET /api/v1/measurements/stats', () => {
  it('should return BP stats for 7d', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurement.findMany.mockResolvedValue([
      {
        systolic: 120, diastolic: 80, heart_rate: 72, glucose_value: null,
        is_abnormal: false, measured_at: new Date('2026-03-07T08:00:00Z'),
      },
      {
        systolic: 145, diastolic: 92, heart_rate: 80, glucose_value: null,
        is_abnormal: true, measured_at: new Date('2026-03-06T08:00:00Z'),
      },
    ]);

    const url = 'http://localhost:3000/api/v1/measurements/stats?recipient_id=00000000-0000-4000-a000-000000000001&type=blood_pressure&period=7d';
    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, url);
    const response = await statsHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.type).toBe('blood_pressure');
    expect(body.data.period).toBe('7d');
    expect(body.data.count).toBe(2);
    expect(body.data.systolic.min).toBe(120);
    expect(body.data.systolic.max).toBe(145);
    expect(body.data.abnormal_count).toBe(1);
    expect(body.data.daily_data).toBeDefined();
  });

  it('should return BG stats for 30d', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurement.findMany.mockResolvedValue([
      {
        systolic: null, diastolic: null, heart_rate: null,
        glucose_value: { valueOf: () => 95, toNumber: () => 95 },
        is_abnormal: false, measured_at: new Date('2026-03-07T08:00:00Z'),
      },
    ]);

    const url = 'http://localhost:3000/api/v1/measurements/stats?recipient_id=00000000-0000-4000-a000-000000000001&type=blood_glucose&period=30d';
    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, url);
    const response = await statsHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.type).toBe('blood_glucose');
    expect(body.data.glucose_value.min).toBe(95);
    expect(body.data.glucose_value.max).toBe(95);
    expect(body.data.glucose_value.avg).toBe(95);
  });
});

// ─── GET /api/v1/measurements/export ──────────────────────────

describe('GET /api/v1/measurements/export', () => {
  it('should return plain text summary', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurement.findMany.mockResolvedValue([
      {
        systolic: 120, diastolic: 80, heart_rate: 72, glucose_value: null,
        is_abnormal: false, measured_at: new Date('2026-03-07T08:00:00Z'),
      },
      {
        systolic: 145, diastolic: 92, heart_rate: 80, glucose_value: null,
        is_abnormal: true, measured_at: new Date('2026-03-06T08:00:00Z'),
      },
    ]);

    const url = 'http://localhost:3000/api/v1/measurements/export?recipient_id=00000000-0000-4000-a000-000000000001&type=blood_pressure&from=2026-03-01T00:00:00Z&to=2026-03-08T23:59:59Z';
    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, url);
    const response = await exportHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.text).toContain('王奶奶');
    expect(body.data.text).toContain('血壓');
    expect(body.data.text).toContain('2 筆');
    expect(body.data.text).toContain('異常紀錄');
  });

  it('should return RESOURCE_OWNERSHIP_DENIED for non-owner', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);

    const url = 'http://localhost:3000/api/v1/measurements/export?recipient_id=00000000-0000-4000-a000-000000000001&type=blood_pressure&from=2026-03-01T00:00:00Z&to=2026-03-08T23:59:59Z';
    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${otherCaregiverToken()}`,
    }, url);
    const response = await exportHandler(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('RESOURCE_OWNERSHIP_DENIED');
  });
});
