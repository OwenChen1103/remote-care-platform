import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Set JWT_SECRET before any imports that use it
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';

const { mockPrisma, mockBcrypt } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    provider: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const mockBcrypt = {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
    compare: vi.fn(),
  };
  return { mockPrisma, mockBcrypt };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('bcryptjs', () => ({
  default: mockBcrypt,
}));

vi.mock('@/lib/csrf', () => ({
  checkOrigin: () => true,
}));
import { POST as registerHandler } from '../app/api/v1/auth/register/route';
import { POST as loginHandler } from '../app/api/v1/auth/login/route';
import { GET as meGetHandler, PUT as mePutHandler } from '../app/api/v1/auth/me/route';
import { signJwt } from '../lib/auth';

function createRequest(method: string, body?: unknown, headers?: Record<string, string>): NextRequest {
  const url = 'http://localhost:3000/api/v1/auth/test';
  const options: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  return new NextRequest(url, options);
}

const validRegisterData = {
  email: 'test@example.com',
  password: 'Test1234',
  name: '測試使用者',
  phone: '0912345678',
};

const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  password_hash: '$2a$12$hashedpassword',
  name: '測試使用者',
  phone: '0912345678',
  role: 'caregiver',
  timezone: 'Asia/Taipei',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Register ───────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('should register a new user and return 201 with user + token', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(mockUser);

    const request = createRequest('POST', validRegisterData);
    const response = await registerHandler(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('test@example.com');
    expect(body.data.user.role).toBe('caregiver');
    expect(body.data.token).toBeDefined();
    expect(body.data.user.password_hash).toBeUndefined();
  });

  it('should return DUPLICATE_ENTRY for existing email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const request = createRequest('POST', validRegisterData);
    const response = await registerHandler(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('DUPLICATE_ENTRY');
  });

  it('should return VALIDATION_ERROR for invalid data', async () => {
    const request = createRequest('POST', {
      email: 'not-an-email',
      password: 'short',
      name: '',
    });
    const response = await registerHandler(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.length).toBeGreaterThan(0);
  });
});

// ─── Register — Role Selection ──────────────────────────────

describe('POST /api/v1/auth/register — role selection', () => {
  it('should register as patient with role=patient', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ ...mockUser, role: 'patient' });

    const request = createRequest('POST', { ...validRegisterData, role: 'patient' });
    const response = await registerHandler(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.user.role).toBe('patient');
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'patient' }),
      }),
    );
  });

  it('should register as provider and auto-create pending provider profile', async () => {
    const providerUser = { ...mockUser, role: 'provider', name: '新服務人員' };

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        user: { create: vi.fn().mockResolvedValue(providerUser) },
        provider: { create: vi.fn().mockResolvedValue({ id: '660e8400-e29b-41d4-a716-446655440000' }) },
      });
    });

    const request = createRequest('POST', { ...validRegisterData, role: 'provider' });
    const response = await registerHandler(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.user.role).toBe('provider');
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('should reject role=admin', async () => {
    const request = createRequest('POST', { ...validRegisterData, role: 'admin' });
    const response = await registerHandler(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should default to caregiver when no role specified', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(mockUser);

    const request = createRequest('POST', validRegisterData);
    const response = await registerHandler(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.user.role).toBe('caregiver');
  });
});

// ─── Login ──────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('should login successfully and return 200 with user + token', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockBcrypt.compare.mockResolvedValue(true);

    const request = createRequest('POST', {
      email: 'test@example.com',
      password: 'Test1234',
    });
    const response = await loginHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('test@example.com');
    expect(body.data.token).toBeDefined();
  });

  it('should return AUTH_INVALID_CREDENTIALS for wrong password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockBcrypt.compare.mockResolvedValue(false);

    const request = createRequest('POST', {
      email: 'test@example.com',
      password: 'WrongPass1',
    });
    const response = await loginHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('should return AUTH_INVALID_CREDENTIALS for non-existent user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = createRequest('POST', {
      email: 'nouser@example.com',
      password: 'Test1234',
    });
    const response = await loginHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});

// ─── GET /auth/me ───────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('should return 200 with user data when authenticated', async () => {
    const token = signJwt({ userId: mockUser.id, role: 'caregiver' });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${token}`,
    });
    const response = await meGetHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.email).toBe('test@example.com');
    expect(body.data.id).toBe(mockUser.id);
  });

  it('should return 401 AUTH_REQUIRED without token', async () => {
    const request = createRequest('GET');
    const response = await meGetHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });
});

// ─── PUT /auth/me ───────────────────────────────────────────

describe('PUT /api/v1/auth/me', () => {
  it('should update user profile and return 200', async () => {
    const token = signJwt({ userId: mockUser.id, role: 'caregiver' });
    const updatedUser = { ...mockUser, name: '新名稱' };
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.user.update.mockResolvedValue(updatedUser);

    const request = createRequest('PUT', { name: '新名稱' }, {
      Authorization: `Bearer ${token}`,
    });
    const response = await mePutHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('新名稱');
  });
});
