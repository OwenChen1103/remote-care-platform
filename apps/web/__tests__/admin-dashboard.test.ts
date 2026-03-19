import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  user: { count: vi.fn() },
  recipient: { count: vi.fn() },
  measurement: { count: vi.fn() },
  serviceRequest: { count: vi.fn(), findMany: vi.fn() },
  provider: { count: vi.fn() },
  notification: { count: vi.fn(), findMany: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

const mockVerifyAuth = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({
  verifyAuth: mockVerifyAuth,
  signJwt: vi.fn(() => 'mock-token'),
}));

function createRequest() {
  return new NextRequest(new URL('http://localhost:3000/api/v1/admin/dashboard'), {
    method: 'GET',
  });
}

describe('GET /api/v1/admin/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return dashboard stats for admin', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mockPrisma.user.count.mockResolvedValue(10);
    mockPrisma.recipient.count.mockResolvedValue(15);
    mockPrisma.measurement.count.mockResolvedValue(42);
    mockPrisma.serviceRequest.count.mockResolvedValue(3);
    mockPrisma.provider.count.mockResolvedValue(2);
    mockPrisma.notification.count.mockResolvedValue(5);
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.notification.findMany.mockResolvedValue([]);

    const { GET } = await import('../app/api/v1/admin/dashboard/route');
    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.stats).toEqual({
      total_caregivers: 10,
      total_recipients: 15,
      total_measurements_today: 42,
      pending_service_requests: 3,
      pending_provider_reviews: 2,
      abnormal_alerts_today: 5,
    });
    expect(json.data.recent_pending_requests).toEqual([]);
    expect(json.data.recent_abnormal_alerts).toEqual([]);
  });

  it('should return recent pending requests with category and recipient names', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.recipient.count.mockResolvedValue(0);
    mockPrisma.measurement.count.mockResolvedValue(0);
    mockPrisma.serviceRequest.count.mockResolvedValue(0);
    mockPrisma.provider.count.mockResolvedValue(0);
    mockPrisma.notification.count.mockResolvedValue(0);
    mockPrisma.notification.findMany.mockResolvedValue([]);

    const mockRequest = {
      id: 'req-1',
      preferred_date: new Date('2026-03-25T00:00:00Z'),
      created_at: new Date('2026-03-19T10:00:00Z'),
      category: { name: '陪診師' },
      recipient: { name: '王奶奶' },
    };
    mockPrisma.serviceRequest.findMany.mockResolvedValue([mockRequest]);

    const { GET } = await import('../app/api/v1/admin/dashboard/route');
    const response = await GET(createRequest());
    const json = await response.json();

    expect(json.data.recent_pending_requests).toHaveLength(1);
    expect(json.data.recent_pending_requests[0]).toEqual({
      id: 'req-1',
      category_name: '陪診師',
      recipient_name: '王奶奶',
      preferred_date: '2026-03-25T00:00:00.000Z',
      created_at: '2026-03-19T10:00:00.000Z',
    });
  });

  it('should reject non-admin users', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-1', role: 'caregiver' });

    const { GET } = await import('../app/api/v1/admin/dashboard/route');
    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error.code).toBe('AUTH_FORBIDDEN');
  });

  it('should reject unauthenticated requests', async () => {
    mockVerifyAuth.mockResolvedValue(null);

    const { GET } = await import('../app/api/v1/admin/dashboard/route');
    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.code).toBe('AUTH_REQUIRED');
  });
});
