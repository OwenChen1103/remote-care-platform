import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.OPENAI_API_KEY = 'sk-test';
process.env.AI_DEBUG_LOGGING = 'true';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      // Required by verifyAuth's suspended_at check.
      findUnique: vi.fn(),
    },
    recipient: {
      findFirst: vi.fn(),
    },
    measurement: {
      findMany: vi.fn(),
    },
    aiReport: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
  return { mockPrisma };
});

const { mockGenerateReport, mockGenerateChat } = vi.hoisted(() => ({
  mockGenerateReport: vi.fn(),
  mockGenerateChat: vi.fn(),
}));

const { mockCheckReportRateLimit, mockCheckChatRateLimit } = vi.hoisted(() => ({
  mockCheckReportRateLimit: vi.fn(),
  mockCheckChatRateLimit: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/csrf', () => ({
  checkOrigin: () => true,
}));

vi.mock('@/lib/ai', () => ({
  generateReport: mockGenerateReport,
  generateChat: mockGenerateChat,
  buildPromptContext: () => ({
    recipient: { name: '王奶奶', age: 80, medical_tags: ['高血壓'] },
    measurements: [],
  }),
}));

vi.mock('@/lib/ai-rate-limit', () => ({
  checkReportRateLimit: mockCheckReportRateLimit,
  checkChatRateLimit: mockCheckChatRateLimit,
}));

import { POST as healthReportHandler } from '../app/api/v1/ai/health-report/route';
import { GET as reportsListHandler } from '../app/api/v1/ai/reports/route';
import { POST as chatHandler } from '../app/api/v1/ai/chat/route';
import { signJwt } from '../lib/auth';

function createRequest(
  method: string,
  body?: unknown,
  headers?: Record<string, string>,
  url = 'http://localhost:3000/api/v1/ai/health-report',
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

const caregiverToken = () =>
  signJwt({ userId: '00000000-0000-4000-a000-000000000011', role: 'caregiver' });
const adminToken = () =>
  signJwt({ userId: '00000000-0000-4000-a000-000000000012', role: 'admin' });
const otherCaregiverToken = () =>
  signJwt({ userId: '00000000-0000-4000-a000-000000000013', role: 'caregiver' });

const mockRecipient = {
  id: '00000000-0000-4000-a000-000000000001',
  caregiver_id: '00000000-0000-4000-a000-000000000011',
  name: '王奶奶',
  date_of_birth: new Date('1945-01-01'),
  medical_tags: ['高血壓'],
  deleted_at: null,
};

const mockReportResult = {
  output: {
    status_label: 'stable',
    summary: '整體健康狀況穩定',
    reasons: ['血壓正常'],
    suggestions: ['持續定時量測'],
  },
  raw_prompt: 'test prompt',
  raw_response: '{"status_label":"stable"}',
  model: 'gpt-4o-mini',
  input_tokens: 100,
  output_tokens: 50,
  is_fallback: false,
};

const mockSavedReport = {
  id: '00000000-0000-4000-a000-000000000201',
  recipient_id: '00000000-0000-4000-a000-000000000001',
  report_type: 'health_summary',
  status_label: 'stable',
  summary: '整體健康狀況穩定',
  reasons: ['血壓正常'],
  suggestions: ['持續定時量測'],
  model: 'gpt-4o-mini',
  input_tokens: 100,
  output_tokens: 50,
  generated_at: new Date('2026-03-08T10:00:00Z'),
  created_at: new Date('2026-03-08T10:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  // verifyAuth DB lookup default — active user.
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'any', suspended_at: null });
  mockCheckReportRateLimit.mockResolvedValue({ allowed: true, remaining: 2, reset: 0 });
  mockCheckChatRateLimit.mockResolvedValue({ allowed: true, remaining: 9, reset: 0 });
});

// ─── POST /ai/health-report ────────────────────────────────────

describe('POST /ai/health-report', () => {
  it('should generate report successfully', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurement.findMany.mockResolvedValue([]);
    mockGenerateReport.mockResolvedValue(mockReportResult);
    mockPrisma.aiReport.create.mockResolvedValue(mockSavedReport);

    const req = createRequest(
      'POST',
      { recipient_id: mockRecipient.id, report_type: 'health_summary' },
      { Authorization: `Bearer ${caregiverToken()}` },
    );

    const res = await healthReportHandler(req);
    const json = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);

    const data = json.data as Record<string, unknown>;
    expect(data.status_label).toBe('stable');
    expect(data.disclaimer).toBeDefined();
    expect(typeof data.disclaimer).toBe('string');
    expect((data.disclaimer as string).length).toBeGreaterThan(0);
  });

  it('should require authentication', async () => {
    const req = createRequest('POST', {
      recipient_id: mockRecipient.id,
      report_type: 'health_summary',
    });

    const res = await healthReportHandler(req);
    const json = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('should check recipient ownership', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);

    const req = createRequest(
      'POST',
      { recipient_id: mockRecipient.id, report_type: 'health_summary' },
      { Authorization: `Bearer ${otherCaregiverToken()}` },
    );

    const res = await healthReportHandler(req);
    const json = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(403);
    expect((json.error as Record<string, unknown>).code).toBe('RESOURCE_OWNERSHIP_DENIED');
  });

  it('should reject invalid report_type', async () => {
    const req = createRequest(
      'POST',
      { recipient_id: mockRecipient.id, report_type: 'invalid' },
      { Authorization: `Bearer ${caregiverToken()}` },
    );

    const res = await healthReportHandler(req);
    expect(res.status).toBe(400);
  });

  it('should enforce rate limit', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockCheckReportRateLimit.mockResolvedValue({ allowed: false, remaining: 0, reset: 3600 });

    const req = createRequest(
      'POST',
      { recipient_id: mockRecipient.id, report_type: 'health_summary' },
      { Authorization: `Bearer ${caregiverToken()}` },
    );

    const res = await healthReportHandler(req);
    const json = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(429);
    expect((json.error as Record<string, unknown>).code).toBe('AI_RATE_LIMITED');
  });

  it('should persist fallback report on AI failure', async () => {
    const fallbackResult = {
      ...mockReportResult,
      output: {
        status_label: 'attention',
        summary: '暫時無法生成報告',
        reasons: ['AI 服務暫時不可用'],
        suggestions: ['請稍後再試'],
      },
      is_fallback: true,
    };

    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurement.findMany.mockResolvedValue([]);
    mockGenerateReport.mockResolvedValue(fallbackResult);
    mockPrisma.aiReport.create.mockResolvedValue({
      ...mockSavedReport,
      status_label: 'attention',
      summary: '暫時無法生成報告',
    });

    const req = createRequest(
      'POST',
      { recipient_id: mockRecipient.id, report_type: 'health_summary' },
      { Authorization: `Bearer ${caregiverToken()}` },
    );

    const res = await healthReportHandler(req);
    const json = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(201);
    const data = json.data as Record<string, unknown>;
    expect(data.is_fallback).toBe(true);
    expect(mockPrisma.aiReport.create).toHaveBeenCalledTimes(1);
  });

  it('should reject admin role', async () => {
    const req = createRequest(
      'POST',
      { recipient_id: mockRecipient.id, report_type: 'health_summary' },
      { Authorization: `Bearer ${adminToken()}` },
    );

    const res = await healthReportHandler(req);
    expect(res.status).toBe(403);
  });
});

// ─── GET /ai/reports ────────────────────────────────────────────

describe('GET /ai/reports', () => {
  it('should list reports with pagination', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.aiReport.findMany.mockResolvedValue([mockSavedReport]);
    mockPrisma.aiReport.count.mockResolvedValue(1);

    const url = `http://localhost:3000/api/v1/ai/reports?recipient_id=${mockRecipient.id}`;
    const req = createRequest('GET', undefined, { Authorization: `Bearer ${caregiverToken()}` }, url);

    const res = await reportsListHandler(req);
    const json = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect((json.data as unknown[]).length).toBe(1);

    const meta = json.meta as Record<string, unknown>;
    expect(meta.total).toBe(1);

    const first = (json.data as Record<string, unknown>[])[0]!;
    expect(first.disclaimer).toBeDefined();
  });

  it('should require authentication', async () => {
    const url = `http://localhost:3000/api/v1/ai/reports?recipient_id=${mockRecipient.id}`;
    const req = createRequest('GET', undefined, {}, url);

    const res = await reportsListHandler(req);
    expect(res.status).toBe(401);
  });

  it('should check ownership for caregiver', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);

    const url = `http://localhost:3000/api/v1/ai/reports?recipient_id=${mockRecipient.id}`;
    const req = createRequest(
      'GET',
      undefined,
      { Authorization: `Bearer ${otherCaregiverToken()}` },
      url,
    );

    const res = await reportsListHandler(req);
    expect(res.status).toBe(403);
  });

  it('should allow admin to view any reports', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.aiReport.findMany.mockResolvedValue([]);
    mockPrisma.aiReport.count.mockResolvedValue(0);

    const url = `http://localhost:3000/api/v1/ai/reports?recipient_id=${mockRecipient.id}`;
    const req = createRequest('GET', undefined, { Authorization: `Bearer ${adminToken()}` }, url);

    const res = await reportsListHandler(req);
    expect(res.status).toBe(200);
  });

  it('should return empty for non-existent recipient', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(null);

    const url = 'http://localhost:3000/api/v1/ai/reports?recipient_id=00000000-0000-4000-a000-999999999999';
    const req = createRequest('GET', undefined, { Authorization: `Bearer ${caregiverToken()}` }, url);

    const res = await reportsListHandler(req);
    expect(res.status).toBe(404);
  });
});

// ─── POST /ai/chat ──────────────────────────────────────────────

describe('POST /ai/chat', () => {
  it('should return chat result successfully', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurement.findMany.mockResolvedValue([]);
    mockGenerateChat.mockResolvedValue({
      output: { explanation: '近期趨勢穩定', key_points: ['血壓正常'] },
      raw_prompt: null,
      raw_response: null,
      model: 'gpt-4o-mini',
      input_tokens: 80,
      output_tokens: 40,
      is_fallback: false,
    });

    const req = createRequest(
      'POST',
      { recipient_id: mockRecipient.id, task: 'trend_explanation' },
      { Authorization: `Bearer ${caregiverToken()}` },
      'http://localhost:3000/api/v1/ai/chat',
    );

    const res = await chatHandler(req);
    const json = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    const data = json.data as Record<string, unknown>;
    expect(data.task).toBe('trend_explanation');
    expect(data.disclaimer).toBeDefined();
    expect(data.is_fallback).toBe(false);
  });

  it('should enforce chat rate limit', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockCheckChatRateLimit.mockResolvedValue({ allowed: false, remaining: 0, reset: 3600 });

    const req = createRequest(
      'POST',
      { recipient_id: mockRecipient.id, task: 'trend_explanation' },
      { Authorization: `Bearer ${caregiverToken()}` },
      'http://localhost:3000/api/v1/ai/chat',
    );

    const res = await chatHandler(req);
    const json = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(429);
    expect((json.error as Record<string, unknown>).code).toBe('AI_RATE_LIMITED');
  });

  it('should require authentication', async () => {
    const req = createRequest(
      'POST',
      { recipient_id: mockRecipient.id, task: 'trend_explanation' },
      {},
      'http://localhost:3000/api/v1/ai/chat',
    );

    const res = await chatHandler(req);
    expect(res.status).toBe(401);
  });

  it('should check ownership', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);

    const req = createRequest(
      'POST',
      { recipient_id: mockRecipient.id, task: 'family_update' },
      { Authorization: `Bearer ${otherCaregiverToken()}` },
      'http://localhost:3000/api/v1/ai/chat',
    );

    const res = await chatHandler(req);
    expect(res.status).toBe(403);
  });

  it('should reject invalid task', async () => {
    const req = createRequest(
      'POST',
      { recipient_id: mockRecipient.id, task: 'invalid_task' },
      { Authorization: `Bearer ${caregiverToken()}` },
      'http://localhost:3000/api/v1/ai/chat',
    );

    const res = await chatHandler(req);
    expect(res.status).toBe(400);
  });
});
