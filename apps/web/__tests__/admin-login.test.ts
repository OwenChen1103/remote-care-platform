import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Set JWT_SECRET before any imports that use it
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';

// Mock prisma — admin-login now does a DB lookup to check suspended_at (audit fix #1b).
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: { findUnique: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/csrf', () => ({
  checkOrigin: () => true,
}));

import { POST as adminLoginHandler } from '../app/api/v1/auth/admin-login/route';
import { signJwt } from '../lib/auth';

function createRequest(method: string, body?: unknown): NextRequest {
  const url = 'http://localhost:3000/api/v1/auth/admin-login';
  const options: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  return new NextRequest(url, options);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: token resolves to an active (non-suspended) admin in DB.
  // Tests that verify the suspension guard override this per-test with mockResolvedValueOnce.
  mockPrisma.user.findUnique.mockResolvedValue({
    id: '550e8400-e29b-41d4-a716-446655440000',
    suspended_at: null,
  });
});

// ─── Admin Login ────────────────────────────────────────────

describe('POST /api/v1/auth/admin-login', () => {
  it('should login admin successfully and return 200 with cookie set', async () => {
    const token = signJwt({ userId: '550e8400-e29b-41d4-a716-446655440000', role: 'admin' });

    const request = createRequest('POST', { token });
    const response = await adminLoginHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toBe('已設定 Cookie');

    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('auth_token=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie?.toLowerCase()).toContain('samesite=strict');
  });

  it('should return 401 AUTH_INVALID_CREDENTIALS for invalid token (wrong password / bad JWT)', async () => {
    const request = createRequest('POST', { token: 'invalid.jwt.token' });
    const response = await adminLoginHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('should return 403 AUTH_FORBIDDEN for non-admin role user', async () => {
    const token = signJwt({ userId: '550e8400-e29b-41d4-a716-446655440000', role: 'caregiver' });

    const request = createRequest('POST', { token });
    const response = await adminLoginHandler(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AUTH_FORBIDDEN');
  });

  it('should return 401 AUTH_INVALID_CREDENTIALS for non-existent user (expired/forged token)', async () => {
    // Simulate a token signed with a wrong secret (non-existent user scenario)
    const jwt = await import('jsonwebtoken');
    const badToken = jwt.default.sign(
      { userId: 'non-existent-id', role: 'admin' },
      'wrong-secret',
      { algorithm: 'HS256', expiresIn: '7d' },
    );

    const request = createRequest('POST', { token: badToken });
    const response = await adminLoginHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('should return 400 VALIDATION_ERROR when token field is missing', async () => {
    const request = createRequest('POST', {});
    const response = await adminLoginHandler(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // Audit fix #1b — admin-login must reject suspended admin even if their JWT is signature-valid.
  it('should return 403 AUTH_FORBIDDEN when admin user is suspended', async () => {
    const token = signJwt({ userId: '550e8400-e29b-41d4-a716-446655440000', role: 'admin' });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: '550e8400-e29b-41d4-a716-446655440000',
      suspended_at: new Date('2026-05-01T00:00:00Z'),
    });

    const request = createRequest('POST', { token });
    const response = await adminLoginHandler(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('AUTH_FORBIDDEN');
  });

  it('should return 401 when admin user no longer exists in DB', async () => {
    const token = signJwt({ userId: '550e8400-e29b-41d4-a716-446655440000', role: 'admin' });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const request = createRequest('POST', { token });
    const response = await adminLoginHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('should return 400 VALIDATION_ERROR when body has empty token', async () => {
    const request = createRequest('POST', { token: '' });
    const response = await adminLoginHandler(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
