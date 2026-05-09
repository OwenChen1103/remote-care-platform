import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';

export interface AuthPayload {
  userId: string;
  role: UserRole;
}

interface JwtPayloadData {
  userId: string;
  role: UserRole;
  iat: number;
  exp: number;
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? '';
}

const JWT_EXPIRES_IN = '7d';

export function signJwt(payload: { userId: string; role: UserRole }): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Decodes & verifies a JWT signature. Pure function — no DB hit.
 * Use this when you specifically need only signature verification (rare).
 * For request authentication, prefer `verifyAuth` which also enforces account state.
 */
export function verifyJwt(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    }) as JwtPayloadData;
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}

/**
 * Authenticates a request and validates account is still active (Section 3 / Decision G).
 *
 * Two-step check:
 *   1. JWT signature valid → claim a userId + role from token
 *   2. DB lookup → user exists & not suspended (suspended_at IS NULL)
 *
 * Returns the role FROM the JWT, not from the DB. Trade-off:
 *   - A role change takes effect only on next login (max 7-day staleness via JWT expiry).
 *   - Suspension takes effect IMMEDIATELY (next API request blocked) since DB is checked.
 *
 * The DB hit costs ~1 query per authenticated request (~ms on Postgres + connection pooling).
 * Returns null if:
 *   - No bearer/cookie token present
 *   - JWT invalid or expired
 *   - User no longer exists (e.g. hard-deleted)
 *   - User is suspended (suspended_at IS NOT NULL)
 */
export async function verifyAuth(request: NextRequest): Promise<AuthPayload | null> {
  // Strategy 1: Authorization header (Mobile)
  const authHeader = request.headers.get('authorization');
  let payload: AuthPayload | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    payload = verifyJwt(authHeader.slice(7));
  } else {
    // Strategy 2: httpOnly cookie (Web Admin)
    const cookieToken = request.cookies.get('auth_token')?.value;
    if (cookieToken) {
      payload = verifyJwt(cookieToken);
    }
  }
  if (!payload) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, suspended_at: true },
  });
  if (!dbUser) return null;
  // Truthy check treats both null (production active) and undefined (test fixtures
  // that don't bother setting the field) as "active". Real DB values are always Date | null.
  if (dbUser.suspended_at) return null;
  return payload;
}
